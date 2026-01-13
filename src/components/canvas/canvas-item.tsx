"use client";

import { useRef, type FC, type MouseEvent, useState, useEffect, ChangeEvent } from 'react';
import { CanvasItemData, Point, TodoListItem, BoardSettings, TextAlign } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Link, ArrowUp, Loader2 } from 'lucide-react'; // Changed Upload to ArrowUp
import TodoItem from '@/components/canvas/todo-item';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button'; 

// --- Firebase Imports ---
import { storage } from '@/lib/firebase'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Loading state for upload
  const [isUploading, setIsUploading] = useState(false);
  
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
  
  const handleResizeMouseDown = (e: MouseEvent, direction: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    resizeStartSize.current = { width: item.width, height: item.height };
    itemStartPos.current = item.position;
    
    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
        const dx = (moveEvent.clientX - dragStartPos.current.x) / zoom;
        const dy = (moveEvent.clientY - dragStartPos.current.y) / zoom;
        
        const newUpdate: Partial<CanvasItemData> = {};

        if (direction.includes('e')) {
            newUpdate.width = Math.max(MIN_SIZE, resizeStartSize.current.width + dx);
        }
        if (direction.includes('w')) {
            newUpdate.width = Math.max(MIN_SIZE, resizeStartSize.current.width - dx);
            newUpdate.position = { ...item.position, x: itemStartPos.current.x + dx };
        }
        if (direction.includes('s')) {
            if (item.type !== 'link') {
                newUpdate.height = Math.max(MIN_SIZE, resizeStartSize.current.height + dy);
            }
        }
        if (direction.includes('n')) {
            if (item.type !== 'link') {
                newUpdate.height = Math.max(MIN_SIZE, resizeStartSize.current.height - dy);
                newUpdate.position = { ...(newUpdate.position || item.position), y: itemStartPos.current.y + dy };
            }
        }

        onUpdate({ id: item.id, ...newUpdate });
    };

    const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  // --- Image Handling & Firebase Upload ---

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Set loading state immediately
    setIsUploading(true);

    try {
        // 1. Get image dimensions for aspect ratio
        const localUrl = URL.createObjectURL(file);
        const img = new window.Image();
        
        let newHeight = item.height;
        
        // Wrap image loading in a promise to ensure we have dimensions
        await new Promise<void>((resolve) => {
            img.onload = () => {
                const naturalWidth = img.width;
                const naturalHeight = img.height;
                const aspectRatio = naturalWidth / naturalHeight;
                newHeight = item.width / aspectRatio;
                // Clean up the blob URL since we don't need it anymore
                URL.revokeObjectURL(localUrl);
                resolve();
            };
            img.onerror = () => {
                URL.revokeObjectURL(localUrl);
                resolve();
            };
            img.src = localUrl;
        });

        // 2. Upload to Firebase
        const storageRef = ref(storage, `canvas-images/${item.id}/${Date.now()}_${file.name}`);
        
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        // 3. Update with real Firebase URL (This persists the data)
        // Important: We call onUpdate once with the cloud URL only
        onUpdate({ 
            id: item.id, 
            content: downloadURL,
            width: item.width,
            height: newHeight
        });
        
    } catch (error) {
        console.error("Firebase upload failed:", error);
        alert("Failed to upload image. Please check your connection or permissions.");
    } finally {
        setIsUploading(false);
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  // ----------------------------
  
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

    if (newLines.length > oldLines.length) { 
      const cursorLine = newText.substring(0, e.target.selectionStart).split('\n').length - 1;
      const lastAlignment = oldAlignments[cursorLine-1] || 'left';
      newAlignments = [
        ...oldAlignments.slice(0, cursorLine),
        lastAlignment,
        ...oldAlignments.slice(cursorLine)
      ];
    } else if (newLines.length < oldLines.length) { 
        const cursorLine = newText.substring(0, e.target.selectionStart).split('\n').length - 1;
        newAlignments = [
            ...oldAlignments.slice(0, cursorLine+1),
            ...oldAlignments.slice(cursorLine + 2)
        ];
    } else { 
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
          <div 
            className="relative w-full h-full group" 
            onDoubleClick={(e) => {
                e.stopPropagation();
                triggerImageUpload();
            }}
          >
             {/* Loading Overlay */}
             {isUploading && (
               <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 rounded-lg transition-all backdrop-blur-[2px]">
                  <Loader2 className="w-10 h-10 text-white animate-spin" />
               </div>
             )}

             <img
                src={item.content || '/placeholder.png'} 
                alt="Canvas Content"
                className="w-full h-full object-cover rounded-lg pointer-events-none select-none"
                draggable={false}
                style={{ width: '100%', height: '100%' }}
            />
            
            {/* Visual Button to Edit Image - UPDATED STYLE */}
            <div className={cn(
                "absolute top-2 right-2 opacity-0 transition-opacity duration-200 no-drag z-10",
                (isSelected || "group-hover:opacity-100")
            )}>
                <Button 
                    size="icon" 
                    disabled={isUploading}
                    className="h-8 w-8 shadow-md bg-black hover:bg-black/80 text-white border border-white/20"
                    onClick={(e) => {
                        e.stopPropagation();
                        triggerImageUpload();
                    }}
                >
                    <ArrowUp className="w-4 h-4" />
                </Button>
            </div>
          </div>
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
                onDrop={onTodoDrop}
                settings={settings}
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
        isDropTarget && 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-2xl',
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
      
      {isSelected && (
        <>
          <div onMouseDown={(e) => handleResizeMouseDown(e, 'n')} className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-full cursor-n-resize no-drag" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, 's')} className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-full cursor-s-resize no-drag" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, 'w')} className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-full cursor-w-resize no-drag" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, 'e')} className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-full cursor-e-resize no-drag" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} className="absolute -top-1 -left-1 w-4 h-4 cursor-nw-resize no-drag rounded-full border-2 border-primary bg-background" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, 'ne')} className="absolute -top-1 -right-1 w-4 h-4 cursor-ne-resize no-drag rounded-full border-2 border-primary bg-background" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} className="absolute -bottom-1 -left-1 w-4 h-4 cursor-sw-resize no-drag rounded-full border-2 border-primary bg-background" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, 'se')} className="absolute -bottom-1 -right-1 w-4 h-4 cursor-se-resize no-drag rounded-full border-2 border-primary bg-background" />
        </>
      )}
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
};

export default CanvasItem;
