"use client";

import type { FC } from 'react';
import { CanvasItemData } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '../ui/separator';

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
      <Separator />
      <div className="grid gap-2">
        <Label htmlFor="item-opacity">Opacity</Label>
        <Slider
          id="item-opacity"
          min={0}
          max={1}
          step={0.1}
          defaultValue={[averageOpacity]}
          onValueChange={(value) => onSettingsChange({ opacity: value[0] })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="item-blur">Background Blur</Label>
        <Slider
          id="item-blur"
          min={0}
          max={20}
          step={1}
          defaultValue={[averageBlur]}
          onValueChange={(value) => onSettingsChange({ backgroundBlur: value[0] })}
        />
      </div>
    </div>
  );
};

export default ItemSettingsPopover;
