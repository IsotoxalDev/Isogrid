
"use client";

import { useState, useRef, useEffect, useCallback, type MouseEvent, DragEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  CanvasItemData,
  Point,
  ViewState,
  ArrowData,
  CanvasItemType,
  Board,
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
import { ChevronRight, Home, Cog, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import SelectionBox from '@/components/canvas/selection-box';
import InteractiveArrow from '@/components/canvas/interactive-arrow';
import { Input } from '@/components/ui/input';
import FormattingToolbar from '@/components/canvas/formatting-toolbar';
import { auth, saveCanvasData, loadCanvasData } from '@/lib/firebase';
import { signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { nanoid } from 'nanoid';

const INITIAL_ITEMS: CanvasItemData[] = [];

const INITIAL_ARROWS: ArrowData[] = [];

const INITIAL_SETTINGS: BoardSettings = { 
  accentColor: '72 56% 63%', 
  showGrid: true, 
  gridStyle: 'dots', 
  gridOpacity: 0.5, 
  vignetteIntensity: 0.5,
  defaultOpacity: 1,
  defaultBackgroundBlur: 0
};

const ROOT_BOARD: Board = { id: 'root', name: 'Home' };

const GRID_SIZE = 40;

type HistoryState = {
  items: CanvasItemData[];
  arrows: ArrowData[];
};

type ArrowDrawingState = {
    isDrawing: boolean;
    startPoint: Point | null;
}

type DraggedTodoInfo = {
  sourceListId: string;
  todo: TodoListItem;
};


export default function IsogridPage() {
  const [items, setItems] = useState<CanvasItemData[]>(INITIAL_ITEMS);
  const [arrows, setArrows] = useState<ArrowData[]>(INITIAL_ARROWS);
  const [boardStack, setBoardStack] = useState<Board[]>([ROOT_BOARD]);
  
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const [settings, setSettings] = useState<BoardSettings>(INITIAL_SETTINGS);

  const [viewState, setViewState] = useState<ViewState>({ zoom: 1, pan: { x: 0, y: 0 } });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; show: boolean; itemId?: string }>({ x: 0, y: 0, show: false });
  const [arrowDrawingState, setArrowDrawingState] = useState<ArrowDrawingState>({ isDrawing: false, startPoint: null });
  const [previewArrow, setPreviewArrow] = useState<ArrowData | null>(null);
  
  const [selectionBox, setSelectionBox] = useState<{ start: Point; end: Point; visible: boolean } | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedArrowIds, setSelectedArrowIds] = useState<string[]>([]);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [activeTextarea, setActiveTextarea] = useState<HTMLTextAreaElement | null>(null);


  const [draggedTodo, setDraggedTodo] = useState<DraggedTodoInfo | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastPanPoint = useRef<Point>({ x: 0, y: 0 });
  const rightClickDragInfo = useRef<{ isDragging: boolean; itemId?: string }>({ isDragging: false });
  const importInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  const currentBoard = boardStack[boardStack.length - 1];
  const currentBoardId = currentBoard.id === 'root' ? null : currentBoard.id;
  
  const { showGrid = true, gridStyle = 'dots', gridOpacity = 0.5, accentColor, vignetteIntensity = 0.5 } = settings;

  // --- Data Persistence ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const savedData = await loadCanvasData(user.uid);
        if (savedData) {
          setItems(savedData.items || []);
          setArrows(savedData.arrows || []);
        }
        setHistory([{ items: savedData?.items || [], arrows: savedData?.arrows || []}]);
        setHistoryIndex(0);
        setIsLoading(false);
      } else {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const useDebouncedEffect = (effect: () => void, deps: any[], delay: number) => {
    useEffect(() => {
        const handler = setTimeout(() => effect(), delay);
        return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...(deps || []), delay]);
  };
  
  useDebouncedEffect(() => {
      if (currentUser && !isLoading) {
          saveCanvasData(currentUser.uid, { items, arrows });
      }
  }, [items, arrows, currentUser, isLoading], 1000);
  
  // --- END Data Persistence ---
  
  const updateState = (newItems: CanvasItemData[] | ((prev: CanvasItemData[]) => CanvasItemData[]), newArrows: ArrowData[] | ((prev: ArrowData[]) => ArrowData[])) => {
    const updatedItems = typeof newItems === 'function' ? newItems(items) : newItems;
    const updatedArrows = typeof newArrows === 'function' ? newArrows(arrows) : newArrows;

    const newHistoryEntry = { items: updatedItems, arrows: updatedArrows };
    const newHistory = [...history.slice(0, historyIndex + 1), newHistoryEntry];
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    setItems(updatedItems);
    setArrows(updatedArrows);
  };
  
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const previousState = history[newIndex];
      setItems(previousState.items);
      setArrows(previousState.arrows);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const nextState = history[newIndex];
      setItems(nextState.items);
      setArrows(nextState.arrows);
    }
  }, [history, historyIndex]);

  const filteredItems = items.filter(item => item.parentId === currentBoardId);
  const filteredArrows = arrows.filter(arrow => arrow.parentId === currentBoardId);
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
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 ? viewState.zoom * zoomFactor : viewState.zoom / zoomFactor;
    const clampedZoom = Math.max(0.5, Math.min(3, newZoom));

    const mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const mouseOnCanvasBeforeZoom = {
        x: (mousePos.x - viewState.pan.x) / viewState.zoom,
        y: (mousePos.y - viewState.pan.y) / viewState.zoom
    };
    
    const newPan = {
      x: mousePos.x - mouseOnCanvasBeforeZoom.x * clampedZoom,
      y: mousePos.y - mouseOnCanvasBeforeZoom.y * clampedZoom
    };

    setViewState({ zoom: clampedZoom, pan: newPan });
  };
  
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
    if(e.buttons === 2 && !rightClickDragInfo.current.isDragging) {
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
    
    if (e.button === 2 && !rightClickDragInfo.current.isDragging) {
        if (arrowDrawingState.isDrawing) {
            setArrowDrawingState({ isDrawing: false, startPoint: null });
            setPreviewArrow(null);
        } else {
            const clickedItem = (e.target as HTMLElement).closest('[data-item-id], [data-arrow-id]');
            const itemId = clickedItem ? (clickedItem.getAttribute('data-item-id') || clickedItem.getAttribute('data-arrow-id')) : undefined;
            setContextMenu({ x: e.clientX, y: e.clientY, show: true, itemId: itemId || undefined });
        }
    }
    rightClickDragInfo.current = { isDragging: false };
  };
  
  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const addItem = (type: Extract<CanvasItemType, 'text' | 'image' | 'board' | 'todo' | 'link'>, position: Point) => {
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
        width: 300,
        height: 'auto',
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
    } else {
      newItem = {
        ...baseItem,
        type,
        width: type === 'image' || type === 'board' ? 300 : 250,
        height: type === 'image' || type === 'board' ? 200 : 100,
        content: type === 'text' ? 'New Text' : type === 'board' ? 'New Board' : PlaceHolderImages[0].imageUrl,
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
  };

  const deleteItem = (itemId: string) => {
    updateState(
        items.filter(item => item.id !== itemId),
        arrows.filter(arrow => arrow.id !== itemId)
    );
    setContextMenu({ ...contextMenu, show: false });
  }

  const handleContextMenuAction = (action: Extract<CanvasItemType, 'text' | 'image' | 'board' | 'arrow' | 'todo' | 'link'> | 'delete' | 'enter' | 'edit') => {
    const canvasPos = screenToCanvas({ x: contextMenu.x, y: contextMenu.y });

    if (action === 'delete' && contextMenu.itemId) {
      deleteItem(contextMenu.itemId);
      return;
    }
    if (action === 'enter' && contextMenu.itemId) {
        const item = items.find(i => i.id === contextMenu.itemId);
        if (item && item.type === 'board') {
            const newBoard: Board = { id: item.id, name: item.content };
            setBoardStack(stack => [...stack, newBoard]);
            setViewState({ zoom: 1, pan: { x: 0, y: 0 } });
            setHistory([{ items, arrows }]);
            setHistoryIndex(0);
            setSelectedItemIds([]);
            setSelectedArrowIds([]);
        }
        setContextMenu({ ...contextMenu, show: false });
        return;
    }
    if (action === 'edit' && contextMenu.itemId) {
        setEditingItemId(contextMenu.itemId);
        setContextMenu({ ...contextMenu, show: false });
        return;
    }

    setContextMenu({ ...contextMenu, show: false });
    
    if (action === 'arrow') {
        setArrowDrawingState({ isDrawing: true, startPoint: null });
    } else if (action !== 'delete' && action !== 'enter' && action !== 'edit') {
        addItem(action, canvasPos);
    }
  };

  const handleItemUpdate = (updatedItem: Partial<CanvasItemData> & { id: string }) => {
    updateState(
      items.map(item => item.id === updatedItem.id ? { ...item, ...updatedItem } : item),
      arrows
    );
  };
  
  const handleItemsUpdate = (updates: (Partial<CanvasItemData> & { id: string })[]) => {
    updateState(
      items.map(item => {
        const update = updates.find(u => u.id === item.id);
        return update ? { ...item, ...update } : item;
      }),
      arrows
    );
  };

  const handleArrowUpdate = (updatedArrow: Partial<ArrowData> & { id: string }) => {
    updateState(
        items,
        arrows.map(arrow => arrow.id === updatedArrow.id ? { ...arrow, ...updatedArrow } : arrow)
    );
  }
  
  const handleItemClick = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setSelectedArrowIds([]);
    if (e.ctrlKey || e.metaKey) {
        setSelectedItemIds(ids => 
            ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]
        );
    } else {
        if (!selectedItemIds.includes(id) || selectedItemIds.length > 1) {
            setSelectedItemIds([id]);
        }
    }
  };
  
  const handleArrowClick = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setSelectedItemIds([]);
    if (e.ctrlKey || e.metaKey) {
        setSelectedArrowIds(ids =>
            ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]
        );
    } else {
        if (!selectedArrowIds.includes(id) || selectedArrowIds.length > 1) {
            setSelectedArrowIds([id]);
        }
    }
  };
  
  const handleItemDoubleClick = (item: CanvasItemData) => {
    if (item.type === 'board') {
      const newBoard: Board = { id: item.id, name: item.content };
      setBoardStack(stack => [...stack, newBoard]);
      setViewState({ zoom: 1, pan: { x: 0, y: 0 } });
      setHistory([{ items, arrows }]);
      setHistoryIndex(0);
      setSelectedItemIds([]);
      setSelectedArrowIds([]);
    } else if (item.type === 'text' || item.type === 'todo' || item.type === 'link') {
      setEditingItemId(item.id);
    }
  };

  const navigateToBoard = (boardIndex: number) => {
      setBoardStack(stack => stack.slice(0, boardIndex + 1));
      setViewState({ zoom: 1, pan: { x: 0, y: 0 } });
      setHistory([{ items, arrows }]);
      setHistoryIndex(0);
      setSelectedItemIds([]);
      setSelectedArrowIds([]);
  };

  const handleSettingsChange = (newSettings: Partial<BoardSettings>) => {
    setSettings(s => ({ ...s, ...newSettings }));
  };
  
  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    const pastedItems = event.clipboardData?.items;
    if (!pastedItems) return;

    for (let i = 0; i < pastedItems.length; i++) {
        if (pastedItems[i].type.indexOf('image') !== -1) {
            const blob = pastedItems[i].getAsFile();
            if (!blob) continue;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const src = e.target?.result as string;
                if (!src) return;
                
                const img = new Image();
                img.onload = () => {
                    const MAX_WIDTH = 400;
                    const aspectRatio = img.naturalWidth / img.naturalHeight;
                    const width = Math.min(img.naturalWidth, MAX_WIDTH);
                    const height = width / aspectRatio;

                    const canvasCenter = screenToCanvas({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
                    
                    const newItem: CanvasItemData = {
                        id: nanoid(),
                        type: 'image',
                        position: {x: canvasCenter.x - width/2, y: canvasCenter.y - height/2},
                        width: width,
                        height: height,
                        content: src,
                        parentId: currentBoardId,
                    };
                    updateState(prev => [...prev, newItem], arrows);
                    toast({ title: "Image pasted successfully!" });
                };
                img.src = src;
            };
            reader.readAsDataURL(blob);
            return;
        }
    }
  }, [screenToCanvas, toast, currentBoardId, arrows, items, updateState]);

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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [arrowDrawingState.isDrawing, undo, redo]);
  
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

  const handleBoardNameChange = (boardId: string, newName: string) => {
    // Update the item content
    handleItemUpdate({ id: boardId, content: newName });
    
    // Update the boardStack
    setBoardStack(stack => stack.map(b => b.id === boardId ? { ...b, name: newName } : b));

    setEditingBoardId(null);
  };
  
  const handleTodoDragStart = (sourceListId: string, todo: TodoListItem) => {
    setDraggedTodo({ sourceListId, todo });
  };

  const handleTodoDrop = (targetListId: string, targetTodoId?: string) => {
    if (!draggedTodo) return;
  
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
          updateState(data.items, data.arrows);
          toast({ title: 'Import successful!' });
          // Reset board stack to root after import
          setBoardStack([ROOT_BOARD]);
          setViewState({ zoom: 1, pan: { x: 0, y: 0 } });
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
  
  const gridBackgroundImage = gridStyle === 'dots' 
    ? `radial-gradient(hsl(var(--muted-foreground) / ${gridOpacity}) 1px, transparent 0)`
    : `linear-gradient(hsl(var(--muted-foreground) / ${gridOpacity}) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--muted-foreground) / ${gridOpacity}) 1px, transparent 1px)`;
  
  const gridStyleProps: React.CSSProperties = {
    backgroundImage: gridBackgroundImage,
    backgroundSize: `${scaledGridSize}px ${scaledGridSize}px`,
    backgroundPosition: `${viewState.pan.x % scaledGridSize}px ${viewState.pan.y % scaledGridSize}px`,
  };

  const getCursor = () => {
    if (arrowDrawingState.isDrawing) return 'crosshair';
    if(selectionBox?.visible) return 'crosshair';
    return 'grab';
  }

  const handleCanvasClick = (e: MouseEvent<HTMLDivElement>) => {
    if (contextMenu.show) {
      setContextMenu({ ...contextMenu, show: false });
    }
  };

  const selectedItems = items.filter(item => selectedItemIds.includes(item.id));
  const selectedTextItems = selectedItems.filter(item => item.type === 'text');

  if (isLoading || !currentUser) {
    return (
        <main className="w-screen h-screen flex items-center justify-center bg-background">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
    );
  }

  return (
    <main
      className="w-screen h-screen overflow-hidden bg-background relative"
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
        className="w-full h-full"
        style={{ cursor: getCursor() }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        onClick={handleCanvasClick}
      >
          <div data-is-canvas-backdrop="true" className="absolute inset-0 w-full h-full" />
          {showGrid && (
              <div
                  data-is-canvas-backdrop="true"
                  className="absolute inset-0 w-full h-full"
                  style={gridStyleProps}
              />
          )}

          <div 
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
                      onUpdate={handleItemUpdate}
                      onClick={(e) => handleItemClick(item.id, e)}
                      onDoubleClick={() => handleItemDoubleClick(item)}
                      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({x: e.clientX, y: e.clientY, show: true, itemId: item.id})}}
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
                  />
              ))}
          </div>

      </div>
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: `inset 0 0 10vw 5vw hsl(0 0% 0% / ${vignetteIntensity})`}}
      />
      {selectionBox && selectionBox.visible && <SelectionBox start={selectionBox.start} end={selectionBox.end} />}
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
                            className="p-0 h-auto text-sm"
                            onClick={() => navigateToBoard(index)}
                            onDoubleClick={() => {
                                if (board.id !== 'root') {
                                    setEditingBoardId(board.id);
                                }
                            }}
                        >
                            {board.id === 'root' ? <Home className="w-4 h-4" /> : board.name}
                        </Button>
                    )}
                </div>
            ))}
        </div>

        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Cog className="w-5 h-5"/>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-[70vh] overflow-y-auto">
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
                    />
                  </div>
              </div>
            </PopoverContent>
        </Popover>
      </div>
      {contextMenu.show && <ContextMenu x={contextMenu.x} y={contextMenu.y} onAction={handleContextMenuAction} isItemMenu={!!contextMenu.itemId} itemType={allCanvasItems.find(i=>i.id===contextMenu.itemId)?.type} accentColor={accentColor} />}
      {(selectedTextItems.length > 0 || activeTextarea) && (
        <FormattingToolbar
          items={selectedTextItems}
          onUpdate={handleItemsUpdate}
          activeTextarea={activeTextarea}
          onTextareaUpdate={handleItemUpdate}
          onBlur={() => setActiveTextarea(null)}
        />
      )}
    </main>
  );
}
