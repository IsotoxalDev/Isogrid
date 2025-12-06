"use client";

import { useState, useRef, useEffect, useCallback, type MouseEvent } from 'react';
import {
  CanvasItemData,
  Point,
  ViewState,
  ArrowData,
  CanvasItemType,
  Board,
  BoardSettings,
  AnyCanvasItem,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import CanvasItem from '@/components/canvas/canvas-item';
import ContextMenu from '@/components/canvas/context-menu';
import ArrowRenderer from '@/components/canvas/arrow-renderer';
import Toolbar from '@/components/canvas/toolbar';
import SettingsPopover from '@/components/canvas/settings-popover';
import { useToast } from '@/hooks/use-toast';
import { ChevronRight, Home, Cog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import SelectionBox from '@/components/canvas/selection-box';

const INITIAL_ITEMS: CanvasItemData[] = [
  {
    id: 'item-1',
    type: 'text',
    position: { x: 100, y: 150 },
    width: 250,
    height: 120,
    content: 'Welcome to CanvasCraft! \n\nRight-click to add items. Double-click an item to edit it.',
    parentId: null,
  },
  {
    id: 'item-2',
    type: 'board',
    position: { x: 500, y: 100 },
    width: 300,
    height: 200,
    content: 'My First Board',
    parentId: null,
  },
  {
    id: 'item-3',
    type: 'image',
    position: { x: 150, y: 400 },
    width: 300,
    height: 200,
    content: PlaceHolderImages[0].imageUrl,
    parentId: null,
  },
];

const INITIAL_ARROWS: ArrowData[] = [
  { id: 'arrow-1', type: 'arrow', start: { x: 360, y: 210 }, end: {x: 490, y: 200}, parentId: null },
];

const ROOT_BOARD: Board = { id: 'root', name: 'Home', settings: { accentColor: '73 56% 60%', showGrid: true, gridStyle: 'dots', gridOpacity: 0.5, vignetteStrength: 100 } };

const GRID_SIZE = 40;

type HistoryState = {
  items: CanvasItemData[];
  arrows: ArrowData[];
};

type ArrowDrawingState = {
    isDrawing: boolean;
    startPoint: Point | null;
}

export default function CanvasCraftPage() {
  const [items, setItems] = useState<CanvasItemData[]>(INITIAL_ITEMS);
  const [arrows, setArrows] = useState<ArrowData[]>(INITIAL_ARROWS);
  const [boardStack, setBoardStack] = useState<Board[]>([ROOT_BOARD]);
  
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const [viewState, setViewState] = useState<ViewState>({ zoom: 1, pan: { x: 0, y: 0 } });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; show: boolean; itemId?: string }>({ x: 0, y: 0, show: false });
  const [arrowDrawingState, setArrowDrawingState] = useState<ArrowDrawingState>({ isDrawing: false, startPoint: null });
  const [previewArrow, setPreviewArrow] = useState<ArrowData | null>(null);
  
  const [selectionBox, setSelectionBox] = useState<{ start: Point; end: Point; visible: boolean } | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastPanPoint = useRef<Point>({ x: 0, y: 0 });
  const rightClickDragInfo = useRef<{ isDragging: boolean; itemId?: string }>({ isDragging: false });
  const { toast } = useToast();

  const currentBoard = boardStack[boardStack.length - 1];
  const currentBoardId = currentBoard.id === 'root' ? null : currentBoard.id;
  
  const combinedSettings = boardStack.reduce((acc, board) => ({ ...acc, ...board.settings }), {} as BoardSettings);
  const { showGrid = true, gridStyle = 'dots', gridOpacity = 0.5, accentColor, vignetteStrength = 100 } = combinedSettings;

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
  
  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const previousState = history[newIndex];
      setItems(previousState.items);
      setArrows(previousState.arrows);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const nextState = history[newIndex];
      setItems(nextState.items);
      setArrows(nextState.arrows);
    }
  };

  useEffect(() => {
    setHistory([{ items, arrows }]);
    setHistoryIndex(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 ? viewState.zoom * zoomFactor : viewState.zoom / zoomFactor;
    const clampedZoom = Math.max(0.1, Math.min(5, newZoom));

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

    if (arrowDrawingState.isDrawing) {
        const canvasPos = screenToCanvas({ x: e.clientX, y: e.clientY });
        if (!arrowDrawingState.startPoint) {
            setArrowDrawingState(s => ({ ...s, startPoint: canvasPos }));
            setPreviewArrow({ id: 'preview-arrow', type: 'arrow', start: canvasPos, end: canvasPos, parentId: currentBoardId });
        } else {
            const newArrow: ArrowData = {
                id: `arrow-${Date.now()}`,
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

    if (e.button === 0 && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        const isCanvasClick = target === canvasRef.current || target.dataset.isCanvasBackdrop;

        if (isCanvasClick) {
            const startPoint = { x: e.clientX, y: e.clientY };
            setSelectionBox({ start: startPoint, end: startPoint, visible: true });
            e.stopPropagation();
            return;
        }
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
    if (selectionBox && selectionBox.visible) {
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
    if (selectionBox && selectionBox.visible) {
        const startCanvas = screenToCanvas(selectionBox.start);
        const endCanvas = screenToCanvas(selectionBox.end);

        const selectionRect = {
            x: Math.min(startCanvas.x, endCanvas.x),
            y: Math.min(startCanvas.y, endCanvas.y),
            width: Math.abs(startCanvas.x - endCanvas.x),
            height: Math.abs(startCanvas.y - endCanvas.y),
        };

        const selected = filteredItems.filter(item => {
            const itemRect = { x: item.position.x, y: item.position.y, width: item.width, height: item.height };
            return (
                itemRect.x + itemRect.width > selectionRect.x &&
                itemRect.x < selectionRect.x + selectionRect.width &&
                itemRect.y + itemRect.height > selectionRect.y &&
                itemRect.y < selectionRect.y + selectionRect.height
            );
        }).map(item => item.id);
        
        setSelectedItemIds(selected);
        setSelectionBox(null);
    }
    isPanning.current = false;
    e.currentTarget.style.cursor = 'grab';
    
    if (e.button === 2 && !rightClickDragInfo.current.isDragging) {
        if (arrowDrawingState.isDrawing) {
            setArrowDrawingState({ isDrawing: false, startPoint: null });
            setPreviewArrow(null);
        } else {
            const clickedItem = (e.target as HTMLElement).closest('[data-item-id]');
            const itemId = clickedItem ? clickedItem.getAttribute('data-item-id') : undefined;
            setContextMenu({ x: e.clientX, y: e.clientY, show: true, itemId: itemId || undefined });
        }
    }
    rightClickDragInfo.current = { isDragging: false };
  };
  
  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const addItem = (type: Extract<CanvasItemType, 'text' | 'image' | 'board'>, position: Point) => {
    const newItem: CanvasItemData = {
      id: `item-${Date.now()}`,
      type,
      position,
      width: type === 'image' || type === 'board' ? 300 : 250,
      height: type === 'image' || type === 'board' ? 200 : 100,
      content: type === 'text' ? 'New Text' : type === 'board' ? 'New Board' : PlaceHolderImages[0].imageUrl,
      parentId: currentBoardId
    };
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

  const handleContextMenuAction = (action: Extract<CanvasItemType, 'text' | 'image' | 'board' | 'arrow'> | 'delete' | 'enter') => {
    const canvasPos = screenToCanvas({ x: contextMenu.x, y: contextMenu.y });

    if (action === 'delete' && contextMenu.itemId) {
      deleteItem(contextMenu.itemId);
      return;
    }
    if (action === 'enter' && contextMenu.itemId) {
        const item = items.find(i => i.id === contextMenu.itemId);
        if (item) handleItemDoubleClick(item);
        return;
    }

    setContextMenu({ ...contextMenu, show: false });
    
    if (action === 'arrow') {
        setArrowDrawingState({ isDrawing: true, startPoint: null });
    } else if (action !== 'delete' && action !== 'enter') {
        addItem(action, canvasPos);
    }
  };

  const handleItemUpdate = (updatedItem: Partial<CanvasItemData> & { id: string }) => {
    updateState(
      items.map(item => item.id === updatedItem.id ? { ...item, ...updatedItem } : item),
      arrows
    );
  };
  
  const handleItemClick = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
        setSelectedItemIds(ids => 
            ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]
        );
    } else {
        if (!selectedItemIds.includes(id)) {
            setSelectedItemIds([id]);
        }
    }
  };
  
  const handleItemDoubleClick = (item: CanvasItemData) => {
      if (item.type === 'board') {
          const newBoard: Board = {id: item.id, name: item.content, settings: { accentColor: accentColor, showGrid: true, gridStyle: 'dots', gridOpacity: 0.5, vignetteStrength: 100 }};
          setBoardStack(stack => [...stack, newBoard]);
          setViewState({ zoom: 1, pan: { x: 0, y: 0 } });
          setHistory([{ items, arrows }]);
          setHistoryIndex(0);
      }
  };

  const navigateToBoard = (boardIndex: number) => {
      setBoardStack(stack => stack.slice(0, boardIndex + 1));
      setViewState({ zoom: 1, pan: { x: 0, y: 0 } });
      setHistory([{ items, arrows }]);
      setHistoryIndex(0);
  };

  const handleBoardSettingsChange = (newSettings: Partial<BoardSettings>) => {
    setBoardStack(stack => {
        const newStack = [...stack];
        const currentBoardIndex = newStack.length - 1;
        newStack[currentBoardIndex] = {
            ...newStack[currentBoardIndex],
            settings: {
                ...newStack[currentBoardIndex].settings,
                ...newSettings
            }
        };
        return newStack;
    });
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
                        id: `item-${Date.now()}`,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenToCanvas, toast, currentBoardId, arrows]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (arrowDrawingState.isDrawing) {
            setArrowDrawingState({ isDrawing: false, startPoint: null });
            setPreviewArrow(null);
        }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyIndex, history.length, arrowDrawingState.isDrawing]);
  
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
      if (contextMenu.show) setContextMenu({ ...contextMenu, show: false });
      
      const target = e.target as HTMLElement;
      const isCanvasClick = target === canvasRef.current || target.dataset.isCanvasBackdrop;

      if(isCanvasClick && !selectionBox) {
          setSelectedItemIds([]);
      }
  }

  return (
    <main
      className="w-screen h-screen overflow-hidden bg-background relative"
    >
      <div
        ref={canvasRef}
        className={cn(
          "w-full h-full",
        )}
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

          {vignetteStrength > 0 && (
            <div
              data-is-canvas-backdrop="true"
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{
                background: `radial-gradient(circle, transparent 40%, hsl(var(--background) / ${vignetteStrength/100}) 100%)`,
                opacity: 1,
              }}
            />
          )}
          <div 
            className="w-full h-full relative"
            style={{ transform: `translate(${viewState.pan.x}px, ${viewState.pan.y}px) scale(${viewState.zoom})`, transformOrigin: '0 0' }}
          >
              <ArrowRenderer arrows={[...filteredArrows, ...(previewArrow ? [previewArrow] : [])]} />

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
                  />
              ))}
          </div>

      </div>
      {selectionBox && selectionBox.visible && <SelectionBox start={selectionBox.start} end={selectionBox.end} />}
      <div className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-background/80 backdrop-blur-sm flex items-center space-x-2">
          <div className="flex items-center space-x-2 text-sm text-foreground">
              {boardStack.map((board, index) => (
                  <div key={board.id} className="flex items-center space-x-2">
                      {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <Button variant="link" className="p-0 h-auto text-sm" onClick={() => navigateToBoard(index)}>
                        {board.id === 'root' && <Home className="w-4 h-4 mr-2" />}
                        {board.name}
                      </Button>
                  </div>
              ))}
          </div>
          <Popover>
              <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon">
                      <Cog className="w-5 h-5"/>
                  </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                 <SettingsPopover settings={combinedSettings} onSettingsChange={handleBoardSettingsChange} />
              </PopoverContent>
          </Popover>
      </div>
      {contextMenu.show && <ContextMenu x={contextMenu.x} y={contextMenu.y} onAction={handleContextMenuAction} isItemMenu={!!contextMenu.itemId} itemType={allCanvasItems.find(i=>i.id===contextMenu.itemId)?.type} accentColor={accentColor} />}
      
      <Toolbar settings={combinedSettings} onSettingsChange={handleBoardSettingsChange} />
    </main>
  );
}

    