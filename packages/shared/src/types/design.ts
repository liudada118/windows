// WindoorDesigner - 核心设计数据模型
// 前后端共享类型定义

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

// ===== 扇开启类型 =====
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
  profileWidth: number;
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

// ===== 扇 =====
export interface Sash {
  id: string;
  type: SashType;
  rect: Rect;
  profileWidth: number;
  glassPane: GlassPane | null;
  hardware: Hardware[];
  hasFlyScreen: boolean;
}

// ===== 旧版 Glass 接口 (兼容) =====
export interface Glass {
  id: string;
  type: 'single' | 'double' | 'triple' | 'laminated';
  thickness: number;
}

// ===== 分格/洞口 (递归树结构) =====
export interface Opening {
  id: string;
  rect: Rect;
  mullions: Mullion[];
  sash: Sash | null;
  glass: Glass | null;
  glassPane: GlassPane | null;
  childOpenings: Opening[];
  isSplit: boolean;
}

// ===== 框架 =====
export interface Frame {
  id: string;
  shape: 'rectangle' | 'arc_top' | 'triangle' | 'polygon';
  points: Point[];
  profileWidth: number;
  openings: Opening[];
}

// ===== 窗户单元 =====
export interface WindowUnit {
  id: string;
  name: string;
  width: number;  // mm
  height: number; // mm
  profileSeriesId: string;
  frame: Frame;
  posX: number;
  posY: number;
  selected: boolean;
}

// ===== 型材系列 =====
export interface ProfileSeries {
  id: string;
  name: string;
  frameWidth: number;
  sashWidth: number;
  mullionWidth: number;
  frameDepth: number;
  sashDepth: number;
  mullionDepth: number;
  color: string;
}

// ===== 窗型模板 =====
export interface WindowTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  width: number;
  height: number;
  create: (id: string, x: number, y: number, series: ProfileSeries) => WindowUnit;
}

// ===== 颜色配置 =====
export interface ColorConfig {
  frameColor: string;     // 框色
  sashColor: string;      // 扇色
  mullionColor: string;   // 中梃色
  glassColor: string;     // 玻璃色
  glassTint: number;      // 玻璃透明度 0-1
}

// ===== 材料配置 =====
export interface MaterialConfig {
  name: string;           // 材料名称 (如 '断桥铝', '塑钢', '铝木复合')
  colorPreset: string;    // 预设颜色方案名称
  colors: ColorConfig;
}

// ===== 设计数据 (完整存储单元) =====
export interface DesignData {
  id: string;
  name: string;
  windows: WindowUnit[];
  materialConfig?: MaterialConfig;
  createdAt: string;
  updatedAt: string;
}
