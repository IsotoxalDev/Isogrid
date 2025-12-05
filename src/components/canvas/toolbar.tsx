"use client";

import type { FC } from 'react';
import { Grid } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ToolbarProps {
  showGrid: boolean;
  onToggleGrid: () => void;
}

const Toolbar: FC<ToolbarProps> = ({ showGrid, onToggleGrid }) => {
  return (
    <TooltipProvider>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <Card className="p-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant={showGrid ? "secondary" : "ghost"} size="icon" onClick={onToggleGrid}>
                <Grid className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle Grid</p>
            </TooltipContent>
          </Tooltip>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default Toolbar;
