"use client";

import type { FC } from 'react';
import { ArrowData, CanvasItemData, Point } from '@/lib/types';

interface ArrowRendererProps {
  arrows: ArrowData[];
  items: CanvasItemData[];
}

const ArrowRenderer: FC<ArrowRendererProps> = ({ arrows, items }) => {
  const itemsById = new Map(items.map(item => [item.id, item]));

  const getIntersectionPoint = (fromItem: CanvasItemData, toItem: CanvasItemData): { start: Point, end: Point } => {
    const from = {
        x: fromItem.position.x + fromItem.width / 2,
        y: fromItem.position.y + fromItem.height / 2,
        width: fromItem.width,
        height: fromItem.height,
    };
    const to = {
        x: toItem.position.x + toItem.width / 2,
        y: toItem.position.y + toItem.height / 2,
        width: toItem.width,
        height: toItem.height,
    };

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);

    const calcIntersection = (item: {width: number, height: number}, angle: number): Point => {
        const w = item.width / 2;
        const h = item.height / 2;
        const tan = Math.tan(angle);
        const region = Math.abs(angle) > Math.PI / 4 && Math.abs(angle) < 3 * Math.PI / 4;

        let x, y;
        if (region) { // Top or bottom
            y = Math.sign(dy) * h;
            x = y / tan;
        } else { // Left or right
            x = Math.sign(dx) * w;
            y = x * tan;
        }
        return { x, y };
    }

    const startOffset = calcIntersection(fromItem, angle);
    const endOffset = calcIntersection(toItem, angle - Math.PI);

    return {
        start: { x: from.x + startOffset.x, y: from.y + startOffset.y },
        end: { x: to.x + endOffset.x, y: to.y + endOffset.y },
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

        const { start, end } = getIntersectionPoint(fromItem, toItem);
        
        return (
          <line
            key={arrow.id}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
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
