"use client";

import { useState, useRef, useEffect, useCallback, type MouseEvent } from 'react';
import {
  CanvasItemData,
  Point,
  ViewState,
  ArrowData,
  ConnectionState,
  CanvasItemType,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import CanvasItem from '@/components/canvas/canvas-item';
import ContextMenu from '@/components/canvas/context-menu';
import ArrowRenderer from '@/components/canvas/arrow-renderer';
import Toolbar from '@/components/canvas/toolbar';
import { useToast } from '@/hooks/use-toast';

const INITIAL_ITEMS: CanvasItemData[] = [
  {
    id: 'item-1',
    type: 'text',
    position: { x: 100, y: 150 },
    width: 250,
    height: 120,
    content: 'Welcome to CanvasCraft! \n\nRight-click to add items.',
  },
  {
    id: 'item-2',
    type: 'board',
    position: { x: 500, y: 100 },
    width: 300,
    height: 200,
    content: 'My First Board',
  },
  {
    id: 'item-3',
    type: 'image',
    position: { x: 150, y: 400 },
    width: 300,
    height: 200,
    content: PlaceHolderImages[0].imageUrl,
  },
];

const INITIAL_ARROWS: ArrowData[] = [
  { id: 'arrow-1', from: 'item-1', to: 'item-2' },
];

export default function CanvasCraftPage() {
  const [items, setItems] = useState<CanvasItemData[]>(INITIAL_ITEMS);
  const [arrows, setArrows] = useState<ArrowData[]>(INITIAL_ARROWS);
  const [viewState, setViewState] = useState<ViewState>({ zoom: 1, pan: { x: 0, y: 0 } });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });
  const [connectionState, setConnectionState] = useState<ConnectionState>({});
  const [showGrid, setShowGrid] = useState(true);

  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastPanPoint = useRef<Point>({ x: 0, y: 0 });
  const { toast } = useToast();

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
    if (e.button === 1 || e.metaKey || e.ctrlKey) { // Middle mouse or cmd/ctrl key
      isPanning.current = true;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
    }
  };
  
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isPanning.current) {
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      setViewState(vs => ({ ...vs, pan: { x: vs.pan.x + dx, y: vs.pan.y + dy } }));
    }
  };
  
  const handleMouseUp = () => {
    isPanning.current = false;
  };
  
  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (connectionState.from) { // Cancel connection
        setConnectionState({});
        return;
    }
    setContextMenu({ x: e.clientX, y: e.clientY, show: true });
  };

  const addItem = (type: CanvasItemType, position: Point) => {
    const newItem: CanvasItemData = {
      id: `item-${Date.now()}`,
      type,
      position,
      width: type === 'image' || type === 'board' ? 300 : 250,
      height: type === 'image' || type === 'board' ? 200 : 100,
      content: type === 'text' ? 'New Text' : type === 'board' ? 'New Board' : PlaceHolderImages[0].imageUrl
    };
    setItems(prev => [...prev, newItem]);
    setContextMenu({ ...contextMenu, show: false });
  };

  const handleContextMenuAction = (action: CanvasItemType | 'connect') => {
    const canvasPos = screenToCanvas({ x: contextMenu.x, y: contextMenu.y });
    if (action === 'connect') {
        setConnectionState({ from: undefined });
        setContextMenu({ ...contextMenu, show: false });
    } else {
        addItem(action, canvasPos);
    }
  };

  const handleItemDrag = (id: string, newPosition: Point) => {
    setItems(items => items.map(item => item.id === id ? { ...item, position: newPosition } : item));
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
            to: id
        };
        setArrows(prev => [...prev, newArrow]);
        setConnectionState({}); // Exit connection mode
    }
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
                
                // For simplicity, pasting at the center of the current view
                const canvasCenter = screenToCanvas({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
                const newItem: CanvasItemData = {
                    id: `item-${Date.now()}`,
                    type: 'image',
                    position: canvasCenter,
                    width: 300,
                    height: 200,
                    content: src,
                };
                setItems(prev => [...prev, newItem]);
                toast({ title: "Image pasted successfully!" });
            };
            reader.readAsDataURL(blob);
            return; // Handle one image at a time
        }
    }
  }, [screenToCanvas, toast]);

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

  return (
    <main
      ref={canvasRef}
      className={cn(
        "w-screen h-screen overflow-hidden bg-background relative cursor-grab active:cursor-grabbing",
        {'cursor-crosshair': connectionState.from !== undefined },
        {'grid-background': showGrid}
      )}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
      onClick={() => contextMenu.show && setContextMenu({ ...contextMenu, show: false })}
    >
        <div 
          className="w-full h-full"
          style={{ transform: `translate(${viewState.pan.x}px, ${viewState.pan.y}px) scale(${viewState.zoom})`, transformOrigin: '0 0' }}
        >
            <ArrowRenderer arrows={arrows} items={items} />

            {items.map(item => (
                <CanvasItem 
                    key={item.id}
                    item={item}
                    zoom={viewState.zoom}
                    onDrag={handleItemDrag}
                    onContentChange={handleItemContentChange}
                    onClick={() => handleItemClick(item.id)}
                    isSelected={connectionState.from === item.id}
                />
            ))}
        </div>

        {contextMenu.show && <ContextMenu x={contextMenu.x} y={contextMenu.y} onAction={handleContextMenuAction} />}
        
        <Toolbar showGrid={showGrid} onToggleGrid={() => setShowGrid(g => !g)} />
    </main>
  );
}
