// WindoorDesigner - 画布状态 Zustand Store
// 管理画布视口、工具、交互状态

import { create } from 'zustand';
import type { ToolType } from '@windoor/shared';
import type { Rect } from '@windoor/shared';
import { ZOOM_MIN, ZOOM_MAX } from '@/lib/constants';

/** 中梃预览线信息 */
interface MullionPreview {
  type: 'vertical' | 'horizontal';
  position: number;
  windowId: string;
  openingRect: Rect;
}

/** 绘制外框预览信息 */
interface DrawPreview {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasStoreState {
  /** 当前激活的工具 */
  activeTool: ToolType;
  /** 画布缩放比例 */
  zoom: number;
  /** 画布平移 X */
  panX: number;
  /** 画布平移 Y */
  panY: number;
  /** 网格大小 (mm) */
  gridSize: number;
  /** 是否吸附到网格 */
  snapToGrid: boolean;
  /** 是否显示尺寸标注 */
  showDimensions: boolean;
  /** 中梃预览线 */
  mullionPreview: MullionPreview | null;
  /** 绘制外框预览 */
  drawPreview: DrawPreview | null;
  /** 鼠标世界坐标 */
  mouseWorldPos: { x: number; y: number };
  /** 悬停的 Opening ID */
  hoveredOpeningId: string | null;
}

interface CanvasStoreActions {
  /** 设置当前工具 */
  setActiveTool: (tool: ToolType) => void;
  /** 设置缩放 */
  setZoom: (zoom: number) => void;
  /** 以指定点为中心缩放 */
  zoomAtPoint: (delta: number, screenX: number, screenY: number) => void;
  /** 设置平移 */
  setPan: (x: number, y: number) => void;
  /** 切换网格吸附 */
  toggleSnapToGrid: () => void;
  /** 切换尺寸标注显示 */
  toggleDimensions: () => void;
  /** 设置中梃预览线 */
  setMullionPreview: (preview: MullionPreview | null) => void;
  /** 设置绘制外框预览 */
  setDrawPreview: (preview: DrawPreview | null) => void;
  /** 设置鼠标世界坐标 */
  setMouseWorldPos: (x: number, y: number) => void;
  /** 设置悬停 Opening */
  setHoveredOpeningId: (id: string | null) => void;
  /** 重置视图 */
  resetView: () => void;
}

type CanvasStore = CanvasStoreState & CanvasStoreActions;

const MM_TO_PX = 0.5;

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // ===== State =====
  activeTool: 'select',
  zoom: 1,
  panX: 0,
  panY: 0,
  gridSize: 10,
  snapToGrid: true,
  showDimensions: true,
  mullionPreview: null,
  drawPreview: null,
  mouseWorldPos: { x: 0, y: 0 },
  hoveredOpeningId: null,

  // ===== Actions =====
  setActiveTool: (tool) => {
    set({
      activeTool: tool,
      mullionPreview: null,
      drawPreview: null,
    });
  },

  setZoom: (zoom) => {
    set({ zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom)) });
  },

  zoomAtPoint: (delta, screenX, screenY) => {
    const state = get();
    const oldZoom = state.zoom;
    const newZoom = Math.max(
      ZOOM_MIN,
      Math.min(ZOOM_MAX, oldZoom * (1 + delta))
    );
    // 以鼠标位置为中心缩放
    const worldX = (screenX - state.panX) / (MM_TO_PX * oldZoom);
    const worldY = (screenY - state.panY) / (MM_TO_PX * oldZoom);
    const newPanX = screenX - worldX * MM_TO_PX * newZoom;
    const newPanY = screenY - worldY * MM_TO_PX * newZoom;
    set({ zoom: newZoom, panX: newPanX, panY: newPanY });
  },

  setPan: (x, y) => {
    set({ panX: x, panY: y });
  },

  toggleSnapToGrid: () => {
    set((state) => ({ snapToGrid: !state.snapToGrid }));
  },

  toggleDimensions: () => {
    set((state) => ({ showDimensions: !state.showDimensions }));
  },

  setMullionPreview: (preview) => {
    set({ mullionPreview: preview });
  },

  setDrawPreview: (preview) => {
    set({ drawPreview: preview });
  },

  setMouseWorldPos: (x, y) => {
    set({ mouseWorldPos: { x, y } });
  },

  setHoveredOpeningId: (id) => {
    set({ hoveredOpeningId: id });
  },

  resetView: () => {
    set({ zoom: 1, panX: 0, panY: 0 });
  },
}));
