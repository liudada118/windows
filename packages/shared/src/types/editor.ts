// WindoorDesigner - 编辑器状态类型
import type { WindowUnit, SashType, ProfileSeries } from './design';

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
