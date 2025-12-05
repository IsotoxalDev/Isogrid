"use client";

import type { FC } from 'react';
import { BoardSettings, GridStyle } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface GridSettingsProps {
  settings: BoardSettings;
  onSettingsChange: (settings: Partial<BoardSettings>) => void;
}

const GridSettings: FC<GridSettingsProps> = ({ settings, onSettingsChange }) => {
  return (
    <div className="grid gap-4">
      <h4 className="font-medium leading-none">Grid Settings</h4>
      <div className="grid gap-2">
        <Label>Style</Label>
        <RadioGroup
          defaultValue={settings.gridStyle || 'dots'}
          onValueChange={(value: GridStyle) => onSettingsChange({ gridStyle: value })}
          className="flex space-x-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="dots" id="dots" />
            <Label htmlFor="dots">Dots</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="lines" id="lines" />
            <Label htmlFor="lines">Lines</Label>
          </div>
        </RadioGroup>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="grid-opacity">Opacity</Label>
        <Slider
          id="grid-opacity"
          min={0}
          max={1}
          step={0.1}
          defaultValue={[settings.gridOpacity || 0.5]}
          onValueChange={(value) => onSettingsChange({ gridOpacity: value[0] })}
        />
      </div>
    </div>
  );
};

export default GridSettings;
