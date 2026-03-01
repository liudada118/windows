// WindoorDesigner - 底部状态栏
// 工业蓝图美学: 显示坐标、缩放比例、当前工具等实时信息

import type { ToolType } from '@/lib/types';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface StatusBarProps {
  mouseX: number;
  mouseY: number;
  zoom: number;
  activeTool: ToolType;
  windowCount: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

const TOOL_NAMES: Record<ToolType, string> = {
  'select': '选择工具',
  'draw-frame': '绘制外框',
  'add-mullion-v': '添加中梃',
  'add-mullion-h': '添加横档',
  'add-sash': '添加扇',
  'pan': '平移画布',
  'zoom': '缩放',
};

export default function StatusBar({
  mouseX,
  mouseY,
  zoom,
  activeTool,
  windowCount,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: StatusBarProps) {
  return (
    <div className="h-7 bg-[oklch(0.14_0.025_260)] border-t border-[oklch(0.25_0.035_260)] flex items-center px-3 gap-4 text-[10px] font-mono select-none">
      {/* Current tool */}
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500">工具:</span>
        <span className="text-amber-400">{TOOL_NAMES[activeTool]}</span>
      </div>

      {/* Divider */}
      <div className="w-px h-3.5 bg-[oklch(0.28_0.035_260)]" />

      {/* Mouse coordinates */}
      <div className="flex items-center gap-3">
        <span className="text-slate-500">X: <span className="text-slate-300">{Math.round(mouseX)}</span></span>
        <span className="text-slate-500">Y: <span className="text-slate-300">{Math.round(mouseY)}</span></span>
      </div>

      {/* Divider */}
      <div className="w-px h-3.5 bg-[oklch(0.28_0.035_260)]" />

      {/* Window count */}
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500">窗口:</span>
        <span className="text-slate-300">{windowCount}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onZoomOut}
          className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ZoomOut size={12} />
        </button>
        <button
          onClick={onZoomReset}
          className="px-1.5 py-0.5 text-slate-400 hover:text-amber-400 transition-colors rounded hover:bg-white/5"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={onZoomIn}
          className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ZoomIn size={12} />
        </button>
      </div>
    </div>
  );
}
