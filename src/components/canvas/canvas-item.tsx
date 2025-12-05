"use client";

import { useRef, type FC, type MouseEvent } from 'react';
import Image from 'next/image';
import { CanvasItemData, Point } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

interface CanvasItemProps {
  item: CanvasItemData;
  zoom: number;
  onDrag: (id: string, newPosition: Point) => void;
  onContentChange: (id: string, newContent: string) => void;
  onClick: () => void;
  isSelected: boolean;
}

const CanvasItem: FC<CanvasItemProps> = ({ item, zoom, onDrag, onContentChange, onClick, isSelected }) => {
  const dragStartPos = useRef<Point>({ x: 0, y: 0 });
  const itemStartPos = useRef<Point>({ x: 0, y: 0 });

  const handleMouseDown = (e: MouseEvent) => {
    // Prevent initiating drag from form elements
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'textarea') {
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    dragStartPos.current = { x: e.clientX, y: e.clientY };
    itemStartPos.current = item.position;

    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
      const dx = (moveEvent.clientX - dragStartPos.current.x) / zoom;
      const dy = (moveEvent.clientY - dragStartPos.current.y) / zoom;
      onDrag(item.id, {
        x: itemStartPos.current.x + dx,
        y: itemStartPos.current.y + dy,
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const renderContent = () => {
    switch (item.type) {
      case 'text':
        return (
          <Textarea
            value={item.content}
            onChange={(e) => onContentChange(item.id, e.target.value)}
            className="w-full h-full bg-transparent border-0 resize-none focus:ring-0 focus-visible:ring-offset-0 focus-visible:ring-0"
            onClick={(e) => e.stopPropagation()}
          />
        );
      case 'image':
        return (
          <Image
            src={item.content}
            alt="User uploaded content"
            width={item.width}
            height={item.height}
            className="object-cover w-full h-full rounded-md"
            unoptimized // for blob urls
            data-ai-hint="abstract art"
          />
        );
      case 'board':
        return (
          <CardHeader>
            <CardTitle>{item.content}</CardTitle>
          </CardHeader>
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: item.position.x,
        top: item.position.y,
        width: item.width,
        height: item.height,
        transformOrigin: 'top left',
      }}
      className={cn(
        'cursor-pointer transition-shadow duration-200',
        isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg shadow-2xl',
        !isSelected && 'hover:shadow-xl'
      )}
      onMouseDown={handleMouseDown}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <Card
        className={cn(
          "w-full h-full overflow-hidden transition-colors duration-200",
          item.type === 'text' && 'p-2',
        )}
      >
        {renderContent()}
      </Card>
    </div>
  );
};

export default CanvasItem;
