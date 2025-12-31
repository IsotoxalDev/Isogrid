"use client";

import type { FC } from 'react';
import { ArrowData } from '@/lib/types';
import { getArrowPath } from '@/lib/utils';
import { items } from 'prismjs';

interface ArrowRendererProps {
  arrows: ArrowData[];
  items: CanvasItemData[];
}

const ArrowRenderer: FC<ArrowRendererProps> = ({ arrows, items }) => {
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
          refX="0"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" />
        </marker>
      </defs>
      {arrows.map(arrow => {
        const startItem = items.find(item => item.id === arrow.start.itemId);
        const endItem = items.find(item => item.id === arrow.end.itemId);
        if(!startItem || !endItem) return null;

        const { path, endPoint } = getArrowPath(startItem, endItem, 10);

        return (
          <path
            key={arrow.id}
            d={path}
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            fill="none"
            markerEnd={endPoint ? "url(#arrowhead)" : undefined}
          />
        );
      })}
    </svg>
  );
};

export default ArrowRenderer;
