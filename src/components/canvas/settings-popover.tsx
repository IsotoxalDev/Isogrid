"use client";

import type { FC } from 'react';
import { BoardSettings } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface SettingsPopoverProps {
  settings: BoardSettings;
  onSettingsChange: (settings: Partial<BoardSettings>) => void;
}

const PRESET_COLORS = [
    "73 56% 60%", // Default Green
    "210 40% 96.1%", // Light
    "0 84.2% 60.2%", // Red
    "221.2 83.2% 53.3%", // Blue
    "47.9 95.8% 53.1%", // Yellow
    "142.1 76.2% 36.3%", // Green
    "262.1 83.3% 57.8%", // Purple
    "346.8 77.2% 49.8%", // Pink
];

const SettingsPopover: FC<SettingsPopoverProps> = ({ settings, onSettingsChange }) => {
  
    const handleColorChange = (newColor: string) => {
        onSettingsChange({ accentColor: newColor });
    };

    return (
        <div className="grid gap-4">
            <h4 className="font-medium leading-none">Settings</h4>
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
        </div>
    );
};

export default SettingsPopover;
