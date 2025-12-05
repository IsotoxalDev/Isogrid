"use client";

import type { FC } from 'react';
import { Grid } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import GridSettings from './grid-settings';
import { BoardSettings } from '@/lib/types';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';

interface ToolbarProps {
  settings: BoardSettings;
  onSettingsChange: (settings: Partial<BoardSettings>) => void;
}

const Toolbar: FC<ToolbarProps> = ({ settings, onSettingsChange }) => {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 p-1 rounded-lg bg-background/80 backdrop-blur-sm flex items-center space-x-2">
      <div className="flex items-center space-x-2">
        <Switch 
          id="grid-toggle" 
          checked={settings.showGrid} 
          onCheckedChange={(checked) => onSettingsChange({ showGrid: checked })}
        />
        <Label htmlFor="grid-toggle">Grid</Label>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" disabled={!settings.showGrid}>
            <Grid className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <GridSettings settings={settings} onSettingsChange={onSettingsChange} />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default Toolbar;
