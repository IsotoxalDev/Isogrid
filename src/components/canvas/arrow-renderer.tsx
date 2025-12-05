"use client";

import type { FC } from 'react';
import { ArrowData, CanvasItemData } from '@/lib/types';

interface ArrowRendererProps {
  arrows: ArrowData[];
  items: CanvasItemData[];
}

const ArrowRenderer: FC<ArrowRendererProps> = ({ arrows, items }) => {
  const itemsById = new Map(items.map(item => [item.id, item]));

  const getCenter = (item: CanvasItemData) => {
    return {
      x: item.position.x + item.width / 2,
      y: item.position.y + item.height / 2,
    };
  };

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
        const fromItem = itemsById.get(arrow.from);
        const toItem = itemsById.get(arrow.to);

        if (!fromItem || !toItem) return null;

        const p1 = getCenter(fromItem);
        const p2 = getCenter(toItem);
        
        return (
          <line
            key={arrow.id}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
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
