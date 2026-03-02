// WindoorDesigner - 移动端底部工具栏
// 触摸友好的大按钮，底部固定定位

import type { ToolType } from '@/lib/types';
import {
  MousePointer2,
  Square,
  SplitSquareVertical,
  SplitSquareHorizontal,
  PanelTop,
  Hand,
  Undo2,
  Redo2,
  Ruler,
  Grid3x3,
  Trash2,
  ZoomIn,
  ZoomOut,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface MobileToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  showDimensions: boolean;
  onToggleDimensions: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  onDeleteSelected: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  zoom: number;
  hasSelection: boolean;
}

interface ToolItem {
  id: ToolType;
  icon: React.ReactNode;
  label: string;
}

const primaryTools: ToolItem[] = [
  { id: 'select', icon: <MousePointer2 size={20} />, label: '选择' },
  { id: 'draw-frame', icon: <Square size={20} />, label: '画框' },
  { id: 'add-mullion-v', icon: <SplitSquareVertical size={20} />, label: '中梃' },
  { id: 'add-mullion-h', icon: <SplitSquareHorizontal size={20} />, label: '横档' },
  { id: 'add-sash', icon: <PanelTop size={20} />, label: '加扇' },
  { id: 'pan', icon: <Hand size={20} />, label: '平移' },
];

export default function MobileToolbar({
  activeTool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  showDimensions,
  onToggleDimensions,
  snapToGrid,
  onToggleSnap,
  onDeleteSelected,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  zoom,
  hasSelection,
}: MobileToolbarProps) {
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      {/* More actions overlay */}
      {showMore && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowMore(false)}>
          <div
            className="absolute bottom-16 left-0 right-0 bg-[oklch(0.17_0.028_260)] border-t border-[oklch(0.30_0.04_260)] rounded-t-2xl p-4 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-semibold text-slate-200">更多操作</span>
              <button
                onClick={() => setShowMore(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            {/* Action grid */}
            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={() => { onUndo(); }}
                disabled={!canUndo}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[oklch(0.20_0.035_260)] disabled:opacity-30"
              >
                <Undo2 size={22} className="text-slate-300" />
                <span className="text-[10px] text-slate-400">撤销</span>
              </button>

              <button
                onClick={() => { onRedo(); }}
                disabled={!canRedo}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[oklch(0.20_0.035_260)] disabled:opacity-30"
              >
                <Redo2 size={22} className="text-slate-300" />
                <span className="text-[10px] text-slate-400">重做</span>
              </button>

              <button
                onClick={onToggleDimensions}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl ${
                  showDimensions ? 'bg-amber-500/20 ring-1 ring-amber-500/40' : 'bg-[oklch(0.20_0.035_260)]'
                }`}
              >
                <Ruler size={22} className={showDimensions ? 'text-amber-400' : 'text-slate-300'} />
                <span className="text-[10px] text-slate-400">标注</span>
              </button>

              <button
                onClick={onToggleSnap}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl ${
                  snapToGrid ? 'bg-amber-500/20 ring-1 ring-amber-500/40' : 'bg-[oklch(0.20_0.035_260)]'
                }`}
              >
                <Grid3x3 size={22} className={snapToGrid ? 'text-amber-400' : 'text-slate-300'} />
                <span className="text-[10px] text-slate-400">吸附</span>
              </button>

              <button
                onClick={onZoomIn}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[oklch(0.20_0.035_260)]"
              >
                <ZoomIn size={22} className="text-slate-300" />
                <span className="text-[10px] text-slate-400">放大</span>
              </button>

              <button
                onClick={onZoomOut}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[oklch(0.20_0.035_260)]"
              >
                <ZoomOut size={22} className="text-slate-300" />
                <span className="text-[10px] text-slate-400">缩小</span>
              </button>

              <button
                onClick={onZoomReset}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[oklch(0.20_0.035_260)]"
              >
                <span className="text-sm font-mono font-bold text-slate-300">{Math.round(zoom * 100)}%</span>
                <span className="text-[10px] text-slate-400">重置</span>
              </button>

              <button
                onClick={() => { onDeleteSelected(); setShowMore(false); }}
                disabled={!hasSelection}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[oklch(0.20_0.035_260)] disabled:opacity-30"
              >
                <Trash2 size={22} className="text-red-400" />
                <span className="text-[10px] text-red-400">删除</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main bottom toolbar */}
      <div className="h-16 bg-[oklch(0.14_0.025_260)] border-t border-[oklch(0.25_0.035_260)] flex items-center justify-around px-1 safe-area-pb">
        {primaryTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] h-12 rounded-lg transition-all ${
              activeTool === tool.id
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-slate-400 active:bg-white/10'
            }`}
          >
            {tool.icon}
            <span className="text-[9px] leading-none">{tool.label}</span>
          </button>
        ))}

        {/* More button */}
        <button
          onClick={() => setShowMore(!showMore)}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] h-12 rounded-lg transition-all ${
            showMore ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 active:bg-white/10'
          }`}
        >
          <MoreHorizontal size={20} />
          <span className="text-[9px] leading-none">更多</span>
        </button>
      </div>
    </>
  );
}
