// WindoorDesigner - 右侧属性面板
// 工业蓝图美学: 紧凑的属性编辑面板

import { useState } from 'react';
import type { WindowUnit, ProfileSeries, SashType } from '@/lib/types';
import { DEFAULT_PROFILE_SERIES } from '@/lib/types';
import { WINDOW_TEMPLATES } from '@/lib/window-factory';
import { ChevronDown, ChevronRight, Package, Layers, Settings2 } from 'lucide-react';

interface PropertiesPanelProps {
  selectedWindow: WindowUnit | null;
  activeProfileSeries: ProfileSeries;
  activeSashType: SashType;
  onUpdateWindow: (id: string, updates: Partial<WindowUnit>) => void;
  onProfileSeriesChange: (series: ProfileSeries) => void;
  onSashTypeChange: (type: SashType) => void;
  onAddTemplate: (templateId: string) => void;
}

const SASH_TYPES: { id: SashType; name: string; icon: string }[] = [
  { id: 'fixed', name: '固定', icon: '⬜' },
  { id: 'casement-left', name: '左开', icon: '◧' },
  { id: 'casement-right', name: '右开', icon: '◨' },
  { id: 'casement-top', name: '上悬', icon: '⬒' },
  { id: 'sliding-left', name: '左推', icon: '⇐' },
  { id: 'sliding-right', name: '右推', icon: '⇒' },
];

function SectionHeader({ title, icon, isOpen, onClick }: { title: string; icon: React.ReactNode; isOpen: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wider hover:bg-white/5 transition-colors"
    >
      {icon}
      <span className="flex-1 text-left">{title}</span>
      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
    </button>
  );
}

export default function PropertiesPanel({
  selectedWindow,
  activeProfileSeries,
  activeSashType,
  onUpdateWindow,
  onProfileSeriesChange,
  onSashTypeChange,
  onAddTemplate,
}: PropertiesPanelProps) {
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);

  return (
    <div className="w-64 bg-[oklch(0.17_0.028_260)] border-l border-[oklch(0.28_0.035_260)] flex flex-col overflow-y-auto">
      {/* Templates Section */}
      <SectionHeader
        title="预设窗型"
        icon={<Package size={14} className="text-amber-400" />}
        isOpen={templatesOpen}
        onClick={() => setTemplatesOpen(!templatesOpen)}
      />
      {templatesOpen && (
        <div className="px-2 pb-3">
          <div className="grid grid-cols-2 gap-1.5">
            {WINDOW_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => onAddTemplate(tmpl.id)}
                className="flex flex-col items-center gap-1 p-2 rounded bg-[oklch(0.20_0.035_260)] hover:bg-[oklch(0.25_0.04_260)] border border-transparent hover:border-amber-500/30 transition-all group"
              >
                <span className="text-xl leading-none group-hover:scale-110 transition-transform">{tmpl.icon}</span>
                <span className="text-[10px] text-slate-400 group-hover:text-slate-200">{tmpl.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-[oklch(0.28_0.035_260)]" />

      {/* Sash Type Selection */}
      <SectionHeader
        title="扇类型"
        icon={<Layers size={14} className="text-amber-400" />}
        isOpen={settingsOpen}
        onClick={() => setSettingsOpen(!settingsOpen)}
      />
      {settingsOpen && (
        <div className="px-2 pb-3">
          <div className="grid grid-cols-3 gap-1">
            {SASH_TYPES.map((st) => (
              <button
                key={st.id}
                onClick={() => onSashTypeChange(st.id)}
                className={`flex flex-col items-center gap-0.5 p-1.5 rounded text-xs transition-all ${
                  activeSashType === st.id
                    ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                    : 'bg-[oklch(0.20_0.035_260)] text-slate-400 hover:text-slate-200 hover:bg-[oklch(0.25_0.04_260)]'
                }`}
              >
                <span className="text-base leading-none">{st.icon}</span>
                <span className="text-[9px]">{st.name}</span>
              </button>
            ))}
          </div>

          {/* Profile Series */}
          <div className="mt-3">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block px-1">型材系列</label>
            <select
              value={activeProfileSeries.id}
              onChange={(e) => {
                const series = DEFAULT_PROFILE_SERIES.find(s => s.id === e.target.value);
                if (series) onProfileSeriesChange(series);
              }}
              className="w-full bg-[oklch(0.20_0.035_260)] border border-[oklch(0.30_0.04_260)] rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            >
              {DEFAULT_PROFILE_SERIES.map((s) => (
                <option key={s.id} value={s.id}>{s.name} (框{s.frameWidth}mm)</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-[oklch(0.28_0.035_260)]" />

      {/* Properties Section */}
      <SectionHeader
        title="属性"
        icon={<Settings2 size={14} className="text-amber-400" />}
        isOpen={propertiesOpen}
        onClick={() => setPropertiesOpen(!propertiesOpen)}
      />
      {propertiesOpen && (
        <div className="px-3 pb-3">
          {selectedWindow ? (
            <div className="space-y-2">
              {/* Name */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">名称</label>
                <input
                  type="text"
                  value={selectedWindow.name}
                  onChange={(e) => onUpdateWindow(selectedWindow.id, { name: e.target.value })}
                  className="w-full bg-[oklch(0.20_0.035_260)] border border-[oklch(0.30_0.04_260)] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                />
              </div>

              {/* Width & Height */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">宽度 (mm)</label>
                  <input
                    type="number"
                    value={selectedWindow.width}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val > 0) onUpdateWindow(selectedWindow.id, { width: val });
                    }}
                    className="w-full bg-[oklch(0.20_0.035_260)] border border-[oklch(0.30_0.04_260)] rounded px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">高度 (mm)</label>
                  <input
                    type="number"
                    value={selectedWindow.height}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val > 0) onUpdateWindow(selectedWindow.id, { height: val });
                    }}
                    className="w-full bg-[oklch(0.20_0.035_260)] border border-[oklch(0.30_0.04_260)] rounded px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              {/* Position */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">X 位置</label>
                  <span className="text-xs text-slate-400 font-mono">{Math.round(selectedWindow.posX)}</span>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">Y 位置</label>
                  <span className="text-xs text-slate-400 font-mono">{Math.round(selectedWindow.posY)}</span>
                </div>
              </div>

              {/* Info */}
              <div className="mt-2 p-2 rounded bg-[oklch(0.14_0.025_260)] border border-[oklch(0.25_0.035_260)]">
                <p className="text-[10px] text-slate-500">
                  系列: <span className="text-slate-300">{DEFAULT_PROFILE_SERIES.find(s => s.id === selectedWindow.profileSeriesId)?.name || '-'}</span>
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  面积: <span className="text-slate-300 font-mono">{((selectedWindow.width * selectedWindow.height) / 1000000).toFixed(2)} m²</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-xs text-slate-500">未选中任何窗口</p>
              <p className="text-[10px] text-slate-600 mt-1">点击画布上的窗口或从预设中添加</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
