// WindoorDesigner - 移动端属性面板（底部抽屉）
// 触摸友好的滑出式面板

import { useState } from 'react';
import type { WindowUnit, ProfileSeries, SashType } from '@/lib/types';
import { DEFAULT_PROFILE_SERIES } from '@/lib/types';
import { WINDOW_TEMPLATES } from '@/lib/window-factory';
import { X, Package, Layers, Settings2 } from 'lucide-react';

interface MobilePropertiesDrawerProps {
  open: boolean;
  onClose: () => void;
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

type TabId = 'templates' | 'sash' | 'properties';

export default function MobilePropertiesDrawer({
  open,
  onClose,
  selectedWindow,
  activeProfileSeries,
  activeSashType,
  onUpdateWindow,
  onProfileSeriesChange,
  onSashTypeChange,
  onAddTemplate,
}: MobilePropertiesDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('templates');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 bg-[oklch(0.17_0.028_260)] border-t border-[oklch(0.30_0.04_260)] rounded-t-2xl max-h-[70vh] flex flex-col animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-600" />
        </div>

        {/* Header with tabs */}
        <div className="flex items-center justify-between px-4 pb-2">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'templates'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-slate-400 active:bg-white/10'
              }`}
            >
              <Package size={14} />
              预设
            </button>
            <button
              onClick={() => setActiveTab('sash')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'sash'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-slate-400 active:bg-white/10'
              }`}
            >
              <Layers size={14} />
              扇型
            </button>
            <button
              onClick={() => setActiveTab('properties')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'properties'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-slate-400 active:bg-white/10'
              }`}
            >
              <Settings2 size={14} />
              属性
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-slate-400"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {activeTab === 'templates' && (
            <div className="grid grid-cols-3 gap-2">
              {WINDOW_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => { onAddTemplate(tmpl.id); onClose(); }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[oklch(0.20_0.035_260)] active:bg-[oklch(0.25_0.04_260)] border border-transparent active:border-amber-500/30 transition-all"
                >
                  <span className="text-2xl">{tmpl.icon}</span>
                  <span className="text-xs text-slate-300">{tmpl.name}</span>
                  <span className="text-[10px] text-slate-500">{tmpl.width}×{tmpl.height}</span>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'sash' && (
            <div className="space-y-4">
              {/* Sash type grid */}
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">扇类型</label>
                <div className="grid grid-cols-3 gap-2">
                  {SASH_TYPES.map((st) => (
                    <button
                      key={st.id}
                      onClick={() => onSashTypeChange(st.id)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl text-sm transition-all ${
                        activeSashType === st.id
                          ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                          : 'bg-[oklch(0.20_0.035_260)] text-slate-400 active:bg-[oklch(0.25_0.04_260)]'
                      }`}
                    >
                      <span className="text-xl">{st.icon}</span>
                      <span className="text-xs">{st.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Profile Series */}
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">型材系列</label>
                <select
                  value={activeProfileSeries.id}
                  onChange={(e) => {
                    const series = DEFAULT_PROFILE_SERIES.find(s => s.id === e.target.value);
                    if (series) onProfileSeriesChange(series);
                  }}
                  className="w-full bg-[oklch(0.20_0.035_260)] border border-[oklch(0.30_0.04_260)] rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                >
                  {DEFAULT_PROFILE_SERIES.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} (框{s.frameWidth}mm)</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeTab === 'properties' && (
            <div>
              {selectedWindow ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">名称</label>
                    <input
                      type="text"
                      value={selectedWindow.name}
                      onChange={(e) => onUpdateWindow(selectedWindow.id, { name: e.target.value })}
                      className="w-full bg-[oklch(0.20_0.035_260)] border border-[oklch(0.30_0.04_260)] rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">宽度 (mm)</label>
                      <input
                        type="number"
                        value={selectedWindow.width}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (val > 0) onUpdateWindow(selectedWindow.id, { width: val });
                        }}
                        className="w-full bg-[oklch(0.20_0.035_260)] border border-[oklch(0.30_0.04_260)] rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">高度 (mm)</label>
                      <input
                        type="number"
                        value={selectedWindow.height}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (val > 0) onUpdateWindow(selectedWindow.id, { height: val });
                        }}
                        className="w-full bg-[oklch(0.20_0.035_260)] border border-[oklch(0.30_0.04_260)] rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[oklch(0.14_0.025_260)] border border-[oklch(0.25_0.035_260)]">
                    <p className="text-xs text-slate-500">
                      系列: <span className="text-slate-300">{DEFAULT_PROFILE_SERIES.find(s => s.id === selectedWindow.profileSeriesId)?.name || '-'}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      面积: <span className="text-slate-300 font-mono">{((selectedWindow.width * selectedWindow.height) / 1000000).toFixed(2)} m²</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      位置: <span className="text-slate-300 font-mono">({Math.round(selectedWindow.posX)}, {Math.round(selectedWindow.posY)})</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-500">未选中任何窗口</p>
                  <p className="text-xs text-slate-600 mt-1">点击画布上的窗口查看属性</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
