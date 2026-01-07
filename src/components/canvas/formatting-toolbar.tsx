"use client";

import type { FC } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Plus,
  Minus,
} from 'lucide-react';
import { CanvasItemData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface FormattingToolbarProps {
  items: CanvasItemData[];
  onUpdate: (updates: (Partial<CanvasItemData> & { id: string })[]) => void;
}

const FormattingToolbar: FC<FormattingToolbarProps> = ({ items, onUpdate }) => {
  if (items.length === 0) return null;

  const getCommonValue = <T,>(prop: keyof CanvasItemData, defaultValue: T): T => {
    const firstValue = items[0][prop] as T | undefined;
    if (items.every((item) => (item[prop] as T | undefined ?? defaultValue) === (firstValue ?? defaultValue))) {
      return firstValue ?? defaultValue;
    }
    return defaultValue; // Return default if values are mixed
  };
  
  const commonTextAlign = getCommonValue('textAlign', 'left');
  const commonFontSize = getCommonValue('fontSize', 16);
  const commonFontWeight = getCommonValue('fontWeight', 'normal');
  const commonFontStyle = getCommonValue('fontStyle', 'normal');
  const commonTextDecoration = getCommonValue('textDecoration', 'none');


  const handleUpdate = (update: Partial<Omit<CanvasItemData, 'id'>>) => {
    const updates = items.map((item) => ({ id: item.id, ...update }));
    onUpdate(updates);
  };
  
  const handleToggle = (prop: keyof CanvasItemData, activeValue: any, inactiveValue: any) => {
    const currentValue = getCommonValue(prop, inactiveValue);
    handleUpdate({ [prop]: currentValue === activeValue ? inactiveValue : activeValue });
  };
  
  const handleFontSizeChange = (increment: number) => {
    const newSize = Math.max(8, commonFontSize + increment);
    handleUpdate({ fontSize: newSize });
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
      <div className="flex items-center gap-1 p-1 rounded-lg bg-background/80 backdrop-blur-sm border shadow-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleUpdate({ textAlign: 'left' })}
          className={cn(commonTextAlign === 'left' && 'bg-accent')}
        >
          <AlignLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleUpdate({ textAlign: 'center' })}
          className={cn(commonTextAlign === 'center' && 'bg-accent')}
        >
          <AlignCenter className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleUpdate({ textAlign: 'right' })}
          className={cn(commonTextAlign === 'right' && 'bg-accent')}
        >
          <AlignRight className="w-4 h-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToggle('fontWeight', 'bold', 'normal')}
          className={cn(commonFontWeight === 'bold' && 'bg-accent')}
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToggle('fontStyle', 'italic', 'normal')}
          className={cn(commonFontStyle === 'italic' && 'bg-accent')}
        >
          <Italic className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToggle('textDecoration', 'underline', 'none')}
          className={cn(commonTextDecoration === 'underline' && 'bg-accent')}
        >
          <Underline className="w-4 h-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleFontSizeChange(-1)}>
                <Minus className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium w-8 text-center">{commonFontSize}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleFontSizeChange(1)}>
                <Plus className="w-4 h-4" />
            </Button>
        </div>
      </div>
    </div>
  );
};

export default FormattingToolbar;
