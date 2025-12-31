"use client";

import type { FC } from 'react';
import { BoardSettings, GridStyle } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';


interface SettingsPopoverProps {
  settings: BoardSettings;
  onSettingsChange: (settings: Partial<BoardSettings>) => void;
}

const PRESET_COLORS = [
    "0 59% 63%", // #D86A6A
    "30 73% 62%", // #E4A35A
    "54 62% 61%", // #DCCF5A
    "72 56% 63%", // #C5D868
    "176 43% 62%", // #74C9C4
    "223 57% 63%", // #6B8FD8
    "274 54% 69%", // #A58BD8
    "326 55% 69%", // #D88CB5
];

const SettingsPopover: FC<SettingsPopoverProps> = ({ settings, onSettingsChange }) => {
  
    const handleColorChange = (newColor: string) => {
        onSettingsChange({ accentColor: newColor });
    };

    return (
        <div className="grid gap-4">
            <h4 className="font-medium leading-none">Board Settings</h4>
            <div className="grid gap-2">
                <Label htmlFor="accent-color">Accent Color</Label>
                <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map(color => (
                        <button
                            key={color}
                            className="w-6 h-6 rounded-full border-2"
                            style={{ 
                                backgroundColor: `hsl(${color})`,
                                borderColor: settings.accentColor === color ? `hsl(var(--foreground))` : 'transparent'
                            }}
                            onClick={() => handleColorChange(color)}
                        />
                    ))}
                </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
                <Label htmlFor="grid-toggle" className="font-medium">Show Grid</Label>
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
                    defaultValue={[settings.vignetteStrength || 0]}
                    onValueChange={(value) => onSettingsChange({ vignetteStrength: value[0] })}
                    />
                </div>
            </div>
        </div>
    );
};

export default SettingsPopover;
