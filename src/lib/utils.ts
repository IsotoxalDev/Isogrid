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

export function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '');
  const bigint = parseInt(sanitized.length === 3
    ? sanitized.split('').map(c => c + c).join('')
    : sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function hexToHslString(hex: string): string {
  const sanitized = hex.replace('#', '');
  const bigint = parseInt(sanitized.length === 3
    ? sanitized.split('').map(c => c + c).join('')
    : sanitized, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function hslStringToHex(hslString: string): string {
  const [h, s, l] = hslString.split(' ').map(parseFloat);
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function base64ToBlob(base64: string, mimeType: string = '') {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
}
