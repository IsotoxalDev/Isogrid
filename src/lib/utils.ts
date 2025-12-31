import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { CanvasItemData, Point } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getArrowPath(
  startItem: CanvasItemData,
  endItem: CanvasItemData,
  arrowheadSize: number
): { path: string; endPoint: Point | null } {
  const startCenter: Point = {
    x: startItem.position.x + startItem.width / 2,
    y: startItem.position.y + startItem.height / 2,
  };
  const endCenter: Point = {
    x: endItem.position.x + endItem.width / 2,
    y: endItem.position.y + endItem.height / 2,
  };

  const startRect = { ...startItem.position, width: startItem.width, height: startItem.height };
  const endRect = { ...endItem.position, width: endItem.width, height: endItem.height };
  
  const startPoint = getIntersection(startCenter, endCenter, startRect);
  let endPoint = getIntersection(endCenter, startCenter, endRect);

  if (!startPoint || !endPoint) {
    return { path: `M ${startCenter.x} ${startCenter.y} L ${endCenter.x} ${endCenter.y}`, endPoint: null };
  }

  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length < arrowheadSize) {
    endPoint = startPoint;
  } else {
    const unitDx = dx / length;
    const unitDy = dy / length;
    endPoint = {
      x: endPoint.x - unitDx * arrowheadSize,
      y: endPoint.y - unitDy * arrowheadSize
    };
  }

  return { path: `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y}`, endPoint };
}


function getIntersection(
  lineStart: Point,
  lineEnd: Point,
  rect: { x: number; y: number; width: number; height: number }
): Point | null {
  const { x, y, width, height } = rect;
  const sides = [
    { a: { x, y }, b: { x: x + width, y } }, // top
    { a: { x: x + width, y }, b: { x: x + width, y: y + height } }, // right
    { a: { x: x + width, y: y + height }, b: { x, y: y + height } }, // bottom
    { a: { x, y: y + height }, b: { x, y } }, // left
  ];

  let closestIntersection: Point | null = null;
  let minDistance = Infinity;

  for (const side of sides) {
    const intersection = lineIntersect(lineStart, lineEnd, side.a, side.b);
    if (intersection) {
      const distance = Math.sqrt(Math.pow(lineStart.x - intersection.x, 2) + Math.pow(lineStart.y - intersection.y, 2));
      if (distance < minDistance) {
        minDistance = distance;
        closestIntersection = intersection;
      }
    }
  }

  return closestIntersection;
}


function lineIntersect(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const den = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (den === 0) return null; // Parallel

  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / den;
  const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / den;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    };
  }

  return null;
}
