// WindoorDesigner - 核心数据模型
// 设计风格: 工业蓝图美学 (Industrial Blueprint)

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SashType = 'fixed' | 'casement-left' | 'casement-right' | 'casement-top' | 'sliding-left' | 'sliding-right';

export type MullionType = 'vertical' | 'horizontal';

export interface Mullion {
  id: string;
  type: MullionType;
  position: number; // relative to parent opening
  isArc: boolean;
  arcHeight?: number;
}

export interface Sash {
  id: string;
  type: SashType;
  rect: Rect;
}

export interface Glass {
  id: string;
  type: 'single' | 'double' | 'triple' | 'laminated';
  thickness: number;
}

export interface Opening {
  id: string;
  rect: Rect;
  mullions: Mullion[];
  sash: Sash | null;
  glass: Glass | null;
  childOpenings: Opening[];
  isSplit: boolean;
}

export interface Frame {
  id: string;
  shape: 'rectangle' | 'arc_top' | 'custom';
  points: Point[];
  profileWidth: number; // frame profile width in mm
  openings: Opening[];
}

export interface WindowUnit {
  id: string;
  name: string;
  width: number; // mm
  height: number; // mm
  profileSeriesId: string;
  frame: Frame;
  posX: number; // position on canvas
  posY: number;
  selected: boolean;
}

export interface ProfileSeries {
  id: string;
  name: string;
  frameWidth: number;
  sashWidth: number;
  mullionWidth: number;
  color: string;
}

export type ToolType = 'select' | 'draw-frame' | 'add-mullion-v' | 'add-mullion-h' | 'add-sash' | 'pan' | 'zoom';

export interface EditorState {
  windows: WindowUnit[];
  selectedWindowId: string | null;
  selectedElementId: string | null;
  selectedElementType: 'frame' | 'mullion' | 'sash' | 'opening' | null;
  activeTool: ToolType;
  zoom: number;
  panX: number;
  panY: number;
  gridSize: number;
  snapToGrid: boolean;
  showDimensions: boolean;
  activeSashType: SashType;
  activeProfileSeries: ProfileSeries;
}

export interface HistoryEntry {
  windows: WindowUnit[];
  timestamp: number;
}

// Default profile series
export const DEFAULT_PROFILE_SERIES: ProfileSeries[] = [
  { id: 'series-60', name: '60系列', frameWidth: 60, sashWidth: 55, mullionWidth: 60, color: '#8B8B8B' },
  { id: 'series-65', name: '65系列', frameWidth: 65, sashWidth: 60, mullionWidth: 65, color: '#A0A0A0' },
  { id: 'series-70', name: '70系列', frameWidth: 70, sashWidth: 65, mullionWidth: 70, color: '#B0B0B0' },
  { id: 'series-80', name: '80系列', frameWidth: 80, sashWidth: 72, mullionWidth: 80, color: '#C0C0C0' },
  { id: 'series-85', name: '85系列', frameWidth: 85, sashWidth: 78, mullionWidth: 85, color: '#D0D0D0' },
];

// Preset window templates
export interface WindowTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  width: number;
  height: number;
  create: (id: string, x: number, y: number, series: ProfileSeries) => WindowUnit;
}
