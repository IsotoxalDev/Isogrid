
"use client";

import { useState, useRef, useEffect, useCallback, type MouseEvent, DragEvent, ChangeEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  CanvasItemData,
  Point,
  ViewState,
  ArrowData,
  CanvasItemType,
  Board,
  BoardDoc,
  BoardRole,
  BoardSettings,
  AnyCanvasItem,
  TodoListItem,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import CanvasItem from '@/components/canvas/canvas-item';
import ContextMenu from '@/components/canvas/context-menu';
import SettingsPopover from '@/components/canvas/settings-popover';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { usePresence } from '@/hooks/use-presence';
import PresenceCursors from '@/components/canvas/presence-cursors';
import { ChevronRight, Home, Cog, Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import SelectionBox from '@/components/canvas/selection-box';
import InteractiveArrow from '@/components/canvas/interactive-arrow';
import { Input } from '@/components/ui/input';
import FormattingToolbar from '@/components/canvas/formatting-toolbar';
import {
  auth,
  db,
  storage,
  getBoardDoc,
  createBoard,
  updateBoardDoc,
  setBoardItem,
  deleteBoardItem,
  setBoardArrow,
  deleteBoardArrow,
  deleteBoardDocOnly,
  getUserBoards,
  subscribeToBoardDoc,
  subscribeToBoardItems,
  subscribeToBoardArrows,
  type DocChange,
} from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { nanoid } from 'nanoid';
import { hexToRgba } from '@/lib/utils';
import dynamic from 'next/dynamic';
import MoveToBoardDialog from '@/components/canvas/move-to-board-dialog';
import ShareDialog from '@/components/canvas/share-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const NoteEditor = dynamic(() => import('@/components/canvas/note-editor'), { ssr: false });

const INITIAL_ITEMS: CanvasItemData[] = [];

const INITIAL_ARROWS: ArrowData[] = [];

const INITIAL_SETTINGS: BoardSettings = {
  accentColor: '72 56% 63%',
  showGrid: true,
  gridStyle: 'dots',
  gridOpacity: 0.5,
  snapToGrid: false,
  vignetteIntensity: 0.5,
  defaultOpacity: 1,
  defaultBackgroundBlur: 0
};

const GRID_SIZE = 40;

// Undo/redo is scoped to this user's own local edits, not a global snapshot of
// board state — a global stack would let one collaborator's undo revert another
// collaborator's concurrent edits. Each user action pushes one batch of inverse
// ops (item/arrow/settings before-and-after pairs); undo/redo just replay those
// ops through the normal setItems/setArrows/setSettings + debounced-save path,
// the same way any other local edit is persisted.
type UndoOp =
  | { kind: 'item'; id: string; before: CanvasItemData | null; after: CanvasItemData | null }
  | { kind: 'arrow'; id: string; before: ArrowData | null; after: ArrowData | null }
  | { kind: 'settings'; before: BoardSettings; after: BoardSettings };

type UndoBatch = UndoOp[];

type ArrowDrawingState = {
  isDrawing: boolean;
  startPoint: Point | null;
}

type DraggedTodoInfo = {
  sourceListId: string;
  todo: TodoListItem;
};

// A board is a real Firestore doc (boards/{id}) that any user with access can
// open directly via /isogrid/{boardId}. The 'root' sentinel from the old
// single-blob model doesn't exist here — every board, including a user's
// personal Home, has a real id.
export default function BoardPage() {
  const params = useParams<{ boardId: string }>();
  const boardId = params.boardId;
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [items, setItems] = useState<CanvasItemData[]>(INITIAL_ITEMS);
  const [arrows, setArrows] = useState<ArrowData[]>(INITIAL_ARROWS);
  const [boardStack, setBoardStack] = useState<Board[]>([]);

  const [undoStack, setUndoStack] = useState<UndoBatch[]>([]);
  const [redoStack, setRedoStack] = useState<UndoBatch[]>([]);

  const [settings, setSettings] = useState<BoardSettings>(INITIAL_SETTINGS);

  const [viewState, setViewState] = useState<ViewState>({ zoom: 1, pan: { x: 0, y: 0 } });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; show: boolean; itemId?: string }>({ x: 0, y: 0, show: false });
  const [arrowDrawingState, setArrowDrawingState] = useState<ArrowDrawingState>({ isDrawing: false, startPoint: null });
  const [previewArrow, setPreviewArrow] = useState<ArrowData | null>(null);

  const [selectionBox, setSelectionBox] = useState<{ start: Point; end: Point; visible: boolean } | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedArrowIds, setSelectedArrowIds] = useState<string[]>([]);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [activeTextarea, setActiveTextarea] = useState<HTMLTextAreaElement | null>(null);

  const [draggedTodo, setDraggedTodo] = useState<DraggedTodoInfo | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [moveDialog, setMoveDialog] = useState<{ show: boolean; itemId: string | null }>({ show: false, itemId: null });
  const [userBoards, setUserBoards] = useState<BoardDoc[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const [isBoardLoading, setIsBoardLoading] = useState(true);
  const [boardMeta, setBoardMeta] = useState<{ ownerId: string; collaborators: Record<string, BoardRole> } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastPanPoint = useRef<Point>({ x: 0, y: 0 });
  const rightClickDragInfo = useRef<{ isDragging: boolean; itemId?: string }>({ isDragging: false });
  const importInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Ancestors of the current board (closest parent first, excluding the board
  // itself), used to compute inherited access below — sharing a board grants
  // access to everything nested inside it, so a role granted on any ancestor
  // counts here even though this board's own `collaborators` map doesn't list
  // the user directly. Populated during the ancestor-breadcrumb walk in the
  // data-loading effect further down.
  const ancestorChainRef = useRef<BoardDoc[]>([]);

  const currentBoardId = boardId;

  // isOwner is direct-only (never inherited) — it gates the ability to manage
  // THIS board's own collaborators list in ShareDialog. myRole/canEdit are
  // inheritance-aware: a role granted on any ancestor board applies here too,
  // since sharing a board grants access to everything nested inside it. The
  // closest board in the chain (this board, then its parent, then grandparent,
  // ...) that grants direct access wins.
  const isOwner = !!user && boardMeta?.ownerId === user.uid;
  const directRole: BoardRole | null = (user && boardMeta) ? boardMeta.collaborators[user.uid] ?? null : null;
  const inheritedRole: BoardRole | 'owner' | null = (() => {
    if (!user) return null;
    for (const ancestor of ancestorChainRef.current) {
      if (ancestor.ownerId === user.uid) return 'owner';
      const role = ancestor.collaborators?.[user.uid];
      if (role) return role;
    }
    return null;
  })();
  const myRole: BoardRole | 'owner' | null = isOwner ? 'owner' : (directRole ?? inheritedRole);
  const canEdit = myRole === 'owner' || myRole === 'editor';

  const requireEditAccess = () => {
    if (canEdit) return true;
    toast({ title: 'View-only access', description: "You don't have permission to edit this board." });
    return false;
  };

  const { showGrid = true, gridStyle = 'dots', gridOpacity = 0.5, gridColor, gridThickness = 1, snapToGrid = false, accentColor, vignetteIntensity = 0.5, canvasBackgroundColor } = settings;

  const { peers, updateCursor } = usePresence(isBoardLoading ? null : boardId, user);

  // Tracks the last-known-synced JSON for each item/arrow doc and for settings.
  // The debounced save effect uses this to only write docs that actually changed
  // locally; the realtime subscriptions below also update it whenever they apply
  // an externally-sourced change, so that change isn't immediately written back.
  const lastSavedItemsRef = useRef<Map<string, string>>(new Map());
  const lastSavedArrowsRef = useRef<Map<string, string>>(new Map());
  const lastSavedSettingsRef = useRef<string>('');

  // Records when this client last locally edited a given item/arrow id, so a
  // later-arriving confirmation of one of ITS OWN writes can be recognized as
  // stale (superseded by a newer local edit) and skipped rather than clobbering
  // the newer local state. See applyItemChanges/applyArrowChanges below.
  const localEditTimestampsRef = useRef<Map<string, number>>(new Map());

  // Debounce-only saving means collaborators see nothing move while you're
  // actively dragging an item — the write only fires once you stop and the
  // debounce settles. THROTTLE_WRITE_MS lets handleItemUpdate/handleArrowUpdate
  // push a write partway through a continuous drag too, so others see it move
  // live; the (now much shorter) debounced save effect below still runs as a
  // trailing pass to guarantee the exact final value is persisted even if the
  // last throttle window was skipped.
  const THROTTLE_WRITE_MS = 120;
  const lastThrottledWriteRef = useRef<Map<string, number>>(new Map());

  const throttledWriteItem = (item: CanvasItemData) => {
    if (!user) return;
    const now = Date.now();
    if (now - (lastThrottledWriteRef.current.get(item.id) ?? 0) < THROTTLE_WRITE_MS) return;
    lastThrottledWriteRef.current.set(item.id, now);
    localEditTimestampsRef.current.set(item.id, now);
    lastSavedItemsRef.current.set(item.id, JSON.stringify(item));
    setBoardItem(boardId, item, user.uid).catch(err => console.error('Error saving item:', err));
  };

  const throttledWriteArrow = (arrow: ArrowData) => {
    if (!user) return;
    const now = Date.now();
    if (now - (lastThrottledWriteRef.current.get(arrow.id) ?? 0) < THROTTLE_WRITE_MS) return;
    lastThrottledWriteRef.current.set(arrow.id, now);
    localEditTimestampsRef.current.set(arrow.id, now);
    lastSavedArrowsRef.current.set(arrow.id, JSON.stringify(arrow));
    setBoardArrow(boardId, arrow, user.uid).catch(err => console.error('Error saving arrow:', err));
  };

  // Always-current mirrors of items/arrows/settings, kept in sync via the effect
  // below. Needed so flushSave (called from an effect cleanup when boardId is
  // about to change) can see the LATEST values — a cleanup closure only has
  // access to the state as it was when that effect instance was set up, which
  // for a debounced save would be stale by the time navigation happens.
  const itemsRef = useRef(items);
  const arrowsRef = useRef(arrows);
  const settingsRef = useRef(settings);
  useEffect(() => {
    itemsRef.current = items;
    arrowsRef.current = arrows;
    settingsRef.current = settings;
  }, [items, arrows, settings]);

  // True once this board's initial load has completed — guards flushSave against
  // running on a half-initialized board (e.g. navigating away before load
  // finishes), where itemsRef/arrowsRef would still hold stale/empty data.
  const isBoardLoadedRef = useRef(false);

  // Diffs the latest known items/arrows/settings against what's last known to be
  // saved and writes anything that changed. Used both by the debounced effect
  // below (the normal path) AND flushed synchronously from the load effect's
  // cleanup so a change made just before navigating to another board — before
  // the debounce timer fires — isn't silently discarded when that timer gets
  // cancelled on the board switch.
  const flushSave = (targetBoardId: string) => {
    if (!user || !isBoardLoadedRef.current) return;
    const currentItems = itemsRef.current;
    const currentArrows = arrowsRef.current;
    const currentSettings = settingsRef.current;

    const currentItemIds = new Set(currentItems.map(i => i.id));
    for (const oldId of Array.from(lastSavedItemsRef.current.keys())) {
      if (!currentItemIds.has(oldId)) {
        lastSavedItemsRef.current.delete(oldId);
        deleteBoardItem(targetBoardId, oldId).catch(err => console.error('Error deleting item:', err));
      }
    }
    for (const item of currentItems) {
      const hash = JSON.stringify(item);
      if (lastSavedItemsRef.current.get(item.id) !== hash) {
        lastSavedItemsRef.current.set(item.id, hash);
        setBoardItem(targetBoardId, item, user.uid).catch(err => console.error('Error saving item:', err));
      }
    }

    const currentArrowIds = new Set(currentArrows.map(a => a.id));
    for (const oldId of Array.from(lastSavedArrowsRef.current.keys())) {
      if (!currentArrowIds.has(oldId)) {
        lastSavedArrowsRef.current.delete(oldId);
        deleteBoardArrow(targetBoardId, oldId).catch(err => console.error('Error deleting arrow:', err));
      }
    }
    for (const arrow of currentArrows) {
      const hash = JSON.stringify(arrow);
      if (lastSavedArrowsRef.current.get(arrow.id) !== hash) {
        lastSavedArrowsRef.current.set(arrow.id, hash);
        setBoardArrow(targetBoardId, arrow, user.uid).catch(err => console.error('Error saving arrow:', err));
      }
    }

    const settingsHash = JSON.stringify(currentSettings);
    if (settingsHash !== lastSavedSettingsRef.current) {
      lastSavedSettingsRef.current = settingsHash;
      updateBoardDoc(targetBoardId, { settings: currentSettings }).catch(err => console.error('Error saving settings:', err));
    }
  };

  // --- Data loading + realtime sync ---
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/isogrid');
      return;
    }

    let cancelled = false;
    isBoardLoadedRef.current = false;
    setIsBoardLoading(true);
    setItems([]);
    setArrows([]);
    setUndoStack([]);
    setRedoStack([]);
    lastSavedItemsRef.current = new Map();
    lastSavedArrowsRef.current = new Map();
    lastSavedSettingsRef.current = '';
    localEditTimestampsRef.current = new Map();
    ancestorChainRef.current = [];

    let unsubBoard: (() => void) | null = null;
    let unsubItems: (() => void) | null = null;
    let unsubArrows: (() => void) | null = null;

    (async () => {
      try {
        const board = await getBoardDoc(boardId);
        if (!board) {
          if (!cancelled) {
            toast({ variant: 'destructive', title: 'Board not found' });
            router.replace('/isogrid');
          }
          return;
        }
        if (cancelled) return;

        const resolvedSettings = { ...INITIAL_SETTINGS, ...(board.settings || {}) };
        setBoardMeta({ ownerId: board.ownerId, collaborators: board.collaborators || {} });
        setSettings(resolvedSettings);
        lastSavedSettingsRef.current = JSON.stringify(resolvedSettings);

        // Walk the parentId chain to rebuild the breadcrumb trail and collect
        // ancestors for the inherited-access check below. Access to this board
        // doesn't imply access to every ancestor above it — e.g. a viewer added
        // partway up the chain can see everything below, but a user with access
        // only via a lower board has no path to its parents — so a
        // permission-denied on an ancestor just stops the walk there rather
        // than failing the whole board load; the breadcrumb becomes partial
        // (starting from the highest ancestor this user can actually see).
        const stack: Board[] = [{ id: board.id, name: board.name, parentId: board.parentId }];
        const ancestors: BoardDoc[] = [];
        let cursor = board.parentId;
        while (cursor) {
          let ancestor: BoardDoc | null;
          try {
            ancestor = await getBoardDoc(cursor);
          } catch {
            break;
          }
          if (!ancestor) break;
          stack.unshift({ id: ancestor.id, name: ancestor.name, parentId: ancestor.parentId });
          ancestors.push(ancestor);
          cursor = ancestor.parentId;
        }
        ancestorChainRef.current = ancestors;
        if (cancelled) return;

        setBoardStack(stack);
        setSelectedItemIds([]);
        setSelectedArrowIds([]);
        setViewState({ zoom: 1, pan: { x: 0, y: 0 } });
        setIsBoardLoading(false);
        isBoardLoadedRef.current = true;

        unsubBoard = subscribeToBoardDoc(boardId, (liveBoard) => {
          if (!liveBoard) return;
          setBoardMeta({ ownerId: liveBoard.ownerId, collaborators: liveBoard.collaborators || {} });
          const liveSettings = { ...INITIAL_SETTINGS, ...(liveBoard.settings || {}) };
          const liveHash = JSON.stringify(liveSettings);
          if (liveHash !== lastSavedSettingsRef.current) {
            lastSavedSettingsRef.current = liveHash;
            setSettings(liveSettings);
          }
          setBoardStack(prevStack => prevStack.length > 0
            ? prevStack.map((b, i) => i === prevStack.length - 1 ? { ...b, name: liveBoard.name } : b)
            : prevStack);
        });

        // Applies incoming item/arrow changes with echo suppression: skip a
        // client's own optimistic (not-yet-server-confirmed) writes since local
        // state already reflects them, and skip a confirmed write of this
        // client's OWN authorship if a newer local edit has superseded it.
        const shouldApply = <T,>(change: DocChange<T>) => {
          if (change.hasPendingWrites) return false;
          if (user && change.updatedBy === user.uid) {
            const localTs = localEditTimestampsRef.current.get(change.id) ?? 0;
            if ((change.updatedAtMillis ?? 0) < localTs) return false;
          }
          return true;
        };

        unsubItems = subscribeToBoardItems(boardId, (changes) => {
          setItems(prev => {
            let next = prev;
            let mutated = false;
            for (const change of changes) {
              if (!shouldApply(change)) continue;
              if (!mutated) { next = [...prev]; mutated = true; }
              const idx = next.findIndex(i => i.id === change.id);
              if (change.type === 'removed') {
                if (idx !== -1) next.splice(idx, 1);
              } else if (idx === -1) {
                next.push(change.data);
              } else {
                next[idx] = change.data;
              }
              lastSavedItemsRef.current.set(change.id, JSON.stringify(change.data));
            }
            return mutated ? next : prev;
          });
        });

        unsubArrows = subscribeToBoardArrows(boardId, (changes) => {
          setArrows(prev => {
            let next = prev;
            let mutated = false;
            for (const change of changes) {
              if (!shouldApply(change)) continue;
              if (!mutated) { next = [...prev]; mutated = true; }
              const idx = next.findIndex(a => a.id === change.id);
              if (change.type === 'removed') {
                if (idx !== -1) next.splice(idx, 1);
              } else if (idx === -1) {
                next.push(change.data);
              } else {
                next[idx] = change.data;
              }
              lastSavedArrowsRef.current.set(change.id, JSON.stringify(change.data));
            }
            return mutated ? next : prev;
          });
        });
      } catch (error) {
        console.error('Error loading board:', error);
        if (!cancelled) {
          toast({ variant: 'destructive', title: 'Could not open board', description: 'You may not have access to this board.' });
          router.replace('/isogrid');
        }
      }
    })();

    return () => {
      cancelled = true;
      // Flush any change made just before navigating away (e.g. a settings
      // tweak within the last 150ms) — otherwise the debounced save effect's
      // own cleanup below cancels its pending timer on this same boardId
      // change, and the edit would be silently lost instead of ever reaching
      // Firestore.
      flushSave(boardId);
      unsubBoard?.();
      unsubItems?.();
      unsubArrows?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, user, authLoading]);

  const useDebouncedEffect = (effect: () => void, deps: any[], delay: number) => {
    useEffect(() => {
      const handler = setTimeout(() => effect(), delay);
      return () => clearTimeout(handler);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...(deps || []), delay]);
  };

  useDebouncedEffect(() => {
    if (isBoardLoading || !user) return;
    flushSave(boardId);
  }, [items, arrows, settings, user, isBoardLoading, boardId], 150);

  // --- END Data Persistence ---

  const updateState = (
    newItems: CanvasItemData[] | ((prev: CanvasItemData[]) => CanvasItemData[]),
    newArrows: ArrowData[] | ((prev: ArrowData[]) => ArrowData[]),
    newSettings?: BoardSettings | ((prev: BoardSettings) => BoardSettings),
  ) => {
    const updatedItems = typeof newItems === 'function' ? newItems(items) : newItems;
    const updatedArrows = typeof newArrows === 'function' ? newArrows(arrows) : newArrows;
    const updatedSettings = newSettings ? (typeof newSettings === 'function' ? newSettings(settings) : newSettings) : settings;

    const batch: UndoBatch = [];
    const oldItemsById = new Map(items.map(i => [i.id, i]));
    const newItemsById = new Map(updatedItems.map(i => [i.id, i]));
    for (const [id, oldItem] of oldItemsById) {
      if (!newItemsById.has(id)) batch.push({ kind: 'item', id, before: oldItem, after: null });
    }
    for (const [id, newItem] of newItemsById) {
      const oldItem = oldItemsById.get(id);
      if (!oldItem) batch.push({ kind: 'item', id, before: null, after: newItem });
      else if (oldItem !== newItem && JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
        batch.push({ kind: 'item', id, before: oldItem, after: newItem });
      }
    }

    const oldArrowsById = new Map(arrows.map(a => [a.id, a]));
    const newArrowsById = new Map(updatedArrows.map(a => [a.id, a]));
    for (const [id, oldArrow] of oldArrowsById) {
      if (!newArrowsById.has(id)) batch.push({ kind: 'arrow', id, before: oldArrow, after: null });
    }
    for (const [id, newArrow] of newArrowsById) {
      const oldArrow = oldArrowsById.get(id);
      if (!oldArrow) batch.push({ kind: 'arrow', id, before: null, after: newArrow });
      else if (oldArrow !== newArrow && JSON.stringify(oldArrow) !== JSON.stringify(newArrow)) {
        batch.push({ kind: 'arrow', id, before: oldArrow, after: newArrow });
      }
    }

    if (JSON.stringify(settings) !== JSON.stringify(updatedSettings)) {
      batch.push({ kind: 'settings', before: settings, after: updatedSettings });
    }

    if (batch.length > 0) {
      const now = Date.now();
      for (const op of batch) {
        if (op.kind !== 'settings') localEditTimestampsRef.current.set(op.id, now);
      }
      setUndoStack(stack => [...stack, batch]);
      setRedoStack([]);
    }

    setItems(updatedItems);
    setArrows(updatedArrows);
    setSettings(updatedSettings);
  };

  const applyUndoBatch = useCallback((batch: UndoBatch, direction: 'before' | 'after') => {
    const now = Date.now();
    let nextItems = items;
    let itemsChanged = false;
    let nextArrows = arrows;
    let arrowsChanged = false;
    let nextSettings = settings;

    for (const op of batch) {
      if (op.kind !== 'settings') localEditTimestampsRef.current.set(op.id, now);
      if (op.kind === 'item') {
        if (!itemsChanged) { nextItems = [...items]; itemsChanged = true; }
        const value = direction === 'before' ? op.before : op.after;
        const idx = nextItems.findIndex(i => i.id === op.id);
        if (value === null) { if (idx !== -1) nextItems.splice(idx, 1); }
        else if (idx === -1) nextItems.push(value);
        else nextItems[idx] = value;
      } else if (op.kind === 'arrow') {
        if (!arrowsChanged) { nextArrows = [...arrows]; arrowsChanged = true; }
        const value = direction === 'before' ? op.before : op.after;
        const idx = nextArrows.findIndex(a => a.id === op.id);
        if (value === null) { if (idx !== -1) nextArrows.splice(idx, 1); }
        else if (idx === -1) nextArrows.push(value);
        else nextArrows[idx] = value;
      } else {
        nextSettings = direction === 'before' ? op.before : op.after;
      }
    }

    if (itemsChanged) setItems(nextItems);
    if (arrowsChanged) setArrows(nextArrows);
    if (nextSettings !== settings) setSettings(nextSettings);
  }, [items, arrows, settings]);

  const undo = useCallback(() => {
    setUndoStack(stack => {
      if (stack.length === 0) return stack;
      const batch = stack[stack.length - 1];
      applyUndoBatch(batch, 'before');
      setRedoStack(r => [...r, batch]);
      return stack.slice(0, -1);
    });
  }, [applyUndoBatch]);

  const redo = useCallback(() => {
    setRedoStack(stack => {
      if (stack.length === 0) return stack;
      const batch = stack[stack.length - 1];
      applyUndoBatch(batch, 'after');
      setUndoStack(u => [...u, batch]);
      return stack.slice(0, -1);
    });
  }, [applyUndoBatch]);

  const filteredItems = items;
  const filteredArrows = arrows;
  const allCanvasItems: AnyCanvasItem[] = [...filteredItems, ...filteredArrows];

  const screenToCanvas = useCallback((screenPoint: Point): Point => {
    if (!canvasRef.current) return screenPoint;
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (screenPoint.x - rect.left - viewState.pan.x) / viewState.zoom,
      y: (screenPoint.y - rect.top - viewState.pan.y) / viewState.zoom,
    };
  }, [viewState]);

  const handleZoom = (newZoom: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clampedZoom = Math.max(0.5, Math.min(3, newZoom));

    // Zoom towards the center of the canvas viewport
    const viewportCenter = { x: rect.width / 2, y: rect.height / 2 };

    const mouseOnCanvasBeforeZoom = {
      x: (viewportCenter.x - viewState.pan.x) / viewState.zoom,
      y: (viewportCenter.y - viewState.pan.y) / viewState.zoom,
    };

    const newPan = {
      x: viewportCenter.x - mouseOnCanvasBeforeZoom.x * clampedZoom,
      y: viewportCenter.y - mouseOnCanvasBeforeZoom.y * clampedZoom,
    };

    setViewState({ zoom: clampedZoom, pan: newPan });
  };

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // Check if the wheel event is happening inside a ScrollArea viewport
    const target = e.target as HTMLElement;
    const isInsideScrollArea = target.closest('[data-radix-scroll-area-viewport]');

    // If inside a scrollable area, don't prevent default and don't zoom
    if (isInsideScrollArea) {
      return;
    }

    e.preventDefault();

    if (!canvasRef.current) return;

    setViewState(currentViewState => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const zoomFactor = 1.1;
      const newZoom = e.deltaY < 0 ? currentViewState.zoom * zoomFactor : currentViewState.zoom / zoomFactor;
      const clampedZoom = Math.max(0.5, Math.min(3, newZoom));

      const mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const mouseOnCanvasBeforeZoom = {
        x: (mousePos.x - currentViewState.pan.x) / currentViewState.zoom,
        y: (mousePos.y - currentViewState.pan.y) / currentViewState.zoom
      };

      const newPan = {
        x: mousePos.x - mouseOnCanvasBeforeZoom.x * clampedZoom,
        y: mousePos.y - mouseOnCanvasBeforeZoom.y * clampedZoom
      };

      return { zoom: clampedZoom, pan: newPan };
    });
  }, []);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (contextMenu.show) setContextMenu({ ...contextMenu, show: false });
    const target = e.target as HTMLElement;
    const isCanvasBackdropClick = target.dataset.isCanvasBackdrop === 'true';

    if (isCanvasBackdropClick) {
      if (!e.ctrlKey && !e.metaKey) {
        setSelectedItemIds([]);
        setSelectedArrowIds([]);
      }
    }

    if (arrowDrawingState.isDrawing) {
      if (!canEdit) {
        setArrowDrawingState({ isDrawing: false, startPoint: null });
        setPreviewArrow(null);
        return;
      }
      const canvasPos = screenToCanvas({ x: e.clientX, y: e.clientY });
      if (!arrowDrawingState.startPoint) {
        setArrowDrawingState(s => ({ ...s, startPoint: canvasPos }));
        setPreviewArrow({ id: 'preview-arrow', type: 'arrow', start: canvasPos, end: canvasPos, parentId: currentBoardId });
      } else {
        const newArrow: ArrowData = {
          id: nanoid(),
          type: 'arrow',
          start: arrowDrawingState.startPoint,
          end: canvasPos,
          parentId: currentBoardId
        };
        updateState(items, prevArrows => [...prevArrows, newArrow]);
        setArrowDrawingState({ isDrawing: false, startPoint: null });
        setPreviewArrow(null);
      }
      return;
    }


    if (e.button === 0 && !e.metaKey && !e.ctrlKey && isCanvasBackdropClick) {
      const startPoint = { x: e.clientX, y: e.clientY };
      setSelectionBox({ start: startPoint, end: startPoint, visible: true });
      e.stopPropagation();
      return;
    }

    if (e.button === 1 || (e.button === 0 && (e.metaKey || e.ctrlKey))) {
      isPanning.current = true;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.style.cursor = 'grabbing';
    }
    if (e.button === 2) {
      if (arrowDrawingState.isDrawing) {
        setArrowDrawingState({ isDrawing: false, startPoint: null });
        setPreviewArrow(null);
        e.preventDefault();
        return;
      }
      rightClickDragInfo.current = { isDragging: false };
    }
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    updateCursor(screenToCanvas({ x: e.clientX, y: e.clientY }));
    if (selectionBox?.visible) {
      setSelectionBox(sb => sb ? { ...sb, end: { x: e.clientX, y: e.clientY } } : null);
      return;
    }
    if (isPanning.current) {
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      setViewState(vs => ({ ...vs, pan: { x: vs.pan.x + dx, y: vs.pan.y + dy } }));
    }
    if (e.buttons === 2 && !rightClickDragInfo.current.isDragging) {
      rightClickDragInfo.current.isDragging = true;
    }
    if (arrowDrawingState.isDrawing && arrowDrawingState.startPoint && previewArrow) {
      const canvasPos = screenToCanvas({ x: e.clientX, y: e.clientY });
      setPreviewArrow({ ...previewArrow, end: canvasPos });
    }
  };

  const handleMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    if (selectionBox?.visible) {
      const startCanvas = screenToCanvas(selectionBox.start);
      const endCanvas = screenToCanvas(selectionBox.end);

      const selectionRect = {
        x: Math.min(startCanvas.x, endCanvas.x),
        y: Math.min(startCanvas.y, endCanvas.y),
        width: Math.abs(startCanvas.x - endCanvas.x),
        height: Math.abs(startCanvas.y - endCanvas.y),
      };

      const newlySelectedItems = filteredItems.filter(item => {
        const itemRect = { x: item.position.x, y: item.position.y, width: item.width, height: 'auto' === item.height ? 100 : item.height };
        return (
          itemRect.x < selectionRect.x + selectionRect.width &&
          itemRect.x + itemRect.width > selectionRect.x &&
          itemRect.y < selectionRect.y + selectionRect.height &&
          itemRect.y + itemRect.height > selectionRect.y
        );
      }).map(item => item.id);

      if (e.ctrlKey || e.metaKey) {
        setSelectedItemIds(prevIds => {
          const newIds = new Set(prevIds);
          newlySelectedItems.forEach(id => {
            if (newIds.has(id)) {
              newIds.delete(id);
            } else {
              newIds.add(id);
            }
          });
          return Array.from(newIds);
        });
      } else {
        setSelectedItemIds(newlySelectedItems);
        setSelectedArrowIds([]); // Clear arrow selection on new area selection unless ctrl is held
      }
      setSelectionBox(null);
    }
    isPanning.current = false;
    e.currentTarget.style.cursor = 'grab';

    rightClickDragInfo.current = { isDragging: false };
  };

  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (arrowDrawingState.isDrawing) {
      setArrowDrawingState({ isDrawing: false, startPoint: null });
      setPreviewArrow(null);
    } else {
      const clickedItem = (e.target as HTMLElement).closest('[data-item-id], [data-arrow-id]');
      const itemId = clickedItem ? (clickedItem.getAttribute('data-item-id') || clickedItem.getAttribute('data-arrow-id')) : undefined;

      setContextMenu({ x: e.clientX, y: e.clientY, show: true, itemId: itemId || undefined });
    }
    rightClickDragInfo.current = { isDragging: false };
  };

  const addItem = (type: Extract<CanvasItemType, 'text' | 'image' | 'board' | 'todo' | 'link' | 'title' | 'note'>, position: Point) => {
    if (!requireEditAccess()) return;
    let newItem: CanvasItemData;
    const baseItem = {
      id: nanoid(),
      position,
      parentId: currentBoardId,
    };

    if (type === 'todo') {
      newItem = {
        ...baseItem,
        type,
        width: 400,
        height: 600,
        content: 'New Todo List',
        todos: [],
      };
    } else if (type === 'link') {
      newItem = {
        ...baseItem,
        type,
        width: 300,
        height: 52,
        content: 'https://www.google.com',
      };
    } else if (type === 'title') {
      newItem = {
        ...baseItem,
        type,
        width: 500,
        height: 100,
        content: 'New Title',
        fontSize: 48,
        fontWeight: 'bold',
        textAlign: 'center',
        titleShadow: false,
        titleOutline: false
      };
    } else if (type === 'note') {
      newItem = {
        ...baseItem,
        type,
        width: 300,
        height: 300,
        content: '<h1>New Note</h1><p>Double click to edit...</p>',
      };
    } else {
      newItem = {
        ...baseItem,
        type,
        width: type === 'image' || type === 'board' ? 300 : 250,
        height: type === 'image' || type === 'board' ? 200 : 100,
        content: type === 'text' ? 'New Text' : type === 'board' ? 'New Board' : 'https://placehold.net/shape-600x400.png',
        ...(type === 'text' && {
          textAlign: 'left',
          textAligns: ['left'],
          fontSize: 16,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
        }),
      };
    }
    updateState(prevItems => [...prevItems, newItem], arrows);
    setContextMenu({ ...contextMenu, show: false });

    // Boards are independently shareable, so every board item also needs its own
    // boards/{id} doc from the moment it's created.
    if (type === 'board' && user) {
      createBoard({ id: newItem.id, name: newItem.content, parentId: currentBoardId, ownerId: user.uid, settings: {} })
        .catch(err => {
          console.error('Error creating board:', err);
          toast({ variant: 'destructive', title: 'Could not create board' });
        });
    }

    // Auto-enter edit mode for specific types
    if (['text', 'title', 'link', 'todo', 'note'].includes(type)) {
      setEditingItemId(newItem.id);
    }
  };

  const deleteItem = (itemId: string) => {
    if (!requireEditAccess()) return;
    const item = items.find(i => i.id === itemId);
    updateState(
      items.filter(item => item.id !== itemId),
      arrows.filter(arrow => arrow.id !== itemId)
    );
    setContextMenu({ ...contextMenu, show: false });
    if (item?.type === 'board') {
      deleteBoardDocOnly(itemId).catch(err => console.error('Error deleting board doc:', err));
    }
  }

  const handleMoveItem = async (targetBoardId: string) => {
    if (!moveDialog.itemId || !user || !requireEditAccess()) return;

    const itemId = moveDialog.itemId;
    const item = items.find(i => i.id === itemId);
    const resolvedTargetId = targetBoardId === 'root'
      ? (boardStack[0]?.id ?? targetBoardId)
      : targetBoardId;

    if (!item || resolvedTargetId === currentBoardId) {
      setMoveDialog({ show: false, itemId: null });
      return;
    }

    updateState(
      items.filter(i => i.id !== itemId),
      arrows
    );
    setMoveDialog({ show: false, itemId: null });

    try {
      await setBoardItem(resolvedTargetId, { ...item, parentId: null }, user.uid);
      await deleteBoardItem(currentBoardId, itemId);
      lastSavedItemsRef.current.delete(itemId);
      toast({ title: "Item moved successfully" });
    } catch (error) {
      console.error('Error moving item:', error);
      toast({ variant: 'destructive', title: 'Could not move item' });
    }
  };

  const handleContextMenuAction = (action: Extract<CanvasItemType, 'text' | 'image' | 'board' | 'arrow' | 'todo' | 'link' | 'title' | 'note'> | 'delete' | 'enter' | 'edit' | 'move') => {
    const canvasPos = screenToCanvas({ x: contextMenu.x, y: contextMenu.y });

    if (action === 'delete' && contextMenu.itemId) {
      deleteItem(contextMenu.itemId);
      return;
    }
    if (action === 'enter' && contextMenu.itemId) {
      const item = items.find(i => i.id === contextMenu.itemId);
      if (item && item.type === 'board') {
        router.push(`/isogrid/${item.id}`);
      }
      setContextMenu({ ...contextMenu, show: false });
      return;
    }
    if (action === 'edit' && contextMenu.itemId) {
      setEditingItemId(contextMenu.itemId);
      setContextMenu({ ...contextMenu, show: false });
      return;
    }

    if (action === 'move' && contextMenu.itemId) {
      if (user) {
        getUserBoards(user.uid).then(setUserBoards).catch(err => console.error('Error fetching boards:', err));
      }
      setMoveDialog({ show: true, itemId: contextMenu.itemId });
      setContextMenu({ ...contextMenu, show: false });
      return;
    }

    setContextMenu({ ...contextMenu, show: false });

    if (action === 'arrow') {
      if (canEdit) setArrowDrawingState({ isDrawing: true, startPoint: null });
    } else if (action !== 'delete' && action !== 'enter' && action !== 'edit' && action !== 'move') {
      addItem(action, canvasPos);
    }
  };

  const handleDeleteSelected = useCallback(() => {
    const totalSelected = selectedItemIds.length + selectedArrowIds.length;
    if (totalSelected === 0) return;
    if (!requireEditAccess()) return;

    if (totalSelected > 1) {
      setDeleteConfirmOpen(true);
    } else {
      confirmDelete();
    }
  }, [selectedItemIds, selectedArrowIds, canEdit]);

  const confirmDelete = useCallback(() => {
    if (!canEdit) {
      toast({ title: 'View-only access', description: "You don't have permission to edit this board." });
      setDeleteConfirmOpen(false);
      return;
    }
    const deletedBoardItemIds = items.filter(i => selectedItemIds.includes(i.id) && i.type === 'board').map(i => i.id);
    updateState(
      items.filter(item => !selectedItemIds.includes(item.id)),
      arrows.filter(arrow => !selectedArrowIds.includes(arrow.id))
    );
    const count = selectedItemIds.length + selectedArrowIds.length;
    setSelectedItemIds([]);
    setSelectedArrowIds([]);
    setDeleteConfirmOpen(false);
    toast({ title: `Deleted ${count} item${count > 1 ? 's' : ''}` });
    deletedBoardItemIds.forEach(id => deleteBoardDocOnly(id).catch(err => console.error('Error deleting board doc:', err)));
  }, [items, arrows, selectedItemIds, selectedArrowIds, updateState, toast, canEdit]);

  const handleItemUpdate = (updatedItem: Partial<CanvasItemData> & { id: string }) => {
    if (!canEdit) return;
    const existing = items.find(item => item.id === updatedItem.id);
    updateState(
      items.map(item => item.id === updatedItem.id ? { ...item, ...updatedItem } : item),
      arrows
    );
    if (existing) throttledWriteItem({ ...existing, ...updatedItem });
  };

  const handleItemsUpdate = (updates: (Partial<CanvasItemData> & { id: string })[]) => {
    if (!canEdit) return;
    updateState(
      items.map(item => {
        const update = updates.find(u => u.id === item.id);
        return update ? { ...item, ...update } : item;
      }),
      arrows
    );
    for (const item of items) {
      const update = updates.find(u => u.id === item.id);
      if (update) throttledWriteItem({ ...item, ...update });
    }
  };

  const handleArrowUpdate = (updatedArrow: Partial<ArrowData> & { id: string }) => {
    if (!canEdit) return;
    const existing = arrows.find(arrow => arrow.id === updatedArrow.id);
    updateState(
      items,
      arrows.map(arrow => arrow.id === updatedArrow.id ? { ...arrow, ...updatedArrow } : arrow)
    );
    if (existing) throttledWriteArrow({ ...existing, ...updatedArrow });
  }

  const handleItemClick = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      setSelectedItemIds(ids =>
        ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]
      );
    } else {
      setSelectedArrowIds([]);
      if (!selectedItemIds.includes(id) || selectedItemIds.length > 1) {
        setSelectedItemIds([id]);
      }
    }
  };

  const handleArrowClick = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      setSelectedArrowIds(ids =>
        ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]
      );
    } else {
      setSelectedItemIds([]);
      if (!selectedArrowIds.includes(id) || selectedArrowIds.length > 1) {
        setSelectedArrowIds([id]);
      }
    }
  };

  const handleItemDoubleClick = (item: CanvasItemData) => {
    if (item.type === 'board') {
      router.push(`/isogrid/${item.id}`);
    } else if (item.type === 'note') {
      setEditingNoteId(item.id);
    } else if (item.type === 'text' || item.type === 'todo' || item.type === 'link' || item.type === 'title') {
      setEditingItemId(item.id);
    }
  };

  const navigateToBoard = (boardIndex: number) => {
    const target = boardStack[boardIndex];
    if (target) router.push(`/isogrid/${target.id}`);
  };

  const handleSettingsChange = (newSettings: Partial<BoardSettings>) => {
    if (!canEdit) return;
    updateState(items, arrows, prevSettings => ({ ...prevSettings, ...newSettings }));
  };

  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    if (!canEdit) return;
    const pastedItems = event.clipboardData?.items;
    if (!pastedItems) return;

    for (let i = 0; i < pastedItems.length; i++) {
      if (pastedItems[i].type.indexOf('image') !== -1) {
        const blob = pastedItems[i].getAsFile();
        if (!blob) continue;

        // Show uploading feedback immediately
        toast({ title: "Uploading image…", duration: 8000 });

        try {
          // Measure dimensions first (needed for canvas item size)
          const tempUrl = URL.createObjectURL(blob);
          const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
            const img = new Image();
            img.onload = () => {
              const MAX_WIDTH = 400;
              const aspectRatio = img.naturalWidth / img.naturalHeight;
              const w = Math.min(img.naturalWidth, MAX_WIDTH);
              resolve({ width: w, height: w / aspectRatio });
              URL.revokeObjectURL(tempUrl);
            };
            img.onerror = () => { resolve({ width: 300, height: 200 }); URL.revokeObjectURL(tempUrl); };
            img.src = tempUrl;
          });

          // Upload blob directly to Firebase Storage — no base64 round-trip
          const itemId = nanoid();
          const storageRef = ref(storage, `canvas-images/${itemId}/${Date.now()}_paste`);
          const snapshot = await uploadBytes(storageRef, blob);
          const downloadURL = await getDownloadURL(snapshot.ref);

          const canvasCenter = screenToCanvas({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
          const newItem: CanvasItemData = {
            id: itemId,
            type: 'image',
            position: { x: canvasCenter.x - dimensions.width / 2, y: canvasCenter.y - dimensions.height / 2 },
            width: dimensions.width,
            height: dimensions.height,
            content: downloadURL,
            parentId: currentBoardId,
          };
          updateState(prev => [...prev, newItem], arrows);
          toast({ title: "Image pasted successfully!" });
        } catch (error) {
          console.error('Failed to upload pasted image:', error);
          toast({ variant: 'destructive', title: 'Failed to upload image', description: 'Please try again.' });
        }
        return;
      }
    }
  }, [screenToCanvas, toast, currentBoardId, arrows, items, updateState, storage, canEdit]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (arrowDrawingState.isDrawing) {
          setArrowDrawingState({ isDrawing: false, startPoint: null });
          setPreviewArrow(null);
        }
        setSelectedItemIds([]);
        setSelectedArrowIds([]);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('.ql-editor'); // Quill editor check

        if (!isInput) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [arrowDrawingState.isDrawing, undo, redo, handleDeleteSelected]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  useEffect(() => {
    const root = document.documentElement;
    if (accentColor) {
      root.style.setProperty('--primary', accentColor);
      root.style.setProperty('--accent', accentColor);
      root.style.setProperty('--ring', accentColor);
    }
  }, [accentColor]);

  const handleBoardNameChange = async (targetBoardId: string, newName: string) => {
    setEditingBoardId(null);
    if (!canEdit) return;
    setBoardStack(stack => stack.map(b => b.id === targetBoardId ? { ...b, name: newName } : b));

    const targetIndex = boardStack.findIndex(b => b.id === targetBoardId);
    const parentBoardId = targetIndex > 0 ? boardStack[targetIndex - 1].id : null;

    try {
      await updateBoardDoc(targetBoardId, { name: newName });
      if (parentBoardId) {
        await updateDoc(doc(db, 'boards', parentBoardId, 'items', targetBoardId), { content: newName });
      }
    } catch (error) {
      console.error('Error renaming board:', error);
      toast({ variant: 'destructive', title: 'Could not rename board' });
    }
  };

  const handleTodoDragStart = (sourceListId: string, todo: TodoListItem) => {
    setDraggedTodo({ sourceListId, todo });
  };

  const handleTodoDrop = (targetListId: string, targetTodoId?: string) => {
    if (!draggedTodo || !canEdit) return;

    const { sourceListId, todo } = draggedTodo;

    // Prevent dropping on the same list if just reordering
    if (sourceListId === targetListId && !targetTodoId) return;

    updateState(prevItems => {
      let newItems = [...prevItems];

      // Remove from source list
      const sourceListIndex = newItems.findIndex(item => item.id === sourceListId);
      if (sourceListIndex !== -1) {
        const sourceList = { ...newItems[sourceListIndex] };
        sourceList.todos = (sourceList.todos || []).filter(t => t.id !== todo.id);
        newItems[sourceListIndex] = sourceList;
      }

      // Add to target list
      const targetListIndex = newItems.findIndex(item => item.id === targetListId);
      if (targetListIndex !== -1) {
        const targetList = { ...newItems[targetListIndex] };
        let targetTodos = [...(targetList.todos || [])];

        if (targetTodoId) {
          // Insert at a specific position
          const dropIndex = targetTodos.findIndex(t => t.id === targetTodoId);
          if (dropIndex !== -1) {
            targetTodos.splice(dropIndex, 0, todo);
          } else {
            targetTodos.push(todo); // Fallback
          }
        } else {
          // Add to the end
          targetTodos.push(todo);
        }

        targetList.todos = targetTodos;
        newItems[targetListIndex] = targetList;
      }

      return newItems;
    }, arrows);

    setDraggedTodo(null);
    setDropTargetId(null);
  };

  const handleExport = () => {
    const dataToExport = {
      items,
      arrows,
      settings,
    };
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'isogrid-export.json';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported successfully!' });
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        if (Array.isArray(data.items) && Array.isArray(data.arrows)) {
          const newSettings = data.settings || INITIAL_SETTINGS;
          // Imports replace this board's own contents only — nested board items in
          // the imported JSON won't be independently navigable until they're
          // recreated as real boards/{id} docs (out of scope for this import path).
          updateState(data.items, data.arrows, newSettings);
          toast({ title: 'Import successful!' });
        } else {
          throw new Error('Invalid file format');
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Import failed',
          description: error instanceof Error ? error.message : 'Could not read the file.',
        });
      } finally {
        // Reset the file input value to allow re-importing the same file
        if (importInputRef.current) {
          importInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Sign-out failed',
        description: error.message,
      });
    }
  };


  const scaledGridSize = GRID_SIZE * viewState.zoom;

  const gridColorValue = gridColor ? hexToRgba(gridColor, gridOpacity) : `hsl(var(--muted-foreground) / ${gridOpacity})`;

  // Radial-gradient dots need a soft feather at the edge of the color stop, otherwise
  // the circle is rasterized with a hard 1px cutoff and looks jagged/pixelated.
  const gridBackgroundImage = gridStyle === 'dots'
    ? `radial-gradient(${gridColorValue} ${gridThickness}px, transparent ${gridThickness + 1}px)`
    : `linear-gradient(${gridColorValue} ${gridThickness}px, transparent ${gridThickness}px), linear-gradient(90deg, ${gridColorValue} ${gridThickness}px, transparent ${gridThickness}px)`;

  const gridStyleProps: React.CSSProperties = {
    backgroundImage: gridBackgroundImage,
    backgroundSize: `${scaledGridSize}px ${scaledGridSize}px`,
    backgroundPosition: `${viewState.pan.x % scaledGridSize}px ${viewState.pan.y % scaledGridSize}px`,
  };

  const getCursor = () => {
    if (arrowDrawingState.isDrawing) return 'crosshair';
    if (selectionBox?.visible) return 'crosshair';
    return 'grab';
  }

  const handleCanvasClick = (e: MouseEvent<HTMLDivElement>) => {
    if (contextMenu.show) {
      setContextMenu({ ...contextMenu, show: false });
    }
  };

  const selectedItems = items.filter(item => selectedItemIds.includes(item.id));

  if (authLoading || isBoardLoading || !user) {
    return (
      <main className="w-screen h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main
      className="w-screen h-screen overflow-hidden bg-background relative flex flex-col"
      style={canvasBackgroundColor ? { backgroundColor: canvasBackgroundColor } : undefined}
      onDragOver={(e) => {
        if (draggedTodo) e.preventDefault();
      }}
      onDrop={() => {
        setDraggedTodo(null);
        setDropTargetId(null);
      }}
    >
      <input
        type="file"
        ref={importInputRef}
        className="hidden"
        accept=".json"
        onChange={handleFileChange}
      />
      <div
        ref={canvasRef}
        className="w-full flex-1"
        style={{ cursor: getCursor() }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => updateCursor(null)}
        onContextMenu={handleContextMenu}
        onClick={handleCanvasClick}
        onWheel={handleWheel}
      >
        <div data-is-canvas-backdrop="true" className="absolute inset-0 w-full h-full" />
        {showGrid && (
          <div
            data-is-canvas-backdrop="true"
            className="fixed inset-0 w-full h-full pointer-events-none"
            style={gridStyleProps}
          />
        )}

        <div
          data-is-canvas-backdrop="true"
          className="w-full h-full relative"
          style={{ transform: `translate(${viewState.pan.x}px, ${viewState.pan.y}px) scale(${viewState.zoom})`, transformOrigin: '0 0' }}
        >
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" />
              </marker>
            </defs>

            {previewArrow && (
              <line
                x1={previewArrow.start.x}
                y1={previewArrow.start.y}
                x2={previewArrow.end.x}
                y2={previewArrow.end.y}
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            )}
            {filteredArrows.map(arrow => (
              <InteractiveArrow
                key={arrow.id}
                arrow={arrow}
                zoom={viewState.zoom}
                onUpdate={handleArrowUpdate}
                onClick={(e) => handleArrowClick(arrow.id, e)}
                isSelected={selectedArrowIds.includes(arrow.id)}
              />
            ))}
          </svg>

          {filteredItems.map(item => (
            <CanvasItem
              key={item.id}
              item={item}
              zoom={viewState.zoom}
              gridSize={GRID_SIZE}
              snapToGrid={snapToGrid}
              onUpdate={handleItemUpdate}
              onClick={(e) => handleItemClick(item.id, e)}
              onDoubleClick={() => handleItemDoubleClick(item)}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, show: true, itemId: item.id }) }}
              isSelected={selectedItemIds.includes(item.id)}
              isEditing={editingItemId === item.id}
              onEditEnd={() => setEditingItemId(null)}
              onTodoDragStart={handleTodoDragStart}
              onTodoDrop={handleTodoDrop}
              isDropTarget={dropTargetId === item.id}
              onDragEnter={() => draggedTodo && draggedTodo.sourceListId !== item.id && setDropTargetId(item.id)}
              onDragLeave={() => setDropTargetId(null)}
              settings={settings}
              onTextareaFocus={setActiveTextarea}
              isGuest={false}
            />
          ))}

          <PresenceCursors peers={peers} zoom={viewState.zoom} />
        </div>

      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: `inset 0 0 10vw 5vw hsl(0 0% 0% / ${vignetteIntensity})` }}
      />
      {selectionBox && selectionBox.visible && <SelectionBox start={selectionBox.start} end={selectionBox.end} />}

      <MoveToBoardDialog
        isOpen={moveDialog.show}
        onClose={() => setMoveDialog({ show: false, itemId: null })}
        onMove={handleMoveItem}
        boards={userBoards
          .filter(b => b.id !== boardStack[0]?.id)
          .map(b => ({ id: b.id, name: b.name, parentId: b.parentId === boardStack[0]?.id ? null : b.parentId }))}
        currentBoardId={currentBoardId === boardStack[0]?.id ? null : currentBoardId}
        movingItemId={moveDialog.itemId}
      />

      {boardMeta && (
        <ShareDialog
          isOpen={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          boardId={boardId}
          ownerId={boardMeta.ownerId}
          collaborators={boardMeta.collaborators}
          isOwner={isOwner}
          currentUserEmail={user?.email}
          onCollaboratorsChange={(updater) => setBoardMeta(prev => prev ? { ...prev, collaborators: updater(prev.collaborators) } : prev)}
        />
      )}

      {/* User Greeting */}
      <div className="absolute top-8 left-8 z-10 text-white font-bold text-3xl">
        {user?.displayName
          ? `Hi ${user.displayName.split(' ')[0]}`
          : user?.email
            ? `Welcome ${user.email.split('@')[0]}`
            : 'Welcome'}
      </div>

      {/* Top Right Navbar */}
      <div className="absolute top-4 right-4 z-10 p-1 rounded-lg bg-background/80 backdrop-blur-sm flex items-center gap-1">
        <div className="flex items-center text-sm text-foreground px-2">
          {boardStack.map((board, index) => (
            <div key={board.id} className="flex items-center space-x-2">
              {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}

              {editingBoardId === board.id ? (
                <Input
                  type="text"
                  defaultValue={board.name}
                  autoFocus
                  onBlur={(e) => handleBoardNameChange(board.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleBoardNameChange(board.id, e.currentTarget.value);
                    if (e.key === 'Escape') setEditingBoardId(null);
                  }}
                  className="h-auto p-0 text-sm bg-transparent border-primary"
                />
              ) : (
                <Button
                  variant="link"
                  className="p-0 h-auto text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  onClick={() => navigateToBoard(index)}
                  onDoubleClick={() => setEditingBoardId(board.id)}
                >
                  {index === 0 ? <Home className="w-4 h-4" /> : board.name}
                </Button>
              )}
            </div>
          ))}
        </div>

        {boardMeta && (
          <Button variant="ghost" size="icon" onClick={() => setShareDialogOpen(true)} title="Share board">
            <Share2 className="w-5 h-5" />
          </Button>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon">
              <Cog className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="min-w-[20rem] max-w-md max-h-[70vh] overflow-y-auto" style={{ width: 'auto' }}>
            <div className="space-y-4">
              <div className="space-y-4">
                <SettingsPopover
                  settings={settings}
                  onSettingsChange={handleSettingsChange}
                  zoom={viewState.zoom}
                  onZoomChange={handleZoom}
                  onExport={handleExport}
                  onImport={handleImportClick}
                  onSignOut={handleSignOut}
                  isGuest={false}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {contextMenu.show && <ContextMenu x={contextMenu.x} y={contextMenu.y} onAction={handleContextMenuAction} isItemMenu={!!contextMenu.itemId} itemType={allCanvasItems.find(i => i.id === contextMenu.itemId)?.type} accentColor={accentColor} />}
      {(selectedItems.length > 0 || activeTextarea) && (
        <FormattingToolbar
          items={selectedItems}
          onUpdate={handleItemsUpdate}
          activeTextarea={activeTextarea}
          onTextareaUpdate={handleItemUpdate}
          onBlur={() => setActiveTextarea(null)}
        />
      )}
      {editingNoteId && (
        <NoteEditor
          initialContent={items.find(i => i.id === editingNoteId)?.content || ''}
          initialTitle={items.find(i => i.id === editingNoteId)?.noteTitle || 'Untitled Note'}
          onSave={(content, title) => {
            handleItemUpdate({ id: editingNoteId, content, noteTitle: title });
          }}
          onClose={() => setEditingNoteId(null)}
        />
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedItemIds.length + selectedArrowIds.length} item{selectedItemIds.length + selectedArrowIds.length > 1 ? 's' : ''} from your canvas. This action can be undone with Ctrl+Z.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
