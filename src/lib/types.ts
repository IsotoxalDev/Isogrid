export type Point = {
  x: number;
  y: number;
};

export type CanvasItemType = 'text' | 'image' | 'board' | 'arrow';

export interface CanvasItemData {
  id: string;
  type: Extract<CanvasItemType, 'text' | 'image' | 'board'>;
  position: Point;
  width: number;
  height: number;
  content: string; // For text content, image src, or board title
  parentId: string | null; // null for root board
}

export interface ArrowData {
  id:string;
  type: 'arrow';
  start: Point;
  end: Point;
  parentId: string | null; // null for root board
}

export type AnyCanvasItem = CanvasItemData | ArrowData;

export interface ViewState {
  zoom: number;
  pan: Point;
}

export type GridStyle = 'dots' | 'lines';

export interface BoardSettings {
    accentColor?: string; // HSL string e.g., "240 5.9% 10%"
    showGrid?: boolean;
    gridStyle?: GridStyle;
    gridOpacity?: number;
}

export interface Board {
    id: string;
    name: string;
    settings: BoardSettings;
}
