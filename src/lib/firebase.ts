import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
    getFirestore,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    updateDoc,
    collection,
    query,
    where,
    limit,
    writeBatch,
    serverTimestamp,
    deleteField,
    onSnapshot,
    Timestamp,
    type Unsubscribe,
    type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { nanoid } from "nanoid";
import { CanvasItemData, ArrowData, BoardSettings, BoardDoc, BoardRole, UserDirectoryEntry } from "./types";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

auth = getAuth(app);
db = getFirestore(app);
storage = getStorage(app);

export type CanvasData = {
    items: CanvasItemData[];
    arrows: ArrowData[];
    settings: BoardSettings;
};

/**
 * Save canvas data directly to Firestore as plain JSON.
 * Security is enforced by Firestore rules (request.auth != null),
 * so we don't need application-level encryption here.
 */
export const saveCanvasData = async (userId: string, data: CanvasData) => {
    try {
        const userDocRef = doc(db, "users", userId);
        await setDoc(userDocRef, { data: JSON.stringify(data) }, { merge: true });
    } catch (error) {
        console.error("Error saving canvas data:", error);
        throw error;
    }
};

/**
 * Load canvas data from Firestore.
 * Handles three legacy formats:
 *   1. Plain JSON string (current format)
 *   2. AES-encrypted string (previous format) — calls /api/canvas/decrypt
 *   3. Raw object (oldest format, stored unencrypted as a Firestore map)
 */
export const loadCanvasData = async (userId: string): Promise<CanvasData | null> => {
    try {
        const userDocRef = doc(db, "users", userId);
        const docSnap = await getDoc(userDocRef);

        if (!docSnap.exists()) return null;

        const raw = docSnap.data()?.data;

        // 1. Plain JSON string
        if (typeof raw === "string") {
            try {
                return JSON.parse(raw) as CanvasData;
            } catch {
                // Not valid JSON — likely an encrypted legacy string, fall through
            }

            // 2. Legacy encrypted string — decrypt server-side (ENCRYPTION_KEY stays private)
            try {
                const res = await fetch("/api/canvas/decrypt", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ciphertext: raw }),
                });
                if (res.ok) {
                    const { data } = await res.json();
                    // Re-save as plain JSON so future loads are fast (migration)
                    await saveCanvasData(userId, data);
                    return data as CanvasData;
                }
            } catch {
                console.error("Legacy decryption failed, returning null");
            }
            return null;
        }

        // 3. Raw object (oldest legacy format)
        if (typeof raw === "object" && raw !== null) {
            return raw as CanvasData;
        }

        return null;
    } catch (error) {
        console.error("Error loading canvas data:", error);
        throw error;
    }
};

// --- Board collection (new multi-user data model) ---
//
// Replaces the single users/{userId}.data blob with one doc per board
// (boards/{boardId}) plus items/arrows subcollections, so boards can be
// independently shared and edited concurrently. See migrateLegacyUserBlob
// for how existing single-blob users move onto this model.

const FIRESTORE_BATCH_LIMIT = 500;

export const createBoard = async (params: {
    id: string;
    name: string;
    parentId: string | null;
    ownerId: string;
    settings: BoardSettings;
}): Promise<void> => {
    const { id, name, parentId, ownerId, settings } = params;
    await setDoc(doc(db, "boards", id), {
        id,
        name,
        parentId,
        ownerId,
        collaborators: {},
        settings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
};

export const getBoardDoc = async (boardId: string): Promise<BoardDoc | null> => {
    const snap = await getDoc(doc(db, "boards", boardId));
    return snap.exists() ? (snap.data() as BoardDoc) : null;
};

export const updateBoardDoc = async (
    boardId: string,
    partial: Partial<Pick<BoardDoc, "name" | "settings">>
): Promise<void> => {
    await updateDoc(doc(db, "boards", boardId), { ...partial, updatedAt: serverTimestamp() });
};

// Boards owned by this user, for the "move item to board" tree picker.
export const getUserBoards = async (ownerId: string): Promise<BoardDoc[]> => {
    const q = query(collection(db, "boards"), where("ownerId", "==", ownerId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BoardDoc);
};

export const setCollaboratorRole = async (boardId: string, uid: string, role: BoardRole): Promise<void> => {
    await updateDoc(doc(db, "boards", boardId), {
        [`collaborators.${uid}`]: role,
        updatedAt: serverTimestamp(),
    });
};

export const removeCollaborator = async (boardId: string, uid: string): Promise<void> => {
    await updateDoc(doc(db, "boards", boardId), {
        [`collaborators.${uid}`]: deleteField(),
        updatedAt: serverTimestamp(),
    });
};

export const getBoardItems = async (boardId: string): Promise<CanvasItemData[]> => {
    const snap = await getDocs(collection(db, "boards", boardId, "items"));
    return snap.docs.map(d => d.data() as CanvasItemData);
};

export const getBoardArrows = async (boardId: string): Promise<ArrowData[]> => {
    const snap = await getDocs(collection(db, "boards", boardId, "arrows"));
    return snap.docs.map(d => d.data() as ArrowData);
};

export type DocChange<T> = {
    type: "added" | "modified" | "removed";
    id: string;
    data: T;
    hasPendingWrites: boolean;
    updatedBy?: string;
    updatedAtMillis: number | null;
};

export const subscribeToBoardDoc = (boardId: string, cb: (board: BoardDoc | null) => void): Unsubscribe => {
    return onSnapshot(doc(db, "boards", boardId), (snap) => {
        cb(snap.exists() ? (snap.data() as BoardDoc) : null);
    });
};

// Live item/arrow sync for realtime collaboration. docChanges() only reports what
// actually changed since the last snapshot, so the first callback (added events for
// every existing doc) doubles as the initial load, and every callback after that is
// an incremental delta to merge into local state.
export const subscribeToBoardItems = (boardId: string, cb: (changes: DocChange<CanvasItemData>[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, "boards", boardId, "items"), (snapshot) => {
        const changes = snapshot.docChanges().map((change): DocChange<CanvasItemData> => {
            const { updatedAt, updatedBy, ...item } = change.doc.data() as CanvasItemData & { updatedAt?: Timestamp; updatedBy?: string };
            return {
                type: change.type,
                id: change.doc.id,
                data: item as CanvasItemData,
                hasPendingWrites: change.doc.metadata.hasPendingWrites,
                updatedBy,
                updatedAtMillis: updatedAt instanceof Timestamp ? updatedAt.toMillis() : null,
            };
        });
        if (changes.length > 0) cb(changes);
    });
};

export const subscribeToBoardArrows = (boardId: string, cb: (changes: DocChange<ArrowData>[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, "boards", boardId, "arrows"), (snapshot) => {
        const changes = snapshot.docChanges().map((change): DocChange<ArrowData> => {
            const { updatedAt, updatedBy, ...arrow } = change.doc.data() as ArrowData & { updatedAt?: Timestamp; updatedBy?: string };
            return {
                type: change.type,
                id: change.doc.id,
                data: arrow as ArrowData,
                hasPendingWrites: change.doc.metadata.hasPendingWrites,
                updatedBy,
                updatedAtMillis: updatedAt instanceof Timestamp ? updatedAt.toMillis() : null,
            };
        });
        if (changes.length > 0) cb(changes);
    });
};

export const setBoardItem = async (boardId: string, item: CanvasItemData, updatedBy: string): Promise<void> => {
    await setDoc(doc(db, "boards", boardId, "items", item.id), {
        ...item,
        updatedAt: serverTimestamp(),
        updatedBy,
    });
};

export const deleteBoardItem = async (boardId: string, itemId: string): Promise<void> => {
    await deleteDoc(doc(db, "boards", boardId, "items", itemId));
};

// Deletes only the boards/{id} doc itself, not its items/arrows subcollections —
// used when a board item is removed from its parent so the boards collection
// doesn't accumulate docs for boards nobody can navigate to anymore. Any items
// left in the deleted board's subcollections become unreachable orphans; a
// follow-up cleanup job could sweep those, but that's out of scope here.
export const deleteBoardDocOnly = async (boardId: string): Promise<void> => {
    await deleteDoc(doc(db, "boards", boardId));
};

export const setBoardArrow = async (boardId: string, arrow: ArrowData, updatedBy: string): Promise<void> => {
    await setDoc(doc(db, "boards", boardId, "arrows", arrow.id), {
        ...arrow,
        updatedAt: serverTimestamp(),
        updatedBy,
    });
};

export const deleteBoardArrow = async (boardId: string, arrowId: string): Promise<void> => {
    await deleteDoc(doc(db, "boards", boardId, "arrows", arrowId));
};

// Writes docs in chunks of FIRESTORE_BATCH_LIMIT to stay under Firestore's per-batch write limit.
const batchWriteDocs = async (
    refs: ReturnType<typeof doc>[],
    values: Record<string, unknown>[]
): Promise<void> => {
    for (let i = 0; i < refs.length; i += FIRESTORE_BATCH_LIMIT) {
        const batch = writeBatch(db);
        for (let j = i; j < Math.min(i + FIRESTORE_BATCH_LIMIT, refs.length); j++) {
            batch.set(refs[j], values[j]);
        }
        await batch.commit();
    }
};

export const bulkSetBoardItems = async (boardId: string, items: CanvasItemData[], updatedBy: string): Promise<void> => {
    const refs = items.map(item => doc(db, "boards", boardId, "items", item.id));
    const values = items.map(item => ({ ...item, updatedAt: serverTimestamp(), updatedBy }));
    await batchWriteDocs(refs, values);
};

export const bulkSetBoardArrows = async (boardId: string, arrows: ArrowData[], updatedBy: string): Promise<void> => {
    const refs = arrows.map(arrow => doc(db, "boards", boardId, "arrows", arrow.id));
    const values = arrows.map(arrow => ({ ...arrow, updatedAt: serverTimestamp(), updatedBy }));
    await batchWriteDocs(refs, values);
};

// --- User directory (for email-based sharing lookup) ---

export const writeUserDirectoryEntry = async (uid: string, entry: UserDirectoryEntry): Promise<void> => {
    await setDoc(doc(db, "userDirectory", uid), { ...entry, email: entry.email.trim().toLowerCase() });
};

export const lookupUserByEmail = async (email: string): Promise<{ uid: string } & UserDirectoryEntry | null> => {
    const q = query(collection(db, "userDirectory"), where("email", "==", email.trim().toLowerCase()), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { uid: d.id, ...(d.data() as UserDirectoryEntry) };
};

export const getUserDirectoryEntry = async (uid: string): Promise<UserDirectoryEntry | null> => {
    const snap = await getDoc(doc(db, "userDirectory", uid));
    return snap.exists() ? (snap.data() as UserDirectoryEntry) : null;
};

// --- Migration: users/{userId}.data blob -> boards/{boardId} + subcollections ---
//
// Existing users have every board's items flattened into one Firestore doc
// (see loadCanvasData above), disambiguated only by parentId. This walks that
// tree, creates a real boards/{id} doc for the root and for every nested
// item of type 'board' (so every board becomes independently shareable), and
// copies each item/arrow into the matching board's items/arrows subcollection.
// The legacy blob is left untouched as a cold backup.
export const migrateLegacyUserBlob = async (userId: string, email: string, displayName: string): Promise<string> => {
    const userDocRef = doc(db, "users", userId);
    const userSnap = await getDoc(userDocRef);
    const existing = userSnap.data();

    if (existing?.migrated && existing?.rootBoardId) {
        return existing.rootBoardId as string;
    }

    const legacy = await loadCanvasData(userId);
    const items = legacy?.items ?? [];
    const arrows = legacy?.arrows ?? [];
    const settings = legacy?.settings ?? {};

    const rootBoardId = nanoid();

    // Map of old parentId ("null" sentinel for top level) -> new board id.
    // Every nested item of type 'board' gets promoted to its own boards/{id} doc,
    // reusing that item's existing id so item->board references stay stable.
    const boardIdForParent = new Map<string | null, string>([[null, rootBoardId]]);
    for (const item of items) {
        if (item.type === "board") {
            boardIdForParent.set(item.id, item.id);
        }
    }

    await createBoard({ id: rootBoardId, name: "Home", parentId: null, ownerId: userId, settings });
    for (const item of items) {
        if (item.type === "board") {
            await createBoard({
                id: item.id,
                name: item.content || "Untitled board",
                parentId: boardIdForParent.get(item.parentId) ?? rootBoardId,
                ownerId: userId,
                settings,
            });
        }
    }

    const itemRefs = items.map(item => doc(db, "boards", boardIdForParent.get(item.parentId) ?? rootBoardId, "items", item.id));
    const itemValues = items.map(item => ({ ...item, updatedAt: serverTimestamp(), updatedBy: userId }));
    await batchWriteDocs(itemRefs, itemValues);

    const arrowRefs = arrows.map(arrow => doc(db, "boards", boardIdForParent.get(arrow.parentId) ?? rootBoardId, "arrows", arrow.id));
    const arrowValues = arrows.map(arrow => ({ ...arrow, updatedAt: serverTimestamp(), updatedBy: userId }));
    await batchWriteDocs(arrowRefs, arrowValues);

    await setDoc(userDocRef, { rootBoardId, migrated: true }, { merge: true });
    await writeUserDirectoryEntry(userId, { email, displayName });

    return rootBoardId;
};

// Resolves (and migrates on first call, if necessary) a user's personal root board id.
export const getUserRootBoardId = async (userId: string, email: string, displayName: string): Promise<string> => {
    const userSnap = await getDoc(doc(db, "users", userId));
    const existing = userSnap.data();
    if (existing?.migrated && existing?.rootBoardId) {
        return existing.rootBoardId as string;
    }
    return migrateLegacyUserBlob(userId, email, displayName);
};

// --- Presence / live cursors (Realtime Database) ---
//
// Deliberately separate from Firestore: RTDB's onDisconnect() gives free
// automatic cleanup when a tab closes or the network drops, and its pricing/
// design fits the high-frequency, low-value-per-write nature of cursor
// positions much better than billing each cursor move as a Firestore write.
// A no-op if NEXT_PUBLIC_FIREBASE_DATABASE_URL isn't configured.
//
// firebase/database is dynamically imported (not a top-level import) so pages
// that never touch presence — login, signup, the marketing home page — don't
// pay for this module in their JS bundle; only the board page, which actually
// calls these functions, triggers the import.

export type PresenceInfo = {
    name: string;
    color: string;
    cursor: { x: number; y: number } | null;
};

let rtdbInstance: import("firebase/database").Database | null | undefined;

const getRtdb = async () => {
    if (rtdbInstance !== undefined) return rtdbInstance;
    if (!firebaseConfig.databaseURL) {
        rtdbInstance = null;
        return rtdbInstance;
    }
    try {
        const { getDatabase } = await import("firebase/database");
        rtdbInstance = getDatabase(app);
    } catch (error) {
        console.error("Failed to initialize Realtime Database:", error);
        rtdbInstance = null;
    }
    return rtdbInstance;
};

export const joinPresence = async (boardId: string, uid: string, info: { name: string; color: string }): Promise<void> => {
    const rtdb = await getRtdb();
    if (!rtdb) return;
    const { ref, set, onDisconnect, serverTimestamp: rtdbServerTimestamp } = await import("firebase/database");
    const presenceRef = ref(rtdb, `presence/${boardId}/${uid}`);
    await set(presenceRef, { name: info.name, color: info.color, cursor: null, lastActive: rtdbServerTimestamp() });
    onDisconnect(presenceRef).remove();
};

export const leavePresence = async (boardId: string, uid: string): Promise<void> => {
    const rtdb = await getRtdb();
    if (!rtdb) return;
    const { ref, remove } = await import("firebase/database");
    await remove(ref(rtdb, `presence/${boardId}/${uid}`));
};

export const updateCursorPosition = async (boardId: string, uid: string, cursor: { x: number; y: number } | null): Promise<void> => {
    const rtdb = await getRtdb();
    if (!rtdb) return;
    const { ref, update, serverTimestamp: rtdbServerTimestamp } = await import("firebase/database");
    update(ref(rtdb, `presence/${boardId}/${uid}`), { cursor, lastActive: rtdbServerTimestamp() }).catch(() => { });
};

export const subscribeToPresence = (boardId: string, cb: (users: Record<string, PresenceInfo>) => void): (() => void) => {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    getRtdb().then(async (rtdb) => {
        if (!rtdb || cancelled) return;
        const { ref, onValue } = await import("firebase/database");
        if (cancelled) return;
        unsubscribe = onValue(ref(rtdb, `presence/${boardId}`), (snapshot) => {
            cb(snapshot.val() || {});
        });
    });

    return () => {
        cancelled = true;
        unsubscribe?.();
    };
};

export { app, auth, db, storage };