
"use client";

import { useRef, type FC, type MouseEvent, useState, useEffect, ChangeEvent, KeyboardEvent } from 'react';
import Image from 'next/image';
import { CanvasItemData, Point, TodoListItem, BoardSettings, TextAlign } from '@/lib/types';
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
  onTextareaFocus?: (textarea: HTMLTextAreaElement) => void;
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
  onTextareaFocus,
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
        onTextareaFocus?.(textareaRef.current);
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
  }, [isEditing, item.type, onTextareaFocus]);
  
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

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const newLines = newText.split('\n');
    const oldLines = item.content.split('\n');
    const oldAlignments = item.textAligns || [];
    
    let newAlignments: TextAlign[] = [];

    // This logic attempts to preserve alignments when lines are added or removed.
    if (newLines.length > oldLines.length) { // Line added
      const cursorLine = newText.substring(0, e.target.selectionStart).split('\n').length - 1;
      const lastAlignment = oldAlignments[cursorLine-1] || 'left';
      newAlignments = [
        ...oldAlignments.slice(0, cursorLine),
        lastAlignment,
        ...oldAlignments.slice(cursorLine)
      ];
    } else if (newLines.length < oldLines.length) { // Line removed
        const cursorLine = newText.substring(0, e.target.selectionStart).split('\n').length - 1;
        newAlignments = [
            ...oldAlignments.slice(0, cursorLine+1),
            ...oldAlignments.slice(cursorLine + 2)
        ];
    } else { // No change in line count
        newAlignments = oldAlignments;
    }
    
    onUpdate({ id: item.id, content: newText, textAligns: newAlignments });
  };
  
  const renderContent = () => {
    switch (item.type) {
      case 'text':
        const textStyle: React.CSSProperties = {
            fontSize: item.fontSize ? `${item.fontSize}px` : '1rem',
            fontWeight: item.fontWeight || 'normal',
            fontStyle: item.fontStyle || 'normal',
            textDecoration: item.textDecoration || 'none',
        };

        if (isEditing) {
          return (
            <Textarea
              ref={textareaRef}
              value={item.content}
              onChange={handleTextChange}
              onFocus={(e) => onTextareaFocus?.(e.target)}
              onBlur={handleBlur}
              className="w-full h-full bg-transparent border-0 resize-none focus:ring-0 focus-visible:ring-offset-0 focus-visible:ring-0"
              style={{ ...textStyle, textAlign: item.textAlign || 'left' }}
            />
          );
        }
        
        const lines = item.content.split('\n');
        const alignments = item.textAligns || [];
        
        return (
          <div className="w-full h-full p-4 whitespace-pre-wrap" style={textStyle}>
            {lines.map((line, index) => (
              <div key={index} style={{ textAlign: alignments[index] || item.textAlign || 'left' }}>
                {line || ' '}
              </div>
            ))}
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
            className="w-full h-full flex items-center justify-center text-center"
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
                <span className="truncate text-sm text-primary group-hover:underline">{item.content}</span>
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
                onDrop={onDrop}
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

    
