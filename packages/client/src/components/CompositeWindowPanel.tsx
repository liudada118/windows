// CompositeWindowPanel - 组合窗属性编辑面板
// 显示选中组合窗的属性，支持编辑面板尺寸、切换视图模式

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDesignStore } from '@/stores/designStore';
import { COMPOSITE_TEMPLATES } from '@/lib/composite-factory';
import type { CompositeWindow, CompositePanel, ProfileSeries } from '@/lib/types';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  Layers,
  Trash2,
  RotateCcw,
  Maximize2,
  Box,
} from 'lucide-react';

// ===== 可编辑数值组件 =====
function InlineEdit({
  value,
  min,
  max,
  suffix = 'mm',
  onConfirm,
}: {
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onConfirm: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setInputVal(String(Math.round(value)));
      setTimeout(() => {
        ref.current?.focus();
        ref.current?.select();
      }, 30);
    }
  }, [editing, value]);

  const commit = useCallback(() => {
    const num = parseInt(inputVal, 10);
    if (!isNaN(num) && num >= min && num <= max) {
      onConfirm(num);
    }
    setEditing(false);
  }, [inputVal, min, max, onConfirm]);

  if (editing) {
    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') setEditing(false);
        }}
        onBlur={commit}
        className="w-16 bg-[oklch(0.10_0.02_260)] border border-amber-500/60 rounded px-1.5 py-0.5 text-[11px] text-amber-300 font-mono text-center focus:outline-none focus:ring-1 focus:ring-amber-500/60"
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="text-[11px] text-slate-300 font-mono cursor-pointer hover:text-amber-300 hover:bg-amber-500/10 rounded px-1 py-0.5 transition-colors"
      title="点击编辑"
    >
      {Math.round(value)}{suffix && <span className="text-[9px] text-slate-600 ml-0.5">{suffix}</span>}
    </span>
  );
}

// ===== 组合窗模板选择区 =====
interface CompositeTemplateSectionProps {
  onAddComposite: (templateId: string) => void;
}

export function CompositeTemplateSection({ onAddComposite }: CompositeTemplateSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wider hover:bg-white/5 transition-colors"
      >
        <Box size={14} className="text-cyan-400" />
        <span className="flex-1 text-left">组合窗型</span>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {isOpen && (
        <div className="px-2 pb-3">
          <div className="grid grid-cols-1 gap-1.5">
            {COMPOSITE_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => onAddComposite(tmpl.id)}
                className="flex items-center gap-3 p-2.5 rounded bg-[oklch(0.20_0.035_260)] hover:bg-[oklch(0.25_0.04_260)] border border-transparent hover:border-cyan-500/30 transition-all group text-left"
              >
                <span className="text-2xl leading-none group-hover:scale-110 transition-transform w-8 text-center">{tmpl.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] text-slate-200 group-hover:text-white block font-medium">{tmpl.name}</span>
                  <span className="text-[9px] text-slate-500 group-hover:text-slate-400 block mt-0.5 truncate">{tmpl.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="h-px bg-[oklch(0.28_0.035_260)]" />
    </>
  );
}

// ===== 组合窗属性编辑面板 =====
interface CompositePropertiesPanelProps {
  compositeWindow: CompositeWindow;
  onDelete: () => void;
}

export function CompositePropertiesPanel({ compositeWindow, onDelete }: CompositePropertiesPanelProps) {
  const toggleCompositeViewMode = useDesignStore((s) => s.toggleCompositeViewMode);
  const [panelsOpen, setPanelsOpen] = useState(true);

  const typeLabels: Record<string, string> = {
    'u-shape': 'U形窗',
    'l-shape': 'L形窗',
    'bay-window': '凸窗/飘窗',
    'custom-composite': '自定义组合',
  };

  const viewModeLabels: Record<string, string> = {
    'unfold': '展开视图',
    'perspective': '透视视图',
  };

  // 计算总面积
  const totalArea = compositeWindow.panels.reduce((sum, panel) => {
    return sum + (panel.windowUnit.width * panel.windowUnit.height) / 1_000_000;
  }, 0);

  return (
    <div className="flex flex-col">
      {/* 标题 */}
      <div className="px-3 py-2 bg-cyan-500/10 border-b border-cyan-500/20">
        <div className="flex items-center gap-2">
          <Box size={14} className="text-cyan-400" />
          <span className="text-xs font-semibold text-cyan-300">组合窗属性</span>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="px-3 py-2 space-y-2">
        {/* 名称 */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">名称</label>
          <span className="text-xs text-slate-200">{compositeWindow.name}</span>
        </div>

        {/* 类型 */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">类型</label>
          <span className="text-xs text-slate-200">{typeLabels[compositeWindow.type] || compositeWindow.type}</span>
        </div>

        {/* 面板数量 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">面板数</label>
            <span className="text-xs text-slate-300 font-mono">{compositeWindow.panels.length}</span>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">总面积</label>
            <span className="text-xs text-slate-300 font-mono">{totalArea.toFixed(2)} m²</span>
          </div>
        </div>

        {/* 位置 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">X 位置</label>
            <span className="text-xs text-slate-400 font-mono">{Math.round(compositeWindow.posX)}</span>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">Y 位置</label>
            <span className="text-xs text-slate-400 font-mono">{Math.round(compositeWindow.posY)}</span>
          </div>
        </div>
      </div>

      <div className="h-px bg-[oklch(0.28_0.035_260)]" />

      {/* 视图模式切换 */}
      <div className="px-3 py-2">
        <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">视图模式</label>
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => {
              if (compositeWindow.viewMode !== 'unfold') {
                toggleCompositeViewMode(compositeWindow.id);
              }
            }}
            className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] transition-all ${
              compositeWindow.viewMode === 'unfold'
                ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40'
                : 'bg-[oklch(0.20_0.035_260)] text-slate-400 hover:text-slate-200 hover:bg-[oklch(0.25_0.04_260)]'
            }`}
          >
            <Maximize2 size={12} />
            展开
          </button>
          <button
            onClick={() => {
              if (compositeWindow.viewMode !== 'perspective') {
                toggleCompositeViewMode(compositeWindow.id);
              }
            }}
            className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] transition-all ${
              compositeWindow.viewMode === 'perspective'
                ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40'
                : 'bg-[oklch(0.20_0.035_260)] text-slate-400 hover:text-slate-200 hover:bg-[oklch(0.25_0.04_260)]'
            }`}
          >
            <Eye size={12} />
            透视
          </button>
        </div>
      </div>

      <div className="h-px bg-[oklch(0.28_0.035_260)]" />

      {/* 面板详情 */}
      <button
        onClick={() => setPanelsOpen(!panelsOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wider hover:bg-white/5 transition-colors"
      >
        <Layers size={14} className="text-cyan-400" />
        <span className="flex-1 text-left">面板详情</span>
        {panelsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {panelsOpen && (
        <div className="px-3 pb-3 space-y-1.5">
          {compositeWindow.panels.map((panel, index) => (
            <PanelCard key={panel.id} panel={panel} index={index} />
          ))}
        </div>
      )}

      <div className="h-px bg-[oklch(0.28_0.035_260)]" />

      {/* 操作按钮 */}
      <div className="px-3 py-2">
        <button
          onClick={() => {
            if (confirm('确定要删除此组合窗吗？')) {
              onDelete();
            }
          }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs transition-all border border-red-500/20 hover:border-red-500/40"
        >
          <Trash2 size={12} />
          删除组合窗
        </button>
      </div>
    </div>
  );
}

// ===== 面板卡片 =====
function PanelCard({ panel, index }: { panel: CompositePanel; index: number }) {
  const win = panel.windowUnit;

  const connectionLabels: Record<string, string> = {
    'corner-post': '转角柱',
    'miter': '斜接',
    'structural': '结构连接',
  };

  return (
    <div className="p-2 rounded bg-[oklch(0.14_0.025_260)] border border-[oklch(0.25_0.035_260)]">
      {/* 面板标题 */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] text-cyan-400/70 font-mono bg-cyan-500/10 px-1.5 py-0.5 rounded">
          P{index + 1}
        </span>
        <span className="text-[11px] text-slate-200 font-medium">{panel.label}</span>
        {panel.angle !== 0 && (
          <span className="text-[9px] text-slate-500 ml-auto">
            <RotateCcw size={9} className="inline mr-0.5" />
            {panel.angle}°
          </span>
        )}
      </div>

      {/* 面板尺寸 */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-slate-600 w-5">宽:</span>
          <span className="text-[10px] text-slate-300 font-mono">{win.width}mm</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-slate-600 w-5">高:</span>
          <span className="text-[10px] text-slate-300 font-mono">{win.height}mm</span>
        </div>
      </div>

      {/* 连接方式 */}
      <div className="mt-1 flex items-center gap-1">
        <span className="text-[9px] text-slate-600">连接:</span>
        <span className="text-[9px] text-slate-400">{connectionLabels[panel.connectionType] || panel.connectionType}</span>
      </div>

      {/* 面板面积 */}
      <div className="mt-1 flex items-center gap-1">
        <span className="text-[9px] text-slate-600">面积:</span>
        <span className="text-[9px] text-slate-400 font-mono">{((win.width * win.height) / 1_000_000).toFixed(3)} m²</span>
      </div>
    </div>
  );
}
