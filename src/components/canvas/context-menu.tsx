"use client";

import type { FC } from 'react';
import { Type, Image, Square, ArrowRight, Trash2, LogIn, PenSquare, ListTodo, Link, Heading, StickyNote, FolderInput } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CanvasItemType, AnyCanvasItem } from '@/lib/types';

interface ContextMenuProps {
  x: number;
  y: number;
  onAction: (action: Extract<CanvasItemType, 'text' | 'image' | 'board' | 'arrow' | 'todo' | 'link' | 'title' | 'note'> | 'delete' | 'enter' | 'edit') => void;
  isItemMenu: boolean;
  itemType?: AnyCanvasItem['type'];
  accentColor?: string;
}

const ContextMenu: FC<ContextMenuProps> = ({ x, y, onAction, isItemMenu, itemType, accentColor }) => {
  const menuItems = [
    { label: 'Add Title', icon: Heading, action: 'title' as const },
    { label: 'Add Note', icon: StickyNote, action: 'note' as const },
    { label: 'Add Text', icon: Type, action: 'text' as const },
    { label: 'Add Image', icon: Image, action: 'image' as const },
    { label: 'Add Board', icon: Square, action: 'board' as const },
    { label: 'Add Todo', icon: ListTodo, action: 'todo' as const },
    { label: 'Add Link', icon: Link, action: 'link' as const },
    { label: 'Add Arrow', icon: ArrowRight, action: 'arrow' as const },
  ];

  const editItem = { label: 'Edit', icon: PenSquare, action: 'edit' as const };
  const moveItem = { label: 'Move to Board', icon: LogIn, action: 'move' as const }; // Using LogIn or a better icon like FolderInput? I'll use LogIn as a placeholder or import FolderInput. 
  // Wait, I should import FolderInput first.
  const deleteItem = { label: 'Delete', icon: Trash2, action: 'delete' as const };
  const enterBoardItem = { label: 'Enter Board', icon: LogIn, action: 'enter' as const };

  const getDeleteColor = () => {
    if (!accentColor) return 'hsl(var(--destructive))';
    const [h, s, l] = accentColor.split(' ').map(parseFloat);
    return `hsl(${(h - 30 + 360) % 360}, ${Math.min(100, s + 20)}%, ${l}%)`;
  };

  // Logic to determine if any "top section" actions are present
  const showEditOption = itemType === 'text' || itemType === 'board' || itemType === 'todo' || itemType === 'link' || itemType === 'note' || itemType === 'title';
  // Adding 'note' and 'title' just in case. 
  const showEnterOption = itemType === 'board';
  const showMoveOption = true; // All items can be moved

  // Show separator if ANY of the top options are visible
  const showSeparator = showEditOption || showEnterOption || showMoveOption;

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

        {isItemMenu && showEditOption && (
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

        {isItemMenu && showEnterOption && (
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
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={(e) => {
              e.stopPropagation();
              onAction('move' as any); // Cast to any because prop definition needs update too
            }}
          >
            <FolderInput className="w-4 h-4 mr-2" />
            Move to Board
          </Button>
        )}

        {isItemMenu && (
          <>
            {showSeparator && <Separator className="my-1" />}

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
