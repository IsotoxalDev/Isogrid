"use client";

import { useState, useRef, useEffect, useCallback, type MouseEvent, CSSProperties } from 'react';
import {
  CanvasItemData,
  Point,
  ViewState,
  ArrowData,
  ConnectionState,
  CanvasItemType,
  Board,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import CanvasItem from '@/components/canvas/canvas-item';
import ContextMenu from '@/components/canvas/context-menu';
import ArrowRenderer from '@/components/canvas/arrow-renderer';
import Toolbar from '@/components/canvas/toolbar';
import { useToast } from '@/hooks/use-toast';
import { ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

const ROOT_BOARD: Board = { id: 'root', name: 'Home' };

const GRID_SIZE = 40;

export default function CanvasCraftPage() {
  const [items, setItems] = useState<CanvasItemData[]>(INITIAL_ITEMS);
  const [arrows, setArrows] = useState<ArrowData[]>(INITIAL_ARROWS);
  
  const [boardStack, setBoardStack] = useState<Board[]>([ROOT_BOARD]);
  
  const [viewState, setViewState] = useState<ViewState>({ zoom: 1, pan: { x: 0, y: 0 } });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; show: boolean, itemId?: string }>({ x: 0, y: 0, show: false });
  const [connectionState, setConnectionState] = useState<ConnectionState>({});
  const [showGrid, setShowGrid] = useState(true);

  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastPanPoint = useRef<Point>({ x: 0, y: 0 });
  const rightClickDragInfo = useRef<{isDragging: boolean, itemId?: string}>({ isDragging: false });
  const { toast } = useToast();

  const currentBoard = boardStack[boardStack.length - 1];
  const currentBoardId = currentBoard.id === 'root' ? null : currentBoard.id;

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
    if (e.button === 1 || (e.button === 0 && (e.metaKey || e.ctrlKey))) { // Middle mouse or cmd/ctrl + left click
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
    // Set dragging state on the first mouse move during a right click
    if(e.buttons === 2 && !rightClickDragInfo.current.isDragging) {
        rightClickDragInfo.current.isDragging = true;
    }
  };
  
  const handleMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    isPanning.current = false;
    // If not a drag, show context menu on right-click up
    if (e.button === 2 && !rightClickDragInfo.current.isDragging) {
        // Find if a specific item was clicked
        const clickedItem = (e.target as HTMLElement).closest('[data-item-id]');
        const itemId = clickedItem ? clickedItem.getAttribute('data-item-id') : undefined;

        if (connectionState.from) { // Cancel connection
            setConnectionState({});
        } else {
            setContextMenu({ x: e.clientX, y: e.clientY, show: true, itemId: itemId || undefined });
        }
    }
    // Reset right-click drag info
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
    setItems(prev => [...prev, newItem]);
    setContextMenu({ ...contextMenu, show: false });
  };

  const deleteItem = (itemId: string) => {
    setItems(items => items.filter(item => item.id !== itemId));
    // Also delete arrows connected to this item
    setArrows(arrows => arrows.filter(arrow => arrow.from !== itemId && arrow.to !== itemId));
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

  const handleItemDrag = (id: string, newPosition: Point) => {
    setItems(items => items.map(item => item.id === id ? { ...item, position: newPosition } : item));
  };

  const handleItemResize = (id: string, newWidth: number, newHeight: number) => {
    setItems(items => items.map(item => item.id === id ? { ...item, width: newWidth, height: newHeight } : item));
  };
  
  const handleItemContentChange = (id: string, content: string) => {
    setItems(items => items.map(item => item.id === id ? { ...item, content } : item));
  };

  const handleItemClick = (id: string) => {
    if (connectionState.from === undefined) return; // Not in connection mode

    if (!connectionState.from) { // First item selected
        setConnectionState({ from: id });
    } else { // Second item selected
        if (connectionState.from === id) return; // Can't connect to itself
        const newArrow: ArrowData = {
            id: `arrow-${Date.now()}`,
            from: connectionState.from,
            to: id,
            parentId: currentBoardId
        };
        setArrows(prev => [...prev, newArrow]);
        setConnectionState({}); // Exit connection mode
    }
  };
  
    const handleItemDoubleClick = (item: CanvasItemData) => {
        if (item.type === 'board') {
            setBoardStack(stack => [...stack, {id: item.id, name: item.content}]);
            setViewState({ zoom: 1, pan: { x: 0, y: 0 } }); // Reset view
        }
    };

    const navigateToBoard = (boardIndex: number) => {
        setBoardStack(stack => stack.slice(0, boardIndex + 1));
        setViewState({ zoom: 1, pan: { x: 0, y: 0 } }); // Reset view
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
                    setItems(prev => [...prev, newItem]);
                    toast({ title: "Image pasted successfully!" });
                };
                img.src = src;
            };
            reader.readAsDataURL(blob);
            return; // Handle one image at a time
        }
    }
  }, [screenToCanvas, toast, currentBoardId]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConnectionState({});
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  const scaledGridSize = GRID_SIZE * viewState.zoom;

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
                style={{
                    backgroundImage: `radial-gradient(hsl(var(--muted-foreground) / 0.5) 1px, transparent 0)`,
                    backgroundSize: `${scaledGridSize}px ${scaledGridSize}px`,
                    backgroundPosition: `${viewState.pan.x % scaledGridSize}px ${viewState.pan.y % scaledGridSize}px`,
                    maskImage: 'radial-gradient(circle, white, transparent 75%)',
                    WebkitMaskImage: 'radial-gradient(circle, white, transparent 75%)',
                }}
            />
        )}
        <div className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-background/80 backdrop-blur-sm">
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
                    onDrag={handleItemDrag}
                    onResize={handleItemResize}
                    onContentChange={handleItemContentChange}
                    onClick={() => handleItemClick(item.id)}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                    onContextMenu={(e) => e.preventDefault()}
                    isSelected={connectionState.from === item.id}
                />
            ))}
        </div>

        {contextMenu.show && <ContextMenu x={contextMenu.x} y={contextMenu.y} onAction={handleContextMenuAction} isItemMenu={!!contextMenu.itemId} />}
        
        <Toolbar showGrid={showGrid} onToggleGrid={() => setShowGrid(g => !g)} />
    </main>
  );
}
