export type Point = {
  x: number;
  y: number;
};

export type CanvasItemType = 'text' | 'image' | 'board' | 'arrow' | 'todo' | 'link';

export type TodoListItem = {
  id: string;
  text: string;
  completed: boolean;
};

export type TextAlign = 'left' | 'center' | 'right';
export type FontWeight = 'normal' | 'bold';
export type FontStyle = 'normal' | 'italic';
export type TextDecoration = 'none' | 'underline';

export interface CanvasItemData {
  id: string;
  type: Extract<CanvasItemType, 'text' | 'image' | 'board' | 'todo' | 'link'>;
  position: Point;
  width: number;
  height: number;
  content: string; // For text content, image src, board/todo title, or link URL
  parentId: string | null; // null for root board
  todos?: TodoListItem[]; // only for 'todo' type
  // Text properties
  textAlign?: TextAlign;
  fontSize?: number;
  fontWeight?: FontWeight;
  fontStyle?: FontStyle;
  textDecoration?: TextDecoration;
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
    vignetteIntensity?: number;
    defaultOpacity?: number;
    defaultBackgroundBlur?: number;
}

export interface Board {
    id: string;
    name: string;
}
