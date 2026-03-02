// WindoorDesigner - 前端常量定义
// 画布渲染相关常量和颜色配置

/** 毫米到像素的基础转换比例 */
export const MM_TO_PX = 0.5;

/** 画布渲染颜色配置 - 工业蓝图美学 */
export const COLORS = {
  /** 外框型材填充 */
  frame: '#4a5568',
  /** 外框型材描边 */
  frameStroke: '#2d3748',
  /** 外框型材背景填充 */
  frameFill: '#a0aec0',
  /** 外框斜线填充 */
  frameHatch: 'rgba(0,0,0,0.06)',
  /** 中梃填充 */
  mullion: '#718096',
  /** 中梃描边 */
  mullionStroke: '#4a5568',
  /** 玻璃区域填充 */
  glass: 'rgba(173, 216, 230, 0.22)',
  /** 玻璃边框 */
  glassBorder: 'rgba(100, 160, 200, 0.35)',
  /** 玻璃对角线 */
  glassCross: 'rgba(100, 160, 200, 0.12)',
  /** 平开扇标记线（内开） */
  sashLine: '#e53e3e',
  /** 平开扇标记线（外开） */
  sashLineOutward: '#e53e3e',
  /** 推拉扇标记线 */
  sashLineSliding: '#3182ce',
  /** 内开内倒标记线 */
  sashLineTiltTurn: '#e53e3e',
  /** 固定扇标记 */
  sashFixed: 'rgba(100, 160, 200, 0.08)',
  /** 尺寸标注线 */
  dimension: '#f59e0b',
  /** 尺寸标注文字 */
  dimensionText: '#f59e0b',
  /** 选中高亮边框 */
  selected: '#f59e0b',
  /** 选中辉光效果 */
  selectedGlow: 'rgba(245, 158, 11, 0.25)',
  /** 网格线（细线） */
  grid: 'rgba(160, 170, 185, 0.12)',
  /** 网格线（粗线） */
  gridMajor: 'rgba(160, 170, 185, 0.25)',
  /** Opening 悬停高亮 */
  openingHover: 'rgba(245, 158, 11, 0.08)',
  /** 中梃预览线 */
  mullionPreview: '#38A169',
  /** 绘制外框预览 */
  drawPreview: '#3182ce',
  /** 吸附对齐线 */
  snapLine: '#FF3B30',
  /** 控制点填充 */
  controlPointFill: '#ffffff',
  /** 控制点边框 */
  controlPointStroke: '#f59e0b',
} as const;

/** 默认玻璃配置 */
export const DEFAULT_GLASS = {
  type: 'double_glazed' as const,
  spec: '5+12A+5',
  thickness: 22,
  fillGas: 'air' as const,
};

/** 默认颜色配置 */
export const DEFAULT_COLOR_CONFIG = {
  frameColor: '#4A4A4A',
  sashColor: '#4A4A4A',
  mullionColor: '#4A4A4A',
  handleColor: '#C0C0C0',
};

/** 画布缩放范围 */
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 5.0;

/** 自动保存间隔（毫秒） */
export const AUTO_SAVE_INTERVAL = 30_000;

/** localStorage 存储键 */
export const STORAGE_KEY = 'windoor-designer-data';
