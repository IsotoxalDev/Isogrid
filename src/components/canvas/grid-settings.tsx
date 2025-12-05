"use client";

import type { FC } from 'react';
import { BoardSettings, GridStyle } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Separator } from '../ui/separator';

interface GridSettingsProps {
  settings: BoardSettings;
  onSettingsChange: (settings: Partial<BoardSettings>) => void;
}

const GridSettings: FC<GridSettingsProps> = ({ settings, onSettingsChange }) => {
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium leading-none">Grid Settings</h4>
        <Switch 
          id="grid-toggle" 
          checked={settings.showGrid} 
          onCheckedChange={(checked) => onSettingsChange({ showGrid: checked })}
        />
      </div>
      
      <div className={!settings.showGrid ? 'opacity-50 pointer-events-none' : ''}>
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
        <Separator className="my-4"/>
        <div className="grid gap-2">
            <Label htmlFor="grid-opacity">Grid Opacity</Label>
            <Slider
            id="grid-opacity"
            min={0}
            max={1}
            step={0.1}
            defaultValue={[settings.gridOpacity || 0.5]}
            onValueChange={(value) => onSettingsChange({ gridOpacity: value[0] })}
            />
        </div>
        <Separator className="my-4"/>
        <div className="grid gap-2">
            <Label htmlFor="vignette-strength">Vignette Strength</Label>
            <Slider
            id="vignette-strength"
            min={0}
            max={100}
            step={1}
            defaultValue={[settings.vignetteStrength || 25]}
            onValueChange={(value) => onSettingsChange({ vignetteStrength: value[0] })}
            />
        </div>
      </div>
    </div>
  );
};

export default GridSettings;
