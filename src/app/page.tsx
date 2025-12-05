"use client";

import { useState, useRef, useEffect, useCallback, type MouseEvent } from 'react';
import {
  CanvasItemData,
  Point,
  ViewState,
  ArrowData,
  ConnectionState,
  CanvasItemType,
  Board,
  BoardSettings,
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

const INITIAL_ITEMS: CanvasItemData[] = [
  {
    id: 'item-1',
    type: 'text',
    position: { x: 100, y: 150 },
    width: 250,
    height: 120,
    content: 'Welcome to CanvasCraft! \n\nRight-click to add items. Double-click a board to enter it.',
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
  { id: 'arrow-1', from: 'item-1', to: 'item-2', parentId: null },
];

const ROOT_BOARD: Board = { id: 'root', name: 'Home', settings: { accentColor: '73 56% 60%', showGrid: true, vignetteStrength: 100 } };

const GRID_SIZE = 40;

type HistoryState = {
  items: CanvasItemData[];
  arrows: ArrowData[];
};

export default function CanvasCraftPage() {
  const [items, setItems] = useState<CanvasItemData[]>(INITIAL_ITEMS);
  const [arrows, setArrows] = useState<ArrowData[]>(INITIAL_ARROWS);
  const [boardStack, setBoardStack] = useState<Board[]>([ROOT_BOARD]);
  
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const [viewState, setViewState] = useState<ViewState>({ zoom: 1, pan: { x: 0, y: 0 } });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; show: boolean; itemId?: string }>({ x: 0, y: 0, show: false });
  const [connectionState, setConnectionState] = useState<ConnectionState>({});
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastPanPoint = useRef<Point>({ x: 0, y: 0 });
  const rightClickDragInfo = useRef<{ isDragging: boolean; itemId?: string }>({ isDragging: false });
  const { toast } = useToast();

  const currentBoard = boardStack[boardStack.length - 1];
  const currentBoardId = currentBoard.id === 'root' ? null : currentBoard.id;
  
  // Combine settings from board stack
  const combinedSettings = boardStack.reduce((acc, board) => ({ ...acc, ...board.settings }), {} as BoardSettings);
  const { showGrid = true, gridStyle = 'dots', gridOpacity = 0.5, accentColor, vignetteStrength = 0 } = combinedSettings;


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
    // Initialize history
    setHistory([{ items, arrows }]);
    setHistoryIndex(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredItems = items.filter(item => item.parentId === currentBoardId);
  const filteredArrows = arrows.filter(arrow => arrow.parentId === currentBoardId);

  const screenToCanvas = useCallback((screenPoint: Point): Point => {
    return {
      x: (screenPoint.x - viewState.pan.x) / viewState.zoom,
      y: (screenPoint.y - viewState.pan.y) / viewState.zoom,
    };
  }, [viewState]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 ? viewState.zoom * zoomFactor : viewState.zoom / zoomFactor;
    const clampedZoom = Math.max(0.1, Math.min(5, newZoom));

    const mousePos = { x: e.clientX, y: e.clientY };
    const mouseOnCanvasBeforeZoom = screenToCanvas(mousePos);
    
    const newPan = {
      x: mousePos.x - mouseOnCanvasBeforeZoom.x * clampedZoom,
      y: mousePos.y - mouseOnCanvasBeforeZoom.y * clampedZoom
    };

    setViewState({ zoom: clampedZoom, pan: newPan });
  };
  
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (contextMenu.show) setContextMenu({ ...contextMenu, show: false });
    if (e.button === 1 || (e.button === 0 && (e.metaKey || e.ctrlKey))) {
      isPanning.current = true;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
    }
    if (e.button === 2) {
        rightClickDragInfo.current = { isDragging: false };
    }
  };
  
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isPanning.current) {
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      setViewState(vs => ({ ...vs, pan: { x: vs.pan.x + dx, y: vs.pan.y + dy } }));
    }
    if(e.buttons === 2 && !rightClickDragInfo.current.isDragging) {
        rightClickDragInfo.current.isDragging = true;
    }
  };
  
  const handleMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    isPanning.current = false;
    if (e.button === 2 && !rightClickDragInfo.current.isDragging) {
        const clickedItem = (e.target as HTMLElement).closest('[data-item-id]');
        const itemId = clickedItem ? clickedItem.getAttribute('data-item-id') : undefined;

        if (connectionState.from) {
            setConnectionState({});
        } else {
            setContextMenu({ x: e.clientX, y: e.clientY, show: true, itemId: itemId || undefined });
        }
    }
    rightClickDragInfo.current = { isDragging: false };
  };
  
  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const addItem = (type: CanvasItemType, position: Point) => {
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
        arrows.filter(arrow => arrow.from !== itemId && arrow.to !== itemId)
    );
    setContextMenu({ ...contextMenu, show: false });
  }

  const handleContextMenuAction = (action: CanvasItemType | 'connect' | 'delete') => {
    if (action === 'delete' && contextMenu.itemId) {
      deleteItem(contextMenu.itemId);
      return;
    }

    const canvasPos = screenToCanvas({ x: contextMenu.x, y: contextMenu.y });
    if (action === 'connect') {
        if (contextMenu.itemId) {
            setConnectionState({ from: contextMenu.itemId });
        }
        setContextMenu({ ...contextMenu, show: false });
    } else if (action !== 'delete') {
        addItem(action, canvasPos);
    }
  };

  const handleItemUpdate = (updatedItem: Partial<CanvasItemData> & { id: string }) => {
    updateState(
      items.map(item => item.id === updatedItem.id ? { ...item, ...updatedItem } : item),
      arrows
    );
  };
  
  const handleItemClick = (id: string) => {
    if (connectionState.from === undefined) return;

    if (!connectionState.from) {
        setConnectionState({ from: id });
    } else {
        if (connectionState.from === id) return;
        const newArrow: ArrowData = {
            id: `arrow-${Date.now()}`,
            from: connectionState.from,
            to: id,
            parentId: currentBoardId
        };
        updateState(items, prevArrows => [...prevArrows, newArrow]);
        setConnectionState({});
    }
  };
  
  const handleItemDoubleClick = (item: CanvasItemData) => {
      if (item.type === 'board') {
          const newBoard: Board = {id: item.id, name: item.content, settings: { showGrid: true, vignetteStrength: 100 }};
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
        setConnectionState({});
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
  }, [historyIndex, history.length]);
  
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

  if (vignetteStrength > 0) {
    const visiblePercentage = 100 - vignetteStrength;
    gridStyleProps.maskImage = `radial-gradient(circle, white ${visiblePercentage}%, transparent 100%)`;
    gridStyleProps.WebkitMaskImage = `radial-gradient(circle, white ${visiblePercentage}%, transparent 100%)`;
  }

  return (
    <main
      ref={canvasRef}
      className={cn(
        "w-screen h-screen overflow-hidden bg-background relative cursor-grab active:cursor-grabbing",
        {'cursor-crosshair': connectionState.from !== undefined }
      )}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
      onClick={() => contextMenu.show && setContextMenu({ ...contextMenu, show: false })}
    >
        {showGrid && (
            <div
                className="absolute inset-0 w-full h-full"
                style={gridStyleProps}
            />
        )}
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

        <div 
          className="w-full h-full"
          style={{ transform: `translate(${viewState.pan.x}px, ${viewState.pan.y}px) scale(${viewState.zoom})`, transformOrigin: '0 0' }}
        >
            <ArrowRenderer arrows={filteredArrows} items={filteredItems} />

            {filteredItems.map(item => (
                <CanvasItem 
                    key={item.id}
                    item={item}
                    zoom={viewState.zoom}
                    onUpdate={handleItemUpdate}
                    onClick={() => handleItemClick(item.id)}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                    onContextMenu={(e) => e.preventDefault()}
                    isSelected={connectionState.from === item.id}
                />
            ))}
        </div>

        {contextMenu.show && <ContextMenu x={contextMenu.x} y={contextMenu.y} onAction={handleContextMenuAction} isItemMenu={!!contextMenu.itemId} />}
        
        <Toolbar settings={combinedSettings} onSettingsChange={handleBoardSettingsChange} />
    </main>
  );
}
