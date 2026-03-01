// WindoorDesigner - 左侧工具栏
// 工业蓝图美学: 紧凑的图标式工具栏

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ToolType } from '@/lib/types';
import {
  MousePointer2,
  Square,
  SplitSquareVertical,
  SplitSquareHorizontal,
  PanelTop,
  Hand,
  ZoomIn,
  Undo2,
  Redo2,
  Ruler,
  Grid3x3,
  Trash2,
} from 'lucide-react';

interface ToolbarProps {
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
}

interface ToolItem {
  id: ToolType;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
}

const tools: ToolItem[] = [
  { id: 'select', icon: <MousePointer2 size={18} />, label: '选择', shortcut: 'V' },
  { id: 'draw-frame', icon: <Square size={18} />, label: '绘制外框', shortcut: 'R' },
  { id: 'add-mullion-v', icon: <SplitSquareVertical size={18} />, label: '添加中梃', shortcut: 'M' },
  { id: 'add-mullion-h', icon: <SplitSquareHorizontal size={18} />, label: '添加横档', shortcut: 'T' },
  { id: 'add-sash', icon: <PanelTop size={18} />, label: '添加扇', shortcut: 'S' },
  { id: 'pan', icon: <Hand size={18} />, label: '平移画布', shortcut: 'H' },
];

export default function Toolbar({
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
}: ToolbarProps) {
  return (
    <div className="w-12 bg-[oklch(0.14_0.025_260)] border-r border-[oklch(0.28_0.035_260)] flex flex-col items-center py-2 gap-0.5">
      {/* Tools */}
      {tools.map((tool) => (
        <Tooltip key={tool.id} delayDuration={200}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onToolChange(tool.id)}
              className={`w-9 h-9 flex items-center justify-center rounded transition-all duration-150 ${
                activeTool === tool.id
                  ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {tool.icon}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-[oklch(0.20_0.035_260)] text-slate-200 border-[oklch(0.30_0.04_260)]">
            <p className="text-xs">{tool.label} <span className="text-amber-400 ml-1">{tool.shortcut}</span></p>
          </TooltipContent>
        </Tooltip>
      ))}

      {/* Divider */}
      <div className="w-6 h-px bg-[oklch(0.30_0.04_260)] my-2" />

      {/* Undo/Redo */}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="w-9 h-9 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Undo2 size={16} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-[oklch(0.20_0.035_260)] text-slate-200 border-[oklch(0.30_0.04_260)]">
          <p className="text-xs">撤销 <span className="text-amber-400 ml-1">Ctrl+Z</span></p>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="w-9 h-9 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Redo2 size={16} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-[oklch(0.20_0.035_260)] text-slate-200 border-[oklch(0.30_0.04_260)]">
          <p className="text-xs">重做 <span className="text-amber-400 ml-1">Ctrl+Shift+Z</span></p>
        </TooltipContent>
      </Tooltip>

      {/* Divider */}
      <div className="w-6 h-px bg-[oklch(0.30_0.04_260)] my-2" />

      {/* Toggle buttons */}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            onClick={onToggleDimensions}
            className={`w-9 h-9 flex items-center justify-center rounded transition-all ${
              showDimensions ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <Ruler size={16} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-[oklch(0.20_0.035_260)] text-slate-200 border-[oklch(0.30_0.04_260)]">
          <p className="text-xs">尺寸标注 {showDimensions ? '(开)' : '(关)'}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            onClick={onToggleSnap}
            className={`w-9 h-9 flex items-center justify-center rounded transition-all ${
              snapToGrid ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <Grid3x3 size={16} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-[oklch(0.20_0.035_260)] text-slate-200 border-[oklch(0.30_0.04_260)]">
          <p className="text-xs">网格吸附 {snapToGrid ? '(开)' : '(关)'}</p>
        </TooltipContent>
      </Tooltip>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Delete */}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            onClick={onDeleteSelected}
            className="w-9 h-9 flex items-center justify-center rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <Trash2 size={16} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-[oklch(0.20_0.035_260)] text-slate-200 border-[oklch(0.30_0.04_260)]">
          <p className="text-xs">删除选中 <span className="text-amber-400 ml-1">Del</span></p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
