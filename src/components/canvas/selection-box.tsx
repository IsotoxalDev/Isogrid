"use client";

import type { FC } from 'react';
import { Point } from '@/lib/types';

interface SelectionBoxProps {
  start: Point;
  end: Point;
}

const SelectionBox: FC<SelectionBoxProps> = ({ start, end }) => {
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x),
    height: Math.abs(start.y - end.y),
    border: '1px solid hsl(var(--primary))',
    backgroundColor: 'hsl(var(--primary) / 0.1)',
    pointerEvents: 'none',
    zIndex: 100,
  };

  return <div style={style} />;
};

export default SelectionBox;
