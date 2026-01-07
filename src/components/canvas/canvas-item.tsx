
"use client";

import { useRef, type FC, type MouseEvent, useState, useEffect } from 'react';
import Image from 'next/image';
import { CanvasItemData, Point, TodoListItem, BoardSettings } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Link } from 'lucide-react';
import TodoItem from '@/components/canvas/todo-item';
import { Separator } from '@/components/ui/separator';

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
  onTodoDragStart: (sourceListId: string, todo: TodoListItem) => void;
  onTodoDrop: (targetListId: string, targetTodoId?: string) => void;
  isDropTarget: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  settings: BoardSettings;
}

const CanvasItem: FC<CanvasItemProps> = ({ 
  item, 
  zoom, 
  onUpdate, 
  onClick, 
  onDoubleClick, 
  onContextMenu, 
  isSelected, 
  isEditing, 
  onEditEnd,
  onTodoDragStart,
  onTodoDrop,
  isDropTarget,
  onDragEnter,
  onDragLeave,
  settings,
}) => {
  const dragStartPos = useRef<Point>({ x: 0, y: 0 });
  const itemStartPos = useRef<Point>({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardTitleRef = useRef<HTMLDivElement>(null);
  
  const MIN_SIZE = 40;

  const handleMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag, [data-no-drag="true"]')) {
      return;
    }

    e.stopPropagation();
    
    dragStartPos.current = { x: e.clientX, y: e.clientY };

    const isLeftClick = e.button === 0;
    
    if (isLeftClick && !(e.ctrlKey || e.metaKey)) { 
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
      } else if (item.type === 'link' && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
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
        let newHeight = Math.max(item.type === 'link' ? 52 : MIN_SIZE, resizeStartSize.current.height + dy);

        if (moveEvent.shiftKey && item.type !== 'link') {
          const aspectRatio = resizeStartSize.current.width / resizeStartSize.current.height;
          if (Math.abs(dx) > Math.abs(dy)) {
              newHeight = newWidth / aspectRatio;
          } else {
              newWidth = newHeight * aspectRatio;
          }
        }
        
        const update: Partial<CanvasItemData> = { id: item.id, width: newWidth };
        if (item.type !== 'link') {
            update.height = newHeight;
        }

        onUpdate(update);
    };

    const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }
  
  const cardStyle: React.CSSProperties = {};
  if (item.type !== 'image') {
    cardStyle.backgroundColor = `hsl(var(--card) / ${settings.defaultOpacity ?? 1})`;
    if ((settings.defaultBackgroundBlur ?? 0) > 0) {
      cardStyle.backdropFilter = `blur(${settings.defaultBackgroundBlur}px)`;
    }
  }

  const renderContent = () => {
    switch (item.type) {
      case 'text':
        const textStyle: React.CSSProperties = {
            textAlign: item.textAlign || 'left',
            fontSize: item.fontSize ? `${item.fontSize}px` : '1rem',
            fontWeight: item.fontWeight || 'normal',
            fontStyle: item.fontStyle || 'normal',
            textDecoration: item.textDecoration || 'none',
        };

        return isEditing ? (
          <Textarea
            ref={textareaRef}
            value={item.content}
            onChange={(e) => onUpdate({ id: item.id, content: e.target.value })}
            onBlur={handleBlur}
            className="w-full h-full bg-transparent border-0 resize-none focus:ring-0 focus-visible:ring-offset-0 focus-visible:ring-0"
            style={textStyle}
          />
        ) : (
          <div className="w-full h-full p-4 whitespace-pre-wrap" style={textStyle}>
            {item.content}
          </div>
        );
      case 'image':
        return (
          <Image
            src={item.content}
            alt="User uploaded content"
            width={item.width}
            height={item.height}
            className="object-cover w-full h-full rounded-lg"
            unoptimized
          />
        );
      case 'board':
        return (
          <div
            className="w-full h-full flex items-center justify-center text-center cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
          >
            <CardTitle
              ref={cardTitleRef}
              contentEditable={isEditing}
              suppressContentEditableWarning
              className={cn("outline-none rounded-sm px-1", isEditing && "ring-2 ring-primary no-drag")}
              onMouseDown={(e) => { if (isEditing) e.stopPropagation();}}
              onClick={(e) => { if (isEditing) e.stopPropagation();}}
              onDoubleClick={(e) => { if (isEditing) e.stopPropagation();}}
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
          </div>
        );
      case 'link':
        const isValidUrl = item.content.startsWith('http://') || item.content.startsWith('https://');
        return isEditing ? (
            <div className="flex items-center w-full h-full p-2 gap-2">
                <Link className="w-5 h-5 text-muted-foreground shrink-0"/>
                <Input
                    ref={inputRef}
                    value={item.content}
                    onChange={(e) => onUpdate({ id: item.id, content: e.target.value })}
                    onBlur={handleBlur}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleBlur(); }}
                    className="w-full h-full bg-transparent border-0 focus:ring-0 focus-visible:ring-offset-0 focus-visible:ring-0 p-0 text-sm"
                />
            </div>
        ) : (
            <div className="flex items-center w-full h-full p-3 gap-3">
              <a
                href={isValidUrl ? item.content : `//${item.content}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 group cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <Link className="w-5 h-5 text-muted-foreground shrink-0"/>
                <span className="truncate text-sm text-primary-foreground group-hover:underline">{item.content}</span>
              </a>
            </div>
        );
      case 'todo':
        return (
          <>
            <CardHeader className="py-4">
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
            <Separator />
            <CardContent className="p-2 pt-2 flex-grow"
              onDragOver={(e) => {
                onDragEnter();
                e.preventDefault();
                e.stopPropagation();
              }}
              onDragLeave={(e) => {
                onDragLeave();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                onTodoDrop(item.id);
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <TodoItem 
                item={item} 
                onUpdate={onUpdate}
                onDragStart={onTodoDragStart}
                onDrop={onTodoDrop}
              />
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
        height: item.type === 'todo' ? 'auto' : item.height,
        transformOrigin: 'top left',
      }}
      className={cn(
        'cursor-grab active:cursor-grabbing transition-shadow duration-200 rounded-lg',
        isSelected && !isDropTarget && 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-2xl',
        isDropTarget && 'ring-2 ring-green-500 ring-offset-2 ring-offset-background shadow-2xl',
        !isSelected && 'hover:shadow-xl'
      )}
      onMouseDown={handleMouseDown}
      onClick={onClick}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
      onContextMenu={onContextMenu}
    >
      <Card
        style={cardStyle}
        className={cn(
          "w-full overflow-hidden transition-colors duration-200 rounded-lg shadow-md flex flex-col",
          item.type !== 'todo' && "h-full",
          item.type === 'todo' && "min-h-[120px]",
          item.type === 'image' && 'p-0 border-0',
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

    