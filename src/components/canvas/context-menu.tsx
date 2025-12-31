"use client";

import type { FC } from 'react';
import { Type, Image, Square, ArrowRight, Trash2, LogIn, PenSquare } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CanvasItemType, AnyCanvasItem } from '@/lib/types';

interface ContextMenuProps {
  x: number;
  y: number;
  onAction: (action: Extract<CanvasItemType, 'text' | 'image' | 'board' | 'arrow'> | 'delete' | 'enter' | 'edit') => void;
  isItemMenu: boolean;
  itemType?: AnyCanvasItem['type'];
  accentColor?: string;
}

const ContextMenu: FC<ContextMenuProps> = ({ x, y, onAction, isItemMenu, itemType, accentColor }) => {
  const menuItems = [
    { label: 'Add Text', icon: Type, action: 'text' as const },
    { label: 'Add Image', icon: Image, action: 'image' as const },
    { label: 'Add Board', icon: Square, action: 'board' as const },
    { label: 'Add Arrow', icon: ArrowRight, action: 'arrow' as const },
  ];
  
  const editItem = { label: 'Edit', icon: PenSquare, action: 'edit' as const };
  const deleteItem = { label: 'Delete', icon: Trash2, action: 'delete' as const };
  const enterBoardItem = { label: 'Enter Board', icon: LogIn, action: 'enter' as const };

  const getDeleteColor = () => {
    if (!accentColor) return 'hsl(var(--destructive))';
    const [h, s, l] = accentColor.split(' ').map(parseFloat);
    // shift hue towards red and increase saturation for vibrancy
    return `hsl(${(h - 30 + 360) % 360}, ${Math.min(100, s + 20)}%, ${l}%)`;
  };

  return (
    <div style={{ top: y, left: x, position: 'fixed' }} className="z-50">
      <Card className="w-48 p-1 shadow-xl">
        {!isItemMenu && menuItems.map((item) => (
          <Button
            key={item.label}
            variant="ghost"
            className="w-full justify-start"
            onClick={(e) => {
              e.stopPropagation();
              onAction(item.action);
            }}
          >
            <item.icon className="w-4 h-4 mr-2" />
            {item.label}
          </Button>
        ))}

        {isItemMenu && (itemType === 'text' || itemType === 'board') && (
            <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={(e) => {
                e.stopPropagation();
                onAction(editItem.action);
                }}
            >
                <editItem.icon className="w-4 h-4 mr-2" />
                {editItem.label}
            </Button>
        )}

        {isItemMenu && itemType === 'board' && (
            <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={(e) => {
                e.stopPropagation();
                onAction(enterBoardItem.action);
                }}
            >
                <enterBoardItem.icon className="w-4 h-4 mr-2" />
                {enterBoardItem.label}
            </Button>
        )}

        
        {isItemMenu && (
            <>
            <Separator className="my-1" />
            <Button
                variant="ghost"
                className="w-full justify-start"
                style={{ color: getDeleteColor() }}
                onClick={(e) => {
                  e.stopPropagation();
                  onAction(deleteItem.action);
                }}
            >
                <deleteItem.icon className="w-4 h-4 mr-2" />
                {deleteItem.label}
            </Button>
            </>
        )}
      </Card>
    </div>
  );
};

export default ContextMenu;

    