// WindoorDesigner - 核心数据模型 v2.0
// 设计风格: 工业蓝图美学 (Industrial Blueprint)
// 基于《画图模块可执行规格书》重构

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

// ===== 扇开启类型 (v2.0 扩展) =====
export type SashType =
  | 'fixed'
  | 'casement-left'          // 内开左 (左侧铰链)
  | 'casement-right'         // 内开右 (右侧铰链)
  | 'casement-out-left'      // 外开左
  | 'casement-out-right'     // 外开右
  | 'casement-top'           // 上悬 (外开上悬)
  | 'casement-bottom'        // 下悬 (内开下悬)
  | 'tilt-turn-left'         // 内开内倒左
  | 'tilt-turn-right'        // 内开内倒右
  | 'sliding-left'           // 推拉左
  | 'sliding-right'          // 推拉右
  | 'folding-left'           // 折叠左
  | 'folding-right';         // 折叠右

export type MullionType = 'vertical' | 'horizontal';

// ===== 中梃/横档 =====
export interface Mullion {
  id: string;
  type: MullionType;
  position: number; // relative to parent opening (x for vertical, y for horizontal)
  profileWidth: number; // 中梃型材宽度 (从ProfileSeries继承)
  isArc: boolean;
  arcHeight?: number;
}

// ===== 玻璃 =====
export interface GlassPane {
  id: string;
  type: 'single' | 'double_glazed' | 'triple_glazed' | 'laminated';
  thickness: number; // 总厚度 mm (如 5+12A+5 = 22)
}

// ===== 五金件 =====
export interface Hardware {
  id: string;
  type: 'handle' | 'hinge' | 'lock_point' | 'friction_stay';
  model: string;
  position: Point;
}

// ===== 扇 (v2.0 重构) =====
export interface Sash {
  id: string;
  type: SashType;
  rect: Rect;
  profileWidth: number; // 扇型材宽度
  glassPane: GlassPane | null;
  hardware: Hardware[];
  hasFlyScreen: boolean; // 是否带纱窗
}

// ===== 旧版 Glass 接口 (兼容) =====
export interface Glass {
  id: string;
  type: 'single' | 'double' | 'triple' | 'laminated';
  thickness: number;
}

// ===== 分格/洞口 =====
export interface Opening {
  id: string;
  rect: Rect;
  mullions: Mullion[];
  sash: Sash | null;
  glass: Glass | null;
  glassPane: GlassPane | null; // v2.0: 固定玻璃 (无扇时直接填充)
  childOpenings: Opening[];
  isSplit: boolean;
}

// ===== 框架 =====
export interface Frame {
  id: string;
  shape: 'rectangle' | 'arc_top' | 'triangle' | 'polygon';
  points: Point[];
  profileWidth: number; // frame profile width in mm
  openings: Opening[];
}

// ===== 窗户单元 =====
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

// ===== 型材系列 (v2.0 扩展) =====
export interface ProfileSeries {
  id: string;
  name: string;
  frameWidth: number;
  sashWidth: number;
  mullionWidth: number;
  frameDepth: number;   // 框型材深度 (3D用)
  sashDepth: number;    // 扇型材深度 (3D用)
  mullionDepth: number; // 中梃型材深度 (3D用)
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

// Default profile series (v2.0: 新增 depth 字段)
export const DEFAULT_PROFILE_SERIES: ProfileSeries[] = [
  { id: 'series-60', name: '60系列', frameWidth: 60, sashWidth: 55, mullionWidth: 60, frameDepth: 60, sashDepth: 50, mullionDepth: 60, color: '#8B8B8B' },
  { id: 'series-65', name: '65系列', frameWidth: 65, sashWidth: 60, mullionWidth: 65, frameDepth: 65, sashDepth: 55, mullionDepth: 65, color: '#A0A0A0' },
  { id: 'series-70', name: '70系列', frameWidth: 70, sashWidth: 65, mullionWidth: 70, frameDepth: 70, sashDepth: 55, mullionDepth: 70, color: '#B0B0B0' },
  { id: 'series-80', name: '80系列', frameWidth: 80, sashWidth: 72, mullionWidth: 80, frameDepth: 80, sashDepth: 60, mullionDepth: 80, color: '#C0C0C0' },
  { id: 'series-85', name: '85系列', frameWidth: 85, sashWidth: 78, mullionWidth: 85, frameDepth: 85, sashDepth: 65, mullionDepth: 85, color: '#D0D0D0' },
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

// ===== 边界约束常量 =====
export const CONSTRAINTS = {
  MIN_OPENING_SIZE: 100,    // 最小分格尺寸 mm
  MIN_MULLION_SPACING: 100, // 中梃最小间距 mm
  MIN_MULLION_EDGE: 100,    // 中梃到边缘最小距离 mm
  MIN_WINDOW_WIDTH: 200,    // 窗户最小宽度 mm
  MIN_WINDOW_HEIGHT: 200,   // 窗户最小高度 mm
  MAX_WINDOW_WIDTH: 6000,   // 窗户最大宽度 mm
  MAX_WINDOW_HEIGHT: 4000,  // 窗户最大高度 mm
} as const;
