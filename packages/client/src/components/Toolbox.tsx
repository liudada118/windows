// WindoorDesigner - 左侧工具面板
// 提供绘制工具、中梃工具、扇类型选择、预设模板

import { useCanvasStore } from '@/stores/canvasStore';
import { useDesignStore } from '@/stores/designStore';
import { useHistoryStore } from '@/stores/historyStore';
import type { ToolType, SashType } from '@windoor/shared';
import { WINDOW_TEMPLATES } from '@/lib/window-factory';
import { DEFAULT_PROFILE_SERIES } from '@windoor/shared';
import { toast } from 'sonner';
import {
  MousePointer2,
  Square,
  SplitSquareVertical,
  SplitSquareHorizontal,
  DoorOpen,
  Hand,
  LayoutGrid,
} from 'lucide-react';

/** 工具按钮 */
function ToolButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-colors w-full
        ${active
          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200 border border-transparent'
        }`}
      onClick={onClick}
      title={label}
    >
      {icon}
      <span className="truncate w-full text-center">{label}</span>
    </button>
  );
}

/** 扇类型选项 */
const SASH_OPTIONS: { type: SashType; label: string; icon: string }[] = [
  { type: 'fixed', label: '固定', icon: '⬜' },
  { type: 'casement-left', label: '左内开', icon: '◧' },
  { type: 'casement-right', label: '右内开', icon: '◨' },
  { type: 'casement-out-left', label: '左外开', icon: '◧' },
  { type: 'casement-out-right', label: '右外开', icon: '◨' },
  { type: 'casement-top', label: '上悬', icon: '⬒' },
  { type: 'casement-bottom', label: '下悬', icon: '⬓' },
  { type: 'tilt-turn-left', label: '左内倒', icon: '⊿' },
  { type: 'tilt-turn-right', label: '右内倒', icon: '⊿' },
  { type: 'sliding-left', label: '左推拉', icon: '⇐' },
  { type: 'sliding-right', label: '右推拉', icon: '⇒' },
  { type: 'folding-left', label: '左折叠', icon: '⋘' },
  { type: 'folding-right', label: '右折叠', icon: '⋙' },
];

export default function Toolbox() {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const activeSashType = useDesignStore((s) => s.activeSashType);
  const setActiveSashType = useDesignStore((s) => s.setActiveSashType);
  const activeProfileSeries = useDesignStore((s) => s.activeProfileSeries);
  const setActiveProfileSeries = useDesignStore((s) => s.setActiveProfileSeries);
  const addWindowUnit = useDesignStore((s) => s.addWindowUnit);
  const getSnapshot = useDesignStore((s) => s.getSnapshot);
  const pushHistory = useHistoryStore((s) => s.pushHistory);

  const handleAddTemplate = (templateId: string) => {
    const template = WINDOW_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    pushHistory(getSnapshot());
    const win = template.create(templateId, 100, 100, activeProfileSeries);
    addWindowUnit(win);
    setActiveTool('select');
    toast.success(`已添加 ${template.name}`);
  };

  return (
    <div className="w-56 bg-gray-900 border-r border-gray-700 flex flex-col overflow-y-auto">
      {/* 基础工具 */}
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">基础工具</h3>
        <div className="grid grid-cols-3 gap-1">
          <ToolButton
            icon={<MousePointer2 size={18} />}
            label="选择"
            active={activeTool === 'select'}
            onClick={() => setActiveTool('select')}
          />
          <ToolButton
            icon={<Square size={18} />}
            label="绘制外框"
            active={activeTool === 'draw-frame'}
            onClick={() => setActiveTool('draw-frame')}
          />
          <ToolButton
            icon={<Hand size={18} />}
            label="平移"
            active={activeTool === 'pan'}
            onClick={() => setActiveTool('pan')}
          />
        </div>
      </div>

      {/* 中梃工具 */}
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">中梃工具</h3>
        <div className="grid grid-cols-2 gap-1">
          <ToolButton
            icon={<SplitSquareVertical size={18} />}
            label="竖中梃"
            active={activeTool === 'add-mullion-v'}
            onClick={() => setActiveTool('add-mullion-v')}
          />
          <ToolButton
            icon={<SplitSquareHorizontal size={18} />}
            label="横中梃"
            active={activeTool === 'add-mullion-h'}
            onClick={() => setActiveTool('add-mullion-h')}
          />
        </div>
      </div>

      {/* 扇工具 */}
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">添加扇</h3>
        <div className="mb-2">
          <select
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200"
            value={activeSashType}
            onChange={(e) => setActiveSashType(e.target.value as SashType)}
          >
            {SASH_OPTIONS.map((opt) => (
              <option key={opt.type} value={opt.type}>
                {opt.icon} {opt.label}
              </option>
            ))}
          </select>
        </div>
        <ToolButton
          icon={<DoorOpen size={18} />}
          label="点击分格添加扇"
          active={activeTool === 'add-sash'}
          onClick={() => setActiveTool('add-sash')}
        />
      </div>

      {/* 型材系列 */}
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">型材系列</h3>
        <select
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200"
          value={activeProfileSeries.id}
          onChange={(e) => {
            const series = DEFAULT_PROFILE_SERIES.find((s) => s.id === e.target.value);
            if (series) setActiveProfileSeries(series);
          }}
        >
          {DEFAULT_PROFILE_SERIES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* 预设模板 */}
      <div className="p-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">预设模板</h3>
        <div className="grid grid-cols-2 gap-1">
          {WINDOW_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              className="flex flex-col items-center gap-1 p-2 rounded-lg text-xs text-gray-400 hover:bg-gray-700/50 hover:text-gray-200 border border-transparent transition-colors"
              onClick={() => handleAddTemplate(tmpl.id)}
              title={tmpl.description}
            >
              <span className="text-lg">{tmpl.icon}</span>
              <span className="truncate w-full text-center">{tmpl.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
