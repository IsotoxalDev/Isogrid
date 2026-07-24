
"use client";

import type { FC } from 'react';
import { BoardSettings, GridStyle } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { LogOut, X } from 'lucide-react';
import { cn, hexToHslString, hslStringToHex } from '@/lib/utils';


interface SettingsPopoverProps {
    settings: BoardSettings;
    onSettingsChange: (settings: Partial<BoardSettings>) => void;
    zoom: number;
    onZoomChange: (newZoom: number) => void;
    onExport: () => void;
    onImport: () => void;
    onSignOut: () => void;
    isGuest?: boolean;
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

const PRESET_GRID_COLORS = [
    "#888888",
    "#ffffff",
    "#000000",
    "#74c9c4",
    "#6b8fd8",
    "#d86a6a",
];

const PRESET_BACKGROUNDS = [
    "#ffffff",
    "#f5f5f4",
    "#e7e5e4",
    "#111111",
    "#1c1c1e",
    "#0f172a",
    "#1e293b",
    "#0c1f17",
];

const SettingsPopover: FC<SettingsPopoverProps> = ({ settings, onSettingsChange, zoom, onZoomChange, onExport, onImport, onSignOut, isGuest }) => {

    const handleColorChange = (newColor: string) => {
        onSettingsChange({ accentColor: newColor });
    };

    const handleBackgroundColorChange = (newColor: string) => {
        onSettingsChange({ canvasBackgroundColor: newColor });
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
                <div className="flex flex-wrap items-center gap-2">
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
                    <div className="relative flex items-center justify-center w-6 h-6">
                        <div
                            className="w-6 h-6 rounded-full border-2 border-dashed border-muted-foreground pointer-events-none"
                            style={{ backgroundColor: settings.accentColor ? `hsl(${settings.accentColor})` : 'transparent' }}
                        />
                        <input
                            id="accent-color"
                            type="color"
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            value={settings.accentColor ? hslStringToHex(settings.accentColor) : '#c5d868'}
                            onChange={(e) => handleColorChange(hexToHslString(e.target.value))}
                        />
                    </div>
                </div>
            </div>

            <div className="grid gap-2">
                <Label htmlFor="canvas-background-color">Canvas Background</Label>
                <div className="flex flex-wrap items-center gap-2">
                    {PRESET_BACKGROUNDS.map(color => (
                        <button
                            key={color}
                            className="w-6 h-6 rounded-full border-2"
                            style={{
                                backgroundColor: color,
                                borderColor: settings.canvasBackgroundColor === color ? `hsl(var(--foreground))` : 'transparent'
                            }}
                            onClick={() => handleBackgroundColorChange(color)}
                        />
                    ))}
                    <div className="relative flex items-center justify-center w-6 h-6">
                        <div
                            className="w-6 h-6 rounded-full border-2 border-dashed border-muted-foreground pointer-events-none"
                            style={{ backgroundColor: settings.canvasBackgroundColor || 'transparent' }}
                        />
                        <input
                            id="canvas-background-color"
                            type="color"
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            value={settings.canvasBackgroundColor || '#ffffff'}
                            onChange={(e) => handleBackgroundColorChange(e.target.value)}
                        />
                    </div>
                    {settings.canvasBackgroundColor && (
                        <Button variant="ghost" size="sm" onClick={() => onSettingsChange({ canvasBackgroundColor: undefined })}>
                            <X className="w-3 h-3 mr-1" />
                            Reset
                        </Button>
                    )}
                </div>
            </div>

            <div className={cn('grid gap-2', !settings.showGrid && 'opacity-50 pointer-events-none')}>
                <Label htmlFor="grid-color">Grid Color</Label>
                <div className="flex flex-wrap items-center gap-2">
                    {PRESET_GRID_COLORS.map(color => (
                        <button
                            key={color}
                            className="w-6 h-6 rounded-full border-2"
                            style={{
                                backgroundColor: color,
                                borderColor: settings.gridColor === color ? `hsl(var(--foreground))` : 'transparent'
                            }}
                            onClick={() => onSettingsChange({ gridColor: color })}
                        />
                    ))}
                    <div className="relative flex items-center justify-center w-6 h-6">
                        <div
                            className="w-6 h-6 rounded-full border-2 border-dashed border-muted-foreground pointer-events-none"
                            style={{ backgroundColor: settings.gridColor || 'transparent' }}
                        />
                        <input
                            id="grid-color"
                            type="color"
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            value={settings.gridColor || '#888888'}
                            onChange={(e) => onSettingsChange({ gridColor: e.target.value })}
                        />
                    </div>
                    {settings.gridColor && (
                        <Button variant="ghost" size="sm" onClick={() => onSettingsChange({ gridColor: undefined })}>
                            <X className="w-3 h-3 mr-1" />
                            Reset
                        </Button>
                    )}
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

            <div className={cn('flex items-center justify-between', !settings.showGrid && 'opacity-50 pointer-events-none')}>
                <Label htmlFor="snap-toggle" className="font-medium">Snap to Grid</Label>
                <Switch
                    id="snap-toggle"
                    checked={settings.snapToGrid ?? false}
                    onCheckedChange={(checked) => onSettingsChange({ snapToGrid: checked })}
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

                <div className="grid gap-2 mt-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="grid-thickness">Grid Thickness</Label>
                        <span className="text-xs text-muted-foreground">{(settings.gridThickness ?? 1).toFixed(1)}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Slider
                            id="grid-thickness"
                            min={0.5}
                            max={5}
                            step={0.5}
                            value={[settings.gridThickness ?? 1]}
                            onValueChange={(value) => onSettingsChange({ gridThickness: value[0] })}
                        />
                        <Button variant="ghost" size="sm" onClick={() => onSettingsChange({ gridThickness: 1 })}>Reset</Button>
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
                <h4 className="font-medium leading-none">Data</h4>
                <div className="flex gap-2">
                    <Button variant="outline" className="w-full" onClick={onImport}>Import from JSON</Button>
                    <Button variant="outline" className="w-full" onClick={onExport}>Export to JSON</Button>
                </div>
            </div>
            <Separator />
            {!isGuest && (
                <Button variant="ghost" className="w-full justify-start" onClick={onSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                </Button>
            )}
            {isGuest && (
                <Button variant="default" className="w-full justify-center mt-2" onClick={() => window.location.href = '/login'}>
                    Sign In & Save
                </Button>
            )}
        </div>
    );
};

export default SettingsPopover;
