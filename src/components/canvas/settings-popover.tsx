
"use client";

import type { FC } from 'react';
import { BoardSettings, GridStyle } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';


interface SettingsPopoverProps {
  settings: BoardSettings;
  onSettingsChange: (settings: Partial<BoardSettings>) => void;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onExport: () => void;
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

const SettingsPopover: FC<SettingsPopoverProps> = ({ settings, onSettingsChange, zoom, onZoomChange, onExport }) => {
  
    const handleColorChange = (newColor: string) => {
        onSettingsChange({ accentColor: newColor });
    };

    return (
        <div className="grid gap-4">
            <div>
              <h4 className="font-medium leading-none">Default Component Settings</h4>
              <div className="grid gap-2 mt-4">
                <div className="flex items-center justify-between">
                    <Label htmlFor="default-opacity">Opacity</Label>
                    <span className="text-xs text-muted-foreground">{Math.round((settings.defaultOpacity ?? 1) * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                    <Slider
                      id="default-opacity"
                      min={0}
                      max={1}
                      step={0.1}
                      value={[settings.defaultOpacity ?? 1]}
                      onValueChange={(value) => onSettingsChange({ defaultOpacity: value[0] })}
                    />
                    <Button variant="ghost" size="sm" onClick={() => onSettingsChange({ defaultOpacity: 1 })}>Reset</Button>
                </div>
              </div>
              <div className="grid gap-2 mt-4">
                 <div className="flex items-center justify-between">
                    <Label htmlFor="default-blur">Background Blur</Label>
                    <span className="text-xs text-muted-foreground">{Math.round(settings.defaultBackgroundBlur ?? 0)}px</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <Slider
                      id="default-blur"
                      min={0}
                      max={40}
                      step={1}
                      value={[settings.defaultBackgroundBlur ?? 0]}
                      onValueChange={(value) => onSettingsChange({ defaultBackgroundBlur: value[0] })}
                    />
                    <Button variant="ghost" size="sm" onClick={() => onSettingsChange({ defaultBackgroundBlur: 0 })}>Reset</Button>
                </div>
              </div>
            </div>

            <Separator />
            
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
                    value={settings.gridStyle || 'dots'}
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
                
                <div className="grid gap-2 mt-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="grid-opacity">Grid Opacity</Label>
                        <span className="text-xs text-muted-foreground">{Math.round((settings.gridOpacity || 0.5) * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Slider
                        id="grid-opacity"
                        min={0}
                        max={1}
                        step={0.1}
                        value={[settings.gridOpacity || 0.5]}
                        onValueChange={(value) => onSettingsChange({ gridOpacity: value[0] })}
                        />
                        <Button variant="ghost" size="sm" onClick={() => onSettingsChange({ gridOpacity: 0.5 })}>Reset</Button>
                    </div>
                </div>
            </div>
            
            <div className="grid gap-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="zoom-slider">Zoom</Label>
                    <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                    <Slider
                        id="zoom-slider"
                        min={0.5}
                        max={3}
                        step={0.1}
                        value={[zoom]}
                        onValueChange={(value) => onZoomChange(value[0])}
                    />
                    <Button variant="ghost" size="sm" onClick={() => onZoomChange(1)}>Reset</Button>
                </div>
            </div>

            <div className="grid gap-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="vignette-intensity">Vignette Intensity</Label>
                    <span className="text-xs text-muted-foreground">{Math.round((settings.vignetteIntensity || 0) * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                    <Slider
                        id="vignette-intensity"
                        min={0}
                        max={1}
                        step={0.1}
                        value={[settings.vignetteIntensity || 0]}
                        onValueChange={(value) => onSettingsChange({ vignetteIntensity: value[0] })}
                    />
                    <Button variant="ghost" size="sm" onClick={() => onSettingsChange({ vignetteIntensity: 0.5 })}>Reset</Button>
                </div>
            </div>
            <Separator />
            <div className="grid gap-2">
                <h4 className="font-medium leading-none">Export</h4>
                <Button variant="outline" onClick={onExport}>Export to JSON</Button>
            </div>
        </div>
    );
};

export default SettingsPopover;
