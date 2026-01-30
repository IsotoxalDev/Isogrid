
"use client";

import { type FC, useState, useEffect, useCallback } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Plus,
  Minus,
  Blend,
  BoxSelect,
  Palette,
} from 'lucide-react';
import { CanvasItemData, TextAlign, FontWeight, FontStyle, TextDecoration } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface FormattingToolbarProps {
  items: CanvasItemData[];
  onUpdate: (updates: (Partial<CanvasItemData> & { id: string })[]) => void;
  activeTextarea: HTMLTextAreaElement | null;
  onTextareaUpdate: (update: Partial<CanvasItemData> & { id: string }) => void;
  onBlur: () => void;
}

const FormattingToolbar: FC<FormattingToolbarProps> = ({ items, onUpdate, activeTextarea, onTextareaUpdate, onBlur }) => {
  const [currentItem, setCurrentItem] = useState<CanvasItemData | null>(null);
  const [currentLine, setCurrentLine] = useState(0);

  const getSelectionDetails = useCallback(() => {
    if (!activeTextarea) return { line: 0, item: null };
    const itemId = activeTextarea.closest('[data-item-id]')?.getAttribute('data-item-id');
    const item = items.find(i => i.id === itemId) || null;
    const line = activeTextarea.value.substring(0, activeTextarea.selectionStart).split('\n').length - 1;
    return { line, item };
  }, [activeTextarea, items]);

  useEffect(() => {
    const { line, item } = getSelectionDetails();
    setCurrentLine(line);
    setCurrentItem(item);

    const handleSelectionChange = () => {
      const { line: newLine, item: newItem } = getSelectionDetails();
      setCurrentLine(newLine);
      setCurrentItem(newItem);
    };

    const handleBlur = (e: FocusEvent) => {
      if (!e.currentTarget || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
        onBlur();
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange);
    activeTextarea?.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      activeTextarea?.removeEventListener('blur', handleBlur);
    };
  }, [activeTextarea, getSelectionDetails, onBlur]);

  if (items.length === 0 && !activeTextarea) return null;

  const targetItems = activeTextarea ? (currentItem ? [currentItem] : []) : items;
  if (targetItems.length === 0) return null;

  const getCommonValue = <T,>(prop: keyof CanvasItemData, defaultValue: T): T => {
    const firstValue = targetItems[0][prop] as T | undefined;
    if (targetItems.every((item) => (item[prop] as T | undefined ?? defaultValue) === (firstValue ?? defaultValue))) {
      return firstValue ?? defaultValue;
    }
    return defaultValue; // Return default if values are mixed
  };

  const commonFontSize = getCommonValue<number>('fontSize', 16);
  const commonFontWeight = getCommonValue<FontWeight>('fontWeight', 'normal');
  const commonFontStyle = getCommonValue<FontStyle>('fontStyle', 'normal');
  const commonTextDecoration = getCommonValue<TextDecoration>('textDecoration', 'none');
  const commonTextAlign = currentItem?.textAligns?.[currentLine] || currentItem?.textAlign || 'left';

  const commonTitleShadow = getCommonValue('titleShadow', false);
  const commonTitleOutline = getCommonValue('titleOutline', false);
  const commonColor = getCommonValue('color', undefined);
  const isTitle = targetItems.some(i => i.type === 'title');

  const handleUpdate = (update: Partial<Omit<CanvasItemData, 'id' | 'textAligns'>>) => {
    const updates = targetItems.map((item) => ({ id: item.id, ...update }));
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

  const handleTextAlignChange = (newAlign: TextAlign) => {
    if (activeTextarea && currentItem) {
      const newAlignments = [...(currentItem.textAligns || [])];
      newAlignments[currentLine] = newAlign;
      onTextareaUpdate({ id: currentItem.id, textAligns: newAlignments });
    } else {
      const updates = targetItems.map((item) => {
        const numLines = item.content.split('\n').length;
        return {
          id: item.id,
          textAligns: Array(numLines).fill(newAlign),
        }
      });
      onUpdate(updates as any);
    }
  };


  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
      <div className="flex items-center gap-1 p-1 rounded-lg bg-background/80 backdrop-blur-sm border shadow-lg">
        <Button
          variant="ghost"
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleTextAlignChange('left')}
          className={cn(commonTextAlign === 'left' && 'bg-accent')}
        >
          <AlignLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleTextAlignChange('center')}
          className={cn(commonTextAlign === 'center' && 'bg-accent')}
        >
          <AlignCenter className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleTextAlignChange('right')}
          className={cn(commonTextAlign === 'right' && 'bg-accent')}
        >
          <AlignRight className="w-4 h-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleToggle('fontWeight', 'bold', 'normal')}
          className={cn(commonFontWeight === 'bold' && 'bg-accent')}
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleToggle('fontStyle', 'italic', 'normal')}
          className={cn(commonFontStyle === 'italic' && 'bg-accent')}
        >
          <Italic className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleToggle('textDecoration', 'underline', 'none')}
          className={cn(commonTextDecoration === 'underline' && 'bg-accent')}
        >
          <Underline className="w-4 h-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <div className="relative flex items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0"
            title="Text Color"
          >
            <Palette className="w-4 h-4" style={{ color: commonColor || 'currentColor' }} />
          </Button>
          <input
            type="color"
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            value={commonColor || (targetItems[0]?.type === 'title' ? '#ffffff' : '#000000')}
            onChange={(e) => handleUpdate({ color: e.target.value })}
          />
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {isTitle && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleToggle('titleShadow', true, false)}
              className={cn(commonTitleShadow && 'bg-accent')}
              title="Toggle Shadow"
            >
              <Blend className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleToggle('titleOutline', true, false)}
              className={cn(commonTitleOutline && 'bg-accent')}
              title="Toggle Outline"
            >
              <BoxSelect className="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" className="h-6 mx-1" />
          </>
        )}

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onMouseDown={(e) => e.preventDefault()} onClick={() => handleFontSizeChange(-1)}>
            <Minus className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium w-8 text-center">{commonFontSize}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onMouseDown={(e) => e.preventDefault()} onClick={() => handleFontSizeChange(1)}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FormattingToolbar;
