"use client";

import type { FC } from 'react';
import { Type, Image, Square, ArrowRight, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CanvasItemType } from '@/lib/types';

interface ContextMenuProps {
  x: number;
  y: number;
  onAction: (action: CanvasItemType | 'connect' | 'delete') => void;
  isItemMenu: boolean;
  accentColor?: string;
}

const ContextMenu: FC<ContextMenuProps> = ({ x, y, onAction, isItemMenu, accentColor }) => {
  const menuItems = [
    { label: 'Add Text', icon: Type, action: 'text' as CanvasItemType },
    { label: 'Add Image', icon: Image, action: 'image' as CanvasItemType },
    { label: 'Add Board', icon: Square, action: 'board' as CanvasItemType },
  ];
  
  const connectionItem = { label: 'Connect', icon: ArrowRight, action: 'connect' };
  const deleteItem = { label: 'Delete', icon: Trash2, action: 'delete' };

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
        {isItemMenu && (
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={(e) => {
              e.stopPropagation();
              onAction(connectionItem.action);
            }}
          >
            <connectionItem.icon className="w-4 h-4 mr-2" />
            {connectionItem.label}
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
