// CompositeWindowPanel - 组合窗属性编辑面板
// 显示选中组合窗的属性，支持编辑面板尺寸、切换视图模式

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDesignStore } from '@/stores/designStore';
import { COMPOSITE_TEMPLATES } from '@/lib/composite-factory';
import type { CompositeWindow, CompositePanel } from '@/lib/types';
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
        className="w-14 bg-[oklch(0.10_0.02_260)] border border-cyan-500/60 rounded px-1 py-0.5 text-[10px] text-cyan-300 font-mono text-center focus:outline-none focus:ring-1 focus:ring-cyan-500/60"
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="text-[10px] text-slate-300 font-mono cursor-pointer hover:text-cyan-300 hover:bg-cyan-500/10 rounded px-1 py-0.5 transition-colors"
      title="点击编辑"
    >
      {Math.round(value)}<span className="text-[8px] text-slate-600 ml-0.5">{suffix}</span>
    </span>
  );
}

// ===== 组合窗模板选择区（紧凑 2 列布局） =====
interface CompositeTemplateSectionProps {
  onAddComposite: (templateId: string) => void;
}

export function CompositeTemplateSection({ onAddComposite }: CompositeTemplateSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border-y border-cyan-500/20 bg-cyan-500/[0.03]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-cyan-300 uppercase tracking-wider hover:bg-cyan-500/10 transition-colors"
      >
        <Box size={14} className="text-cyan-400" />
        <span className="flex-1 text-left">组合窗型</span>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {isOpen && (
        <div className="px-2 pb-2">
          <div className="grid grid-cols-3 gap-1.5">
            {COMPOSITE_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => onAddComposite(tmpl.id)}
                className="flex flex-col items-center gap-0.5 p-2 rounded bg-[oklch(0.18_0.03_200)] hover:bg-[oklch(0.22_0.04_200)] border border-cyan-500/20 hover:border-cyan-500/40 transition-all group"
              >
                <span className="text-lg leading-none group-hover:scale-110 transition-transform">{tmpl.icon}</span>
                <span className="text-[9px] text-cyan-300/70 group-hover:text-cyan-200 text-center leading-tight">{tmpl.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 组合窗属性编辑面板 =====
interface CompositePropertiesPanelProps {
  compositeWindow: CompositeWindow;
  onDelete: () => void;
}

export function CompositePropertiesPanel({ compositeWindow, onDelete }: CompositePropertiesPanelProps) {
  const toggleCompositeViewMode = useDesignStore((s) => s.toggleCompositeViewMode);
  const updateCompositePanel = useDesignStore((s) => s.updateCompositePanel);
  const [panelsOpen, setPanelsOpen] = useState(true);

  const typeLabels: Record<string, string> = {
    'u-shape': 'U形窗',
    'l-shape': 'L形窗',
    'bay-window': '凸窗/飘窗',
    'custom-composite': '自定义组合',
  };

  // 计算总面积
  const totalArea = compositeWindow.panels.reduce((sum, panel) => {
    return sum + (panel.windowUnit.width * panel.windowUnit.height) / 1_000_000;
  }, 0);

  return (
    <div className="flex flex-col">
      {/* 标题 */}
      <div className="px-3 py-1.5 bg-cyan-500/10 border-b border-cyan-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box size={12} className="text-cyan-400" />
            <span className="text-[11px] font-semibold text-cyan-300">
              {typeLabels[compositeWindow.type] || '组合窗'}
            </span>
          </div>
          <span className="text-[9px] text-slate-500 font-mono">{totalArea.toFixed(2)}m²</span>
        </div>
      </div>

      {/* 视图模式 + 基本信息 */}
      <div className="px-3 py-1.5">
        <div className="grid grid-cols-2 gap-1 mb-1.5">
          <button
            onClick={() => {
              if (compositeWindow.viewMode !== 'unfold') {
                toggleCompositeViewMode(compositeWindow.id);
              }
            }}
            className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded text-[9px] transition-all ${
              compositeWindow.viewMode === 'unfold'
                ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40'
                : 'bg-[oklch(0.20_0.035_260)] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Maximize2 size={10} />
            展开
          </button>
          <button
            onClick={() => {
              if (compositeWindow.viewMode !== 'perspective') {
                toggleCompositeViewMode(compositeWindow.id);
              }
            }}
            className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded text-[9px] transition-all ${
              compositeWindow.viewMode === 'perspective'
                ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40'
                : 'bg-[oklch(0.20_0.035_260)] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye size={10} />
            透视
          </button>
        </div>
      </div>

      <div className="h-px bg-[oklch(0.28_0.035_260)]" />

      {/* 面板详情（可折叠） */}
      <button
        onClick={() => setPanelsOpen(!panelsOpen)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold text-slate-300 uppercase tracking-wider hover:bg-white/5 transition-colors"
      >
        <Layers size={12} className="text-cyan-400" />
        <span className="flex-1 text-left">面板 ({compositeWindow.panels.length})</span>
        {panelsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {panelsOpen && (
        <div className="px-2 pb-2 space-y-1">
          {compositeWindow.panels.map((panel, index) => (
            <PanelCard
              key={panel.id}
              panel={panel}
              index={index}
              compositeWindowId={compositeWindow.id}
              onUpdateSize={(panelId, w, h) => updateCompositePanel(compositeWindow.id, panelId, w, h)}
            />
          ))}
        </div>
      )}

      <div className="h-px bg-[oklch(0.28_0.035_260)]" />

      {/* 删除按钮 */}
      <div className="px-3 py-1.5">
        <button
          onClick={() => {
            if (confirm('确定要删除此组合窗吗？')) {
              onDelete();
            }
          }}
          className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-[10px] transition-all border border-red-500/20 hover:border-red-500/40"
        >
          <Trash2 size={10} />
          删除组合窗
        </button>
      </div>
    </div>
  );
}

// ===== 面板卡片（支持编辑尺寸） =====
function PanelCard({
  panel,
  index,
  compositeWindowId,
  onUpdateSize,
}: {
  panel: CompositePanel;
  index: number;
  compositeWindowId: string;
  onUpdateSize: (panelId: string, width: number, height: number) => void;
}) {
  const win = panel.windowUnit;

  const connectionLabels: Record<string, string> = {
    'corner-post': '转角柱',
    'miter': '斜接',
    'structural': '结构连接',
  };

  return (
    <div className="p-1.5 rounded bg-[oklch(0.14_0.025_260)] border border-[oklch(0.25_0.035_260)]">
      {/* 面板标题行 */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[8px] text-cyan-400/70 font-mono bg-cyan-500/10 px-1 py-0.5 rounded">
          P{index + 1}
        </span>
        <span className="text-[10px] text-slate-200 font-medium flex-1 truncate">{panel.label}</span>
        {panel.angle !== 0 && (
          <span className="text-[8px] text-slate-500">
            <RotateCcw size={8} className="inline mr-0.5" />
            {panel.angle}°
          </span>
        )}
      </div>

      {/* 尺寸编辑行 */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          <span className="text-[8px] text-slate-600">宽</span>
          <InlineEdit
            value={win.width}
            min={200}
            max={5000}
            suffix="mm"
            onConfirm={(w) => onUpdateSize(panel.id, w, win.height)}
          />
        </div>
        <span className="text-[8px] text-slate-600">×</span>
        <div className="flex items-center gap-0.5">
          <span className="text-[8px] text-slate-600">高</span>
          <InlineEdit
            value={win.height}
            min={200}
            max={5000}
            suffix="mm"
            onConfirm={(h) => onUpdateSize(panel.id, win.width, h)}
          />
        </div>
      </div>

      {/* 连接方式 + 面积 */}
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[8px] text-slate-500">
          {connectionLabels[panel.connectionType] || panel.connectionType}
        </span>
        <span className="text-[8px] text-slate-500 font-mono">
          {((win.width * win.height) / 1_000_000).toFixed(2)}m²
        </span>
      </div>
    </div>
  );
}
