'use client';

import { ArrowData, Point } from '@/lib/types';
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
const HANDLE_CLICK_RADIUS = 12;

export default function InteractiveArrow({ arrow, zoom, onUpdate, onClick, isSelected }: InteractiveArrowProps) {
  const latestProps = useRef({ arrow, zoom, onUpdate, onClick });
  latestProps.current = { arrow, zoom, onUpdate, onClick };

  const handleHandleMouseDown = (e: MouseEvent, handle: 'start' | 'end') => {
    e.stopPropagation();
    e.preventDefault();

    const dragStartPos = { x: e.clientX, y: e.clientY };
    const initialArrowPos = { start: { ...latestProps.current.arrow.start }, end: { ...latestProps.current.arrow.end } };

    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {

      const { zoom: currentZoom, onUpdate: currentOnUpdate, arrow: currentArrow } = latestProps.current;

      const dx = (moveEvent.clientX - dragStartPos.x) / currentZoom;
      const dy = (moveEvent.clientY - dragStartPos.y) / currentZoom;

      const newPoint = {
        x: initialArrowPos[handle].x + dx,
        y: initialArrowPos[handle].y + dy,
      };

      currentOnUpdate({
        id: currentArrow.id,
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

  let endX = arrow.end.x;
  let endY = arrow.end.y;
  
  if (length > 0) {
    const unitDx = dx / length;
    const unitDy = dy / length;
  
    endX = arrow.end.x - unitDx * 10; 
    endY = arrow.end.y - unitDy * 10;
  }


  return (
    <g data-arrow-id={arrow.id} 
       onClick={(e) => latestProps.current.onClick(e)}
       style={{ cursor: 'pointer' }}>
      <line
        x1={arrow.start.x}
        y1={arrow.start.y}
        x2={endX}
        y2={endY}
        stroke={isSelected ? 'hsl(var(--ring))' : 'hsl(var(--primary))'}
        strokeWidth="2"
        markerEnd="url(#arrowhead)"
      />
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
            style={{ pointerEvents: 'none' }}
          />
          <circle
            cx={arrow.start.x}
            cy={arrow.start.y}
            r={HANDLE_CLICK_RADIUS / zoom}
            fill="transparent"
            style={{ cursor: 'grab' }}
            onMouseDown={(e) => handleHandleMouseDown(e, 'start')}
            className="active:cursor-grabbing"
          />

          <circle
            cx={arrow.end.x}
            cy={arrow.end.y}
            r={HANDLE_SIZE / zoom}
            fill="hsl(var(--background))"
            stroke="hsl(var(--ring))"
            strokeWidth={2 / zoom}
            style={{ pointerEvents: 'none' }}
          />
          <circle
            cx={arrow.end.x}
            cy={arrow.end.y}
            r={HANDLE_CLICK_RADIUS / zoom}
            fill="transparent"
            style={{ cursor: 'grab' }}
            onMouseDown={(e) => handleHandleMouseDown(e, 'end')}
            className="active:cursor-grabbing"
          />
        </>
      )}
    </g>
  );
}
