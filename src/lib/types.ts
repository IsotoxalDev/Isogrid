
export type Point = {
  x: number;
  y: number;
};

export type CanvasItemType = 'text' | 'image' | 'board' | 'arrow' | 'todo' | 'link' | 'title' | 'note';

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
  type: Extract<CanvasItemType, 'text' | 'image' | 'board' | 'todo' | 'link' | 'title' | 'note'>;
  position: Point;
  width: number;
  height: number | 'auto';
  content: string; // For text content, image src, board/todo title, or link URL
  parentId: string | null; // null for root board
  todos?: TodoListItem[]; // only for 'todo' type
  // Text properties
  textAlign?: TextAlign;
  textAligns?: TextAlign[];
  fontSize?: number;
  fontWeight?: FontWeight;
  fontStyle?: FontStyle;
  textDecoration?: TextDecoration;
  // Title properties
  titleShadow?: boolean;
  titleOutline?: boolean;
  // Common properties
  color?: string;
  backgroundColor?: string;
  outlineColor?: string;
  // Note properties
  noteTitle?: string;
}

export interface ArrowData {
  id: string;
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
  gridColor?: string; // CSS hex color, overrides the theme's default muted-foreground grid color
  gridThickness?: number; // px, dot radius or line width
  snapToGrid?: boolean;
  vignetteIntensity?: number;
  defaultOpacity?: number;
  defaultBackgroundBlur?: number;
  canvasBackgroundColor?: string; // CSS color, overrides the theme's default canvas background
}

export interface Board {
  id: string;
  name: string;
  parentId?: string | null;
}

export type BoardRole = 'viewer' | 'editor';

export interface BoardDoc {
  id: string;
  name: string;
  parentId: string | null; // null for a user's personal root board
  ownerId: string;
  collaborators: Record<string, BoardRole>;
  settings: BoardSettings;
  createdAt?: unknown; // Firestore Timestamp
  updatedAt?: unknown; // Firestore Timestamp
}

export interface UserDirectoryEntry {
  email: string;
  displayName: string;
}
