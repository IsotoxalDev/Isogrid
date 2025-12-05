export type Point = {
  x: number;
  y: number;
};

export type CanvasItemType = 'text' | 'image' | 'board';

export interface CanvasItemData {
  id: string;
  type: CanvasItemType;
  position: Point;
  width: number;
  height: number;
  content: string; // For text content, image src, or board title
  parentId: string | null; // null for root board
}

export interface ArrowData {
  id:string;
  from: string; // CanvasItemData id
  to: string; // CanvasItemData id
  parentId: string | null; // null for root board
}

export interface ViewState {
  zoom: number;
  pan: Point;
}

export interface ConnectionState {
  from?: string; // Starting item id for connection
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
