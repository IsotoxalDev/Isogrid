"use client";

import type { FC } from 'react';
import { ArrowData } from '@/lib/types';

interface ArrowRendererProps {
  arrows: ArrowData[];
}

const ArrowRenderer: FC<ArrowRendererProps> = ({ arrows }) => {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" />
        </marker>
      </defs>
      {arrows.map(arrow => {
        if (!arrow.start || !arrow.end) return null;
        
        const dx = arrow.end.x - arrow.start.x;
        const dy = arrow.end.y - arrow.start.y;
        const length = Math.sqrt(dx*dx + dy*dy);
        const unitDx = dx / length;
        const unitDy = dy / length;

        // Subtract arrowhead length from the end point
        const endX = arrow.end.x - unitDx * 10;
        const endY = arrow.end.y - unitDy * 10;

        return (
          <line
            key={arrow.id}
            x1={arrow.start.x}
            y1={arrow.start.y}
            x2={endX}
            y2={endY}
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            markerEnd="url(#arrowhead)"
          />
        );
      })}
    </svg>
  );
};

export default ArrowRenderer;
