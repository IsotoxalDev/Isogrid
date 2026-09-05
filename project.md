# Isogrid — Multi-user realtime boards (internal reference)

Internal engineering reference for the multi-user/realtime/sharing work on top of Isogrid.
Not user-facing — see `README.md` for that. Read this before touching board persistence,
sharing, or sync code so you don't have to re-derive the design from scratch.

## Firebase project

- Project ID: `studio-2262068580-5ae6d`
- Firebase CLI has no `.firebaserc` committed — every `firebase` CLI command needs
  `--project studio-2262068580-5ae6d` explicitly, or run `firebase use studio-2262068580-5ae6d`
  once to create one.
- Realtime Database is enabled at `https://studio-2262068580-5ae6d-default-rtdb.firebaseio.com/`
  (separate product from Firestore, used only for live cursor presence). Confirmed reachable.
- `.env.local` has real credentials for this project already, including
  `NEXT_PUBLIC_FIREBASE_DATABASE_URL`. `.env.example` documents all required vars.

### Deploying rules
```
firebase deploy --project studio-2262068580-5ae6d --only firestore:rules,storage,database
```
**Gotcha**: it's `--only storage`, **not** `storage:rules`. Storage's colon syntax names a
deploy *target* (multi-bucket setups via `firebase target:apply storage <name> <bucket>`), not
a rules sub-resource — `storage:rules` fails with "Could not find rules for the following
storage targets: rules" because no target literally named `rules` exists. Firestore's
`firestore:rules` colon syntax is different and is correct as-is.

## Data model (Firestore)

Replaced the old single-blob model (`users/{uid}.data` = one JSON string with every board's
items flattened together, disambiguated only by `parentId`) with:

```
boards/{boardId}
  id, name, parentId (null = a user's personal root board)
  ownerId
  collaborators: { [uid]: 'viewer' | 'editor' }   // owner is implicit, not listed
  createdAt, updatedAt

boards/{boardId}/items/{itemId}            // CanvasItemData + { updatedAt, updatedBy }
boards/{boardId}/arrows/{arrowId}          // ArrowData + { updatedAt, updatedBy }
boards/{boardId}/memberSettings/{uid}      // BoardSettings — PER-USER, see note below

userDirectory/{uid}                // { email (lowercased), displayName } — written at signup
                                    // and during legacy migration; used for email→uid lookup
                                    // when sharing (client SDK can't query other users' Auth
                                    // records directly, no firebase-admin in this project)

users/{userId}                     // repurposed: { rootBoardId, migrated, data? (legacy
                                    // blob, kept untouched as a cold backup, not deleted)
```

**`BoardSettings` (background color, grid style/opacity/color, accent color, vignette,
snap-to-grid, default opacity/blur) is per-user, per-board — NOT shared board state.** It
originally lived directly on `boards/{boardId}.settings`, but that meant one collaborator's
theme/grid preference silently overwrote what every other viewer saw (and looked to that other
viewer like "my settings changed by themselves" or "my change didn't stick" once anyone else
touched it). Moved to `boards/{boardId}/memberSettings/{uid}` so it's genuinely personal — the
same board can look completely different to each person viewing it. `BoardDoc` no longer has a
`settings` field. `src/lib/firebase.ts`: `getUserBoardSettings`/`setUserBoardSettings`/
`subscribeToUserBoardSettings`. Firestore rule: `allow read, write: if auth.uid == uid` — even
stricter than items/arrows, no board-access check needed since it's read/written by nobody but
the owning uid. `migrateLegacyUserBlob` seeds each newly-created board's `memberSettings` for the
migrating user from their old blob's (previously global) settings, so their visual prefs carry
over once instead of resetting to default.

Every board — root or nested — gets its own `boards/{id}` doc from the moment it's created
(`addItem('board', ...)` in the board page also calls `createBoard(...)`), so any board can be
shared independently. A user's "Home" is a real board doc too (`users/{uid}.rootBoardId`),
created on first login via `migrateLegacyUserBlob`/`getUserRootBoardId` in `src/lib/firebase.ts`.

Items/arrows are subcollections (not an array field on the board doc) because: (a) Firestore's
1MiB doc limit is a real risk for image-heavy boards, (b) `onSnapshot(...).docChanges()` on a
subcollection delivers only changed docs, which realtime sync depends on.

### Migration
`migrateLegacyUserBlob(userId, email, displayName)` in `src/lib/firebase.ts` lazily migrates a
user's old blob to the new model on their next login (mirrors the pre-existing lazy-migrate
pattern already used for the AES→JSON legacy format). Creates a root board doc, walks the old
flat item tree, promotes every `type:'board'` item to its own `boards/{id}` doc, batch-writes
items/arrows into the right subcollection. Old blob is left in place, not deleted.

## Permission model

Roles: `owner` (implicit, `board.ownerId`), `editor`, `viewer` (in `board.collaborators`).

**Nested-board inheritance is one-directional, down only**: sharing board `y` grants that same
role to everything nested inside `y` (children, grandchildren, ...). The reverse never holds —
being a collaborator on a child never grants any access to its parent or siblings.

Implemented in two places that must stay in sync:
1. **`firestore.rules`** — real enforcement. Firestore rules can't recurse, so the ancestor-chain
   walk is manually unrolled to a fixed max depth of 8 (`canReadChain1`..`canReadChain8`,
   `canEditChain1`..`canEditChain8`). Access to a board = direct access on it OR direct access on
   any ancestor found by walking `parentId` up to 8 levels. Changing a board's own
   `collaborators` map is still owner-only (not inheritable) — an inherited editor can edit
   content but can't re-share.
2. **Client (`src/app/isogrid/[boardId]/page.tsx`)** — `ancestorChainRef` (a ref, not state) is
   populated during the breadcrumb-walk in the load effect (which fetches each ancestor's full
   `BoardDoc`, not just `id`/`name`). `isOwner` stays direct-only (gates the Share dialog's invite
   form). `myRole`/`canEdit` walk the same ref, closest board wins. The breadcrumb walk tolerates
   a permission-denied ancestor (catches the error, breaks the loop) rather than failing the
   whole board load — that's the expected case for a user who only has access via a lower board.

`ShareDialog` only shows/manages a board's own direct `collaborators` — it does not surface
"you have access via an ancestor share" anywhere in the UI. Known gap, not yet requested.

## Realtime sync

- One `onSnapshot` per open board on `items` and `arrows` subcollections
  (`subscribeToBoardItems`/`subscribeToBoardArrows` in `src/lib/firebase.ts`), applying
  `docChanges()` deltas into local state — never a full re-fetch.
- **Echo suppression** (`shouldApply` in the load effect): skip a change if
  `hasPendingWrites` (our own not-yet-confirmed optimistic write — local state already reflects
  it), and skip a *confirmed* write of our own authorship if `localEditTimestampsRef` shows we've
  made a newer local edit since (stale echo, would otherwise snap the item backward mid-drag).
- **Undo/redo is per-user and local**, not a global snapshot stack — a global stack would let one
  collaborator's undo revert another's concurrent edit. Each local mutation pushes one
  `UndoBatch` (array of `{kind:'item'|'arrow'|'settings', before, after}`) computed by diffing in
  `updateState`; `undo`/`redo` just replay `before`/`after` through the normal
  `setItems`/`setArrows`/`setSettings` + save path. Accepted limitation: two users editing the
  *exact same item* concurrently is still last-write-wins (no CRDT/OT) — this was a deliberate
  tradeoff, not an oversight, given the app is Firestore-native and a CRDT engine (Yjs etc.) is a
  materially bigger lift.
- Board-level doc (`name`/`settings`/`collaborators`) has its own lightweight whole-doc
  `subscribeToBoardDoc` listener — low churn, plain last-write-wins, no echo-suppression needed.

### Bug fixed: settings/edits lost when navigating right after changing them
A change made within the debounce window (e.g. tweak `canvasBackgroundColor`, then immediately
click a breadcrumb/double-click into a board before the debounce fired) was silently discarded —
never written to Firestore at all — because the save-debounce `useEffect` includes `boardId` in
its dependency array. When `boardId` changes, React runs that effect's cleanup, which did a plain
`clearTimeout` — cancelling the pending save instead of running it. The change simply vanished;
re-opening the board later loaded the last *actually persisted* value.

Fixed by adding `itemsRef`/`arrowsRef`/`settingsRef` (always-current mirrors of state, synced via
a small effect) and a `flushSave(targetBoardId)` function (the same diff-and-write logic the
debounce used to run inline, now reusable). The main load effect's cleanup — which fires on the
exact same boardId-change/unmount trigger — now calls `flushSave(boardId)` (closure's *old*
boardId) before unsubscribing, so any pending change is written immediately instead of dropped.
`isBoardLoadedRef` guards this so it can't fire against a half-loaded board with stale/empty refs.
The debounce effect itself now just calls the same `flushSave(boardId)` on its normal 150ms timer.
**Any future change to the save/debounce logic must preserve this flush-on-cleanup behavior** —
it's easy to reintroduce this bug by "simplifying" the debounce back to a bare `clearTimeout`.

### Latency tuning (as of this writing)
- `THROTTLE_WRITE_MS = 120` — `handleItemUpdate`/`handleItemsUpdate`/`handleArrowUpdate` push a
  throttled Firestore write *during* continuous interactions (drags, resizes, typing bursts), not
  just at the end. Without this, collaborators would see nothing move until the drag ends (a pure
  debounce only fires after activity *stops*, never mid-stream).
- Trailing debounced save effect: **150ms** (was 1000ms). The 1000ms figure was a holdover from
  the original single-user design, where the whole canvas was serialized as one JSON blob per
  save and there was no live viewer to notice the delay — never re-tuned when per-item docs made
  writes cheap. The debounce still exists as a trailing/catch-up pass (guarantees the exact final
  value lands even if the last throttle window was skipped) and to catch discrete one-shot
  mutations (add/delete/settings changes) that don't go through the throttle path at all.
- **Cost note**: throttling during drags increases Firestore write/read volume roughly
  proportional to (time spent actively dragging/typing) × (1000/120), and realtime-listener reads
  fan out to every collaborator with the board open. Estimated low-impact for normal usage inside
  Firestore's free tier (20K writes/day, 50K reads/day) or the $0.18/100K-writes,
  $0.06/100K-reads Blaze pricing beyond that — a 2-second drag going from 1→~16 writes is still a
  fraction of a cent. Raise `THROTTLE_WRITE_MS` (e.g. to 250) if this ever shows up materially on
  a bill. **This has zero effect on Cloudflare Workers/edge request billing** — the Firestore/RTDB
  client SDKs talk directly from the browser to Google's backend, never through the Next.js
  server or Workers routes.

## Presence / live cursors

- Firebase Realtime Database, not Firestore — chosen for `onDisconnect()` (automatic cleanup on
  tab close/network drop) and because per-cursor-move billing fits RTDB's model much better than
  Firestore's per-write billing.
- `firebase/database` is **dynamically imported** inside `src/lib/firebase.ts`'s presence
  functions (`joinPresence`, `leavePresence`, `updateCursorPosition`, `subscribeToPresence`), not
  imported at module top-level. A top-level import was tried first and added ~40kB to *every*
  page's bundle (including login/signup/home, which never touch presence) since `firebase.ts` is
  imported everywhere for auth. Keep it lazy.
- `src/hooks/use-presence.ts` + `src/components/canvas/presence-cursors.tsx`. Cursor color is a
  deterministic hash of `uid` into a fixed palette. Cursor position is stored in canvas coordinate
  space (same as `item.position`) and rendered as a sibling of items inside the same pan/zoom
  `transform` div, so no extra transform math is needed — it inherits the same CSS transform.
- Client-side cursor position sends are throttled at 50ms (`CURSOR_THROTTLE_MS` in
  `use-presence.ts`) — separate constant from the item-write throttle above.
- Silently no-ops everywhere if `NEXT_PUBLIC_FIREBASE_DATABASE_URL` isn't set — presence is
  optional, the rest of the app must keep working without it.
- `database.rules.json` (new file, referenced from `firebase.json`): any signed-in user can read
  any board's presence node (low-sensitivity data — name/color/cursor only), but can only write
  their own `presence/{boardId}/{uid}` entry.

## Routing

- `src/app/isogrid/[boardId]/page.tsx` is the real editor (moved here from the old flat
  `src/app/isogrid/page.tsx`, which is now a thin redirect).
- `src/app/isogrid/page.tsx` (the redirect) still serves the **guest** experience unchanged
  (localStorage-only, no Firestore) for signed-out visitors — multi-user sharing inherently
  requires an account, so guests were kept on the old simple flow rather than given board IDs.
  For signed-in users it resolves/migrates their root board and does `router.replace`.
- `boardStack` (breadcrumb) is rebuilt on every load by walking `parentId` up from the current
  board via `getBoardDoc`, and the URL always reflects the currently open board — so any board,
  including nested ones, is independently deep-linkable/shareable.

## Sharing UI

- `src/components/canvas/share-dialog.tsx` + `src/components/ui/dialog.tsx` (new shadcn-style
  `Dialog` wrapper around `@radix-ui/react-dialog` — the existing `alert-dialog.tsx` is
  confirmation-only, not reusable here).
- `src/hooks/use-auth.ts` — extracted from the previously-quadruplicated `onAuthStateChanged`
  boilerplate (was duplicated in `page.tsx`, `login/page.tsx`, `signup/page.tsx`,
  `src/app/page.tsx`).
- Invite flow: email → `lookupUserByEmail` (queries `userDirectory` by lowercased email) → if
  found, `setCollaboratorRole(boardId, uid, role)`. No `firebase-admin`/server API route — this
  project has zero server-side Firebase infra, and `firebase-admin`'s Node/gRPC internals have
  real, unverified compatibility risk on this app's Cloudflare Workers (via OpenNext) deploy
  target. Chose the denormalized-directory approach explicitly over the admin-SDK route for that
  reason (tradeoff: any signed-in user can check if an email is registered — existence-only, not
  data leakage).

## Known limitations / accepted tradeoffs (not oversights — don't "fix" without re-checking why)

- Same item edited by two people at the exact same instant: last-write-wins, no CRDT/OT.
- `storage.rules`'s `canvas-images/{itemId}/{fileName}` rule is signed-in-only, not
  board-access-scoped — the storage path doesn't carry a `boardId`, so scoping it further would
  need changing the upload path to `canvas-images/{boardId}/{itemId}/...`. The old fully-open
  `{allPaths=**}` wildcard fallback *was* removed though.
- `ShareDialog` doesn't show inherited-via-ancestor access, only this board's own direct list.
- Undo can still clobber a concurrent edit from someone else to the exact same item (documented
  v1 simplification, same root cause as the last-write-wins point above).
- `getUserBoards` (move-to-board picker) only lists boards the current user *owns*, not boards
  they have inherited/direct editor access to. Pre-existing scope boundary, not revisited.

## Known environment gotchas

- **`next dev --turbopack` + `next/font/google`**: can intermittently fail with `Module not
  found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'`. Confirmed unrelated
  to any app code (`layout.tsx` untouched by this work) — reproduced as a one-off, resolved by
  `rm -rf .next` and restarting. If it recurs persistently (not just once), it likely means
  something is blocking `fonts.gstatic.com` at dev-server-start time (corporate proxy/VPN/
  firewall); the durable fix would be self-hosting Inter via `next/font/local` instead of
  `next/font/google`, removing the network dependency entirely. Not done yet since the one
  occurrence looked transient.
- Firebase CLI deploy needs `--project studio-2262068580-5ae6d` (no `.firebaserc` committed) and
  `--only storage` not `storage:rules` (see Deploying rules above).

## Rollout sequence this was built in (for context on commit/PR boundaries if bisecting)

1. Data model + migration function, additive (old `users/{uid}` rule kept alongside new
   `boards`/`userDirectory` rules).
2. Cutover to per-board routes + per-item Firestore reads/writes, still single-user (no
   `onSnapshot` yet).
3. Sharing UI + `userDirectory` + board-scoped rules (real permission enforcement begins here).
4. Realtime sync (`onSnapshot` + echo suppression) + undo/redo redesign (shipped together —
   the old global-snapshot undo becomes actively dangerous once remote edits stream in).
5. Presence/cursors via RTDB.
6. Nested-board permission inheritance (rules chain-walk + client ancestor-chain check).
7. Latency tuning (throttled writes during drag + shortened trailing debounce).

## File map

New:
- `src/app/isogrid/[boardId]/page.tsx` — the real board editor
- `src/hooks/use-auth.ts`, `src/hooks/use-presence.ts`
- `src/components/canvas/share-dialog.tsx`, `src/components/canvas/presence-cursors.tsx`
- `src/components/ui/dialog.tsx`
- `database.rules.json`

Changed:
- `src/lib/firebase.ts` — biggest change; all board/item/arrow/userDirectory/presence CRUD +
  migration + realtime subscriptions
- `src/lib/types.ts` — `BoardDoc`, `BoardRole`, `UserDirectoryEntry`
- `src/app/isogrid/page.tsx` — now the thin redirect + guest-only page
- `src/app/signup/page.tsx` — writes `userDirectory` entry on signup
- `firestore.rules`, `storage.rules`, `firebase.json`, `.env.example`
