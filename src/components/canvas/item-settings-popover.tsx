"use client";

import type { FC } from 'react';
import { CanvasItemData } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';

interface ItemSettingsPopoverProps {
  items: CanvasItemData[];
  onSettingsChange: (settings: Partial<CanvasItemData>) => void;
}

const ItemSettingsPopover: FC<ItemSettingsPopoverProps> = ({ items, onSettingsChange }) => {
  if (items.length === 0) return null;

  const averageOpacity = items.reduce((sum, item) => sum + (item.opacity ?? 1), 0) / items.length;
  const averageBlur = items.reduce((sum, item) => sum + (item.backgroundBlur ?? 0), 0) / items.length;

  return (
    <div className="grid gap-4">
      <h4 className="font-medium leading-none">Component Settings</h4>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
            <Label htmlFor="item-opacity">Opacity</Label>
            <span className="text-xs text-muted-foreground">{Math.round(averageOpacity * 100)}%</span>
        </div>
        <div className="flex items-center gap-2">
            <Slider
              id="item-opacity"
              min={0}
              max={1}
              step={0.1}
              value={[averageOpacity]}
              onValueChange={(value) => onSettingsChange({ opacity: value[0] })}
            />
            <Button variant="ghost" size="sm" onClick={() => onSettingsChange({ opacity: 1 })}>Reset</Button>
        </div>
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
            <Label htmlFor="item-blur">Background Blur</Label>
            <span className="text-xs text-muted-foreground">{Math.round(averageBlur)}px</span>
        </div>
        <div className="flex items-center gap-2">
            <Slider
              id="item-blur"
              min={0}
              max={40}
              step={1}
              value={[averageBlur]}
              onValueChange={(value) => onSettingsChange({ backgroundBlur: value[0] })}
            />
            <Button variant="ghost" size="sm" onClick={() => onSettingsChange({ backgroundBlur: 0 })}>Reset</Button>
        </div>
      </div>
    </div>
  );
};

export default ItemSettingsPopover;
