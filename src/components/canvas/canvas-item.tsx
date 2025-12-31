"use client";

import { useRef, type FC, type MouseEvent, useState, useEffect } from 'react';
import Image from 'next/image';
import { CanvasItemData, Point } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import TodoItem from '@/components/canvas/todo-item';

interface CanvasItemProps {
  item: CanvasItemData;
  zoom: number;
  onUpdate: (item: Partial<CanvasItemData> & { id: string }) => void;
  onClick: (event: MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (event: MouseEvent) => void;
  isSelected: boolean;
  isEditing: boolean;
  onEditEnd: () => void;
}

const CanvasItem: FC<CanvasItemProps> = ({ item, zoom, onUpdate, onClick, onDoubleClick, onContextMenu, isSelected, isEditing, onEditEnd }) => {
  const dragStartPos = useRef<Point>({ x: 0, y: 0 });
  const itemStartPos = useRef<Point>({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cardTitleRef = useRef<HTMLDivElement>(null);
  
  const MIN_SIZE = 40;

  const handleMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag, [data-no-drag="true"]')) {
      return;
    }

    e.stopPropagation();
    
    dragStartPos.current = { x: e.clientX, y: e.clientY };

    const isLeftClick = e.button === 0;
    
    if (isLeftClick && !(e.ctrlKey || e.metaKey)) { // Left click for dragging
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
    }
  };

  useEffect(() => {
    if (isEditing) {
      if (item.type === 'text' && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      } else if ((item.type === 'board' || item.type === 'todo') && cardTitleRef.current) {
        cardTitleRef.current.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        if (sel) {
          range.selectNodeContents(cardTitleRef.current);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }
  }, [isEditing, item.type]);
  
  const handleBlur = () => {
    onEditEnd();
  };
  
  const handleResizeMouseDown = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    dragStartPos.current = { x: e.clientX, y: e.clientY };
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

  const renderContent = () => {
    switch (item.type) {
      case 'text':
        return isEditing ? (
          <Textarea
            ref={textareaRef}
            value={item.content}
            onChange={(e) => onUpdate({ id: item.id, content: e.target.value })}
            onBlur={handleBlur}
            className="w-full h-full bg-transparent border-0 resize-none focus:ring-0 focus-visible:ring-offset-0 focus-visible:ring-0"
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
            className="object-cover w-full h-full rounded-lg"
            unoptimized // for blob urls
          />
        );
      case 'board':
        return (
          <CardHeader>
            <CardTitle
              ref={cardTitleRef}
              contentEditable={isEditing}
              suppressContentEditableWarning
              className={cn("outline-none rounded-sm px-1", isEditing && "ring-2 ring-primary no-drag")}
              onBlur={(e) => {
                onUpdate({ id: item.id, content: e.currentTarget.textContent || ''});
                handleBlur();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                }
              }}
            >
              {item.content}
            </CardTitle>
          </CardHeader>
        );
      case 'todo':
        return (
          <>
            <CardHeader>
              <CardTitle
                ref={cardTitleRef}
                contentEditable={isEditing}
                suppressContentEditableWarning
                className={cn("outline-none rounded-sm px-1 text-lg", isEditing && "ring-2 ring-primary no-drag")}
                onBlur={(e) => {
                  onUpdate({ id: item.id, content: e.currentTarget.textContent || '' });
                  handleBlur();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
              >
                {item.content}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0 h-full">
              <TodoItem item={item} onUpdate={onUpdate} />
            </CardContent>
          </>
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
        'cursor-grab active:cursor-grabbing transition-shadow duration-200 rounded-lg',
        isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-2xl',
        !isSelected && 'hover:shadow-xl'
      )}
      onMouseDown={handleMouseDown}
      onClick={onClick}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
      onContextMenu={onContextMenu}
    >
      <Card
        className={cn(
          "w-full h-full overflow-hidden transition-colors duration-200 rounded-lg shadow-md flex flex-col",
          item.type === 'image' && 'p-0 border-0',
          item.type === 'text' && 'bg-card/90 backdrop-blur-sm',
          item.type === 'board' && 'flex items-center justify-center bg-card/90 backdrop-blur-sm',
          item.type === 'todo' && 'bg-card/90 backdrop-blur-sm'
        )}
      >
        {renderContent()}
      </Card>
      <div 
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize no-drag"
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  );
};

export default CanvasItem;
