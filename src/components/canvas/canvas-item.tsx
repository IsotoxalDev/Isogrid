"use client";

import { useRef, type FC, type MouseEvent, useState, useEffect } from 'react';
import Image from 'next/image';
import { CanvasItemData, Point } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

interface CanvasItemProps {
  item: CanvasItemData;
  zoom: number;
  onUpdate: (item: Partial<CanvasItemData> & { id: string }) => void;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (event: MouseEvent) => void;
  isSelected: boolean;
}

const CanvasItem: FC<CanvasItemProps> = ({ item, zoom, onUpdate, onClick, onDoubleClick, onContextMenu, isSelected }) => {
  const dragStartPos = useRef<Point>({ x: 0, y: 0 });
  const itemStartPos = useRef<Point>({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const MIN_SIZE = 40;

  const handleMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'textarea' || (e.target as HTMLElement).closest('.no-drag')) {
      return;
    }

    e.stopPropagation();
    
    dragStartPos.current = { x: e.clientX, y: e.clientY };

    const isLeftClick = e.button === 0;
    const isRightClick = e.button === 2;
    
    if (isLeftClick) { // Left click for dragging
        e.preventDefault();
        itemStartPos.current = item.position;

        const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
            const dx = (moveEvent.clientX - dragStartPos.current.x) / zoom;
            const dy = (moveEvent.clientY - dragStartPos.current.y) / zoom;
            onUpdate({ id: item.id, position: {
                x: itemStartPos.current.x + dx,
                y: itemStartPos.current.y + dy,
            }});
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    } else if (isRightClick) { // Right click for resizing
        e.preventDefault();
        resizeStartSize.current = { width: item.width, height: item.height };
        
        const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
            const dx = (moveEvent.clientX - dragStartPos.current.x) / zoom;
            const dy = (moveEvent.clientY - dragStartPos.current.y) / zoom;
            
            let newWidth = Math.max(MIN_SIZE, resizeStartSize.current.width + dx);
            let newHeight = Math.max(MIN_SIZE, resizeStartSize.current.height + dy);

            if (moveEvent.shiftKey) {
              const aspectRatio = resizeStartSize.current.width / resizeStartSize.current.height;
              if (Math.abs(dx) > Math.abs(dy)) {
                  newHeight = newWidth / aspectRatio;
              } else {
                  newWidth = newHeight * aspectRatio;
              }
            }

            onUpdate({ id: item.id, width: newWidth, height: newHeight });
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
  };

  const handleItemDoubleClick = () => {
    if (item.type === 'text') {
      setIsEditing(true);
    }
    onDoubleClick();
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
    }
  }, [isEditing]);
  
  const handleTextBlur = () => {
    setIsEditing(false);
  };

  const renderContent = () => {
    switch (item.type) {
      case 'text':
        return isEditing ? (
          <Textarea
            ref={textareaRef}
            value={item.content}
            onChange={(e) => onUpdate({ id: item.id, content: e.target.value })}
            onBlur={handleTextBlur}
            className="w-full h-full bg-transparent border-0 resize-none focus:ring-0 focus-visible:ring-offset-0 focus-visible:ring-0"
            onClick={(e) => e.stopPropagation()} // Prevent click from bubbling to parent
          />
        ) : (
          <div className="w-full h-full p-4 whitespace-pre-wrap">{item.content}</div>
        );
      case 'image':
        return (
          <Image
            src={item.content}
            alt="User uploaded content"
            width={item.width}
            height={item.height}
            className="object-cover w-full h-full"
            unoptimized // for blob urls
            data-ai-hint="abstract art"
          />
        );
      case 'board':
        return (
          <CardHeader>
            <CardTitle 
              contentEditable
              suppressContentEditableWarning
              className="outline-none focus:ring-2 focus:ring-primary rounded-sm px-1 no-drag"
              onBlur={(e) => onUpdate({ id: item.id, content: e.currentTarget.textContent || ''})}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {item.content}
            </CardTitle>
          </CardHeader>
        );
      default:
        return null;
    }
  };

  return (
    <div
      data-item-id={item.id}
      style={{
        position: 'absolute',
        left: item.position.x,
        top: item.position.y,
        width: item.width,
        height: item.height,
        transformOrigin: 'top left',
      }}
      className={cn(
        'cursor-pointer transition-shadow duration-200 rounded-lg',
        isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-2xl',
        !isSelected && 'hover:shadow-xl'
      )}
      onMouseDown={handleMouseDown}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onDoubleClick={(e) => { e.stopPropagation(); handleItemDoubleClick(); }}
      onContextMenu={onContextMenu}
    >
      <Card
        className={cn(
          "w-full h-full overflow-hidden transition-colors duration-200",
          item.type === 'image' && 'p-0',
          item.type !== 'text' && item.type === 'board' && 'flex items-center justify-center',
        )}
      >
        {renderContent()}
      </Card>
    </div>
  );
};

export default CanvasItem;
