'use client';

import { ArrowData, Point } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MouseEvent, useRef } from 'react';

interface InteractiveArrowProps {
  arrow: ArrowData;
  zoom: number;
  onUpdate: (update: Partial<ArrowData> & { id: string }) => void;
  onClick: (event: MouseEvent) => void;
  isSelected: boolean;
}

const HANDLE_SIZE = 8;
const LINE_CLICK_WIDTH = 10;

export default function InteractiveArrow({ arrow, zoom, onUpdate, onClick, isSelected }: InteractiveArrowProps) {
  const lineRef = useRef<SVGLineElement>(null);

  const handleHandleMouseDown = (e: MouseEvent, handle: 'start' | 'end') => {
    e.stopPropagation();
    e.preventDefault();

    const dragStartPos = { x: e.clientX, y: e.clientY };
    const initialArrowPos = { start: { ...arrow.start }, end: { ...arrow.end } };

    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
      const dx = (moveEvent.clientX - dragStartPos.x) / zoom;
      const dy = (moveEvent.clientY - dragStartPos.y) / zoom;

      const newPoint = {
        x: initialArrowPos[handle].x + dx,
        y: initialArrowPos[handle].y + dy,
      };

      onUpdate({
        id: arrow.id,
        [handle]: newPoint,
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };
  
  const dx = arrow.end.x - arrow.start.x;
  const dy = arrow.end.y - arrow.start.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) return null;

  const unitDx = dx / length;
  const unitDy = dy / length;

  const endX = arrow.end.x - unitDx * 10; // 10 is the markerWidth
  const endY = arrow.end.y - unitDy * 10;


  return (
    <g data-arrow-id={arrow.id} onClick={onClick} style={{ cursor: 'pointer' }}>
      <line
        ref={lineRef}
        x1={arrow.start.x}
        y1={arrow.start.y}
        x2={endX}
        y2={endY}
        stroke={isSelected ? 'hsl(var(--ring))' : 'hsl(var(--primary))'}
        strokeWidth="2"
        markerEnd="url(#arrowhead)"
      />
      {/* Invisible wider line for easier clicking */}
      <line
        x1={arrow.start.x}
        y1={arrow.start.y}
        x2={arrow.end.x}
        y2={arrow.end.y}
        stroke="transparent"
        strokeWidth={LINE_CLICK_WIDTH}
        style={{ pointerEvents: 'stroke' }}
      />
      
      {isSelected && (
        <>
          <circle
            cx={arrow.start.x}
            cy={arrow.start.y}
            r={HANDLE_SIZE / zoom}
            fill="hsl(var(--background))"
            stroke="hsl(var(--ring))"
            strokeWidth={2 / zoom}
            onMouseDown={(e) => handleHandleMouseDown(e, 'start')}
            style={{ cursor: 'grab' }}
          />
          <circle
            cx={arrow.end.x}
            cy={arrow.end.y}
            r={HANDLE_SIZE / zoom}
            fill="hsl(var(--background))"
            stroke="hsl(var(--ring))"
            strokeWidth={2 / zoom}
            onMouseDown={(e) => handleHandleMouseDown(e, 'end')}
            style={{ cursor: 'grab' }}
          />
        </>
      )}
    </g>
  );
}
