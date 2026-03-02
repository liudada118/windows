// WindoorDesigner - 右侧属性面板 v2.1
// 修复: BUG-001 尺寸修改使用 onBlur 避免每次按键触发 resize
// 修复: BUG-006 属性修改推送历史快照（通过 onUpdateWindow 已实现）
// 修复: BUG-007 型材系列切换联动窗户外观

import { useState, useEffect } from 'react';
import type { WindowUnit, ProfileSeries, SashType } from '@/lib/types';
import { DEFAULT_PROFILE_SERIES, CONSTRAINTS } from '@/lib/types';
import { WINDOW_TEMPLATES } from '@/lib/window-factory';
import { resizeWindowUnit } from '@/lib/window-factory';
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
  { id: 'casement-left', name: '内开左', icon: '◧' },
  { id: 'casement-right', name: '内开右', icon: '◨' },
  { id: 'casement-out-left', name: '外开左', icon: '◧' },
  { id: 'casement-out-right', name: '外开右', icon: '◨' },
  { id: 'casement-top', name: '上悬', icon: '⬒' },
  { id: 'casement-bottom', name: '下悬', icon: '⬓' },
  { id: 'tilt-turn-left', name: '内倒左', icon: '⊿' },
  { id: 'tilt-turn-right', name: '内倒右', icon: '⊿' },
  { id: 'sliding-left', name: '左推', icon: '⇐' },
  { id: 'sliding-right', name: '右推', icon: '⇒' },
  { id: 'folding-left', name: '折叠左', icon: '⋘' },
  { id: 'folding-right', name: '折叠右', icon: '⋙' },
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

  // BUG-001 修复: 使用本地 state 缓存输入值，只在 blur 或 Enter 时提交
  const [localWidth, setLocalWidth] = useState('');
  const [localHeight, setLocalHeight] = useState('');

  // 当选中窗户变化时同步本地值
  useEffect(() => {
    if (selectedWindow) {
      setLocalWidth(String(selectedWindow.width));
      setLocalHeight(String(selectedWindow.height));
    }
  }, [selectedWindow?.id, selectedWindow?.width, selectedWindow?.height]);

  // 提交尺寸修改
  const commitResize = (dimension: 'width' | 'height') => {
    if (!selectedWindow) return;
    const rawValue = dimension === 'width' ? localWidth : localHeight;
    const value = parseInt(rawValue);
    if (isNaN(value) || value <= 0) {
      // 恢复原值
      if (dimension === 'width') setLocalWidth(String(selectedWindow.width));
      else setLocalHeight(String(selectedWindow.height));
      return;
    }
    const clampedValue = Math.max(
      dimension === 'width' ? CONSTRAINTS.MIN_WINDOW_WIDTH : CONSTRAINTS.MIN_WINDOW_HEIGHT,
      Math.min(
        dimension === 'width' ? CONSTRAINTS.MAX_WINDOW_WIDTH : CONSTRAINTS.MAX_WINDOW_HEIGHT,
        value
      )
    );
    // 如果值没变，不触发更新
    if (dimension === 'width' && clampedValue === selectedWindow.width) {
      setLocalWidth(String(clampedValue));
      return;
    }
    if (dimension === 'height' && clampedValue === selectedWindow.height) {
      setLocalHeight(String(clampedValue));
      return;
    }
    const newWidth = dimension === 'width' ? clampedValue : selectedWindow.width;
    const newHeight = dimension === 'height' ? clampedValue : selectedWindow.height;
    const resized = resizeWindowUnit(selectedWindow, newWidth, newHeight);
    onUpdateWindow(selectedWindow.id, {
      width: resized.width,
      height: resized.height,
      frame: resized.frame,
    });
    // 同步本地值为 clamped 后的值
    if (dimension === 'width') setLocalWidth(String(clampedValue));
    else setLocalHeight(String(clampedValue));
  };

  // BUG-007 修复: 型材系列切换时联动所有窗户
  const handleProfileSeriesChange = (series: ProfileSeries) => {
    onProfileSeriesChange(series);
    // 如果有选中窗户，更新其型材系列
    if (selectedWindow && selectedWindow.profileSeriesId !== series.id) {
      // 重建窗户框架以应用新的型材宽度
      const resized = resizeWindowUnit(
        { ...selectedWindow, frame: { ...selectedWindow.frame, profileWidth: series.frameWidth } },
        selectedWindow.width,
        selectedWindow.height
      );
      onUpdateWindow(selectedWindow.id, {
        profileSeriesId: series.id,
        frame: {
          ...resized.frame,
          profileWidth: series.frameWidth,
        },
      });
    }
  };

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

          {/* Profile Series - BUG-007 修复 */}
          <div className="mt-3">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block px-1">型材系列</label>
            <select
              value={activeProfileSeries.id}
              onChange={(e) => {
                const series = DEFAULT_PROFILE_SERIES.find(s => s.id === e.target.value);
                if (series) handleProfileSeriesChange(series);
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

              {/* Width & Height - BUG-001 修复: 使用 onBlur + Enter 提交 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">宽度 (mm)</label>
                  <input
                    type="number"
                    value={localWidth}
                    min={CONSTRAINTS.MIN_WINDOW_WIDTH}
                    max={CONSTRAINTS.MAX_WINDOW_WIDTH}
                    onChange={(e) => setLocalWidth(e.target.value)}
                    onBlur={() => commitResize('width')}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
                    className="w-full bg-[oklch(0.20_0.035_260)] border border-[oklch(0.30_0.04_260)] rounded px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">高度 (mm)</label>
                  <input
                    type="number"
                    value={localHeight}
                    min={CONSTRAINTS.MIN_WINDOW_HEIGHT}
                    max={CONSTRAINTS.MAX_WINDOW_HEIGHT}
                    onChange={(e) => setLocalHeight(e.target.value)}
                    onBlur={() => commitResize('height')}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
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

              {/* 尺寸约束提示 */}
              <div className="mt-1 p-1.5 rounded bg-[oklch(0.12_0.02_260)] border border-[oklch(0.22_0.03_260)]">
                <p className="text-[9px] text-slate-600">
                  宽: {CONSTRAINTS.MIN_WINDOW_WIDTH}-{CONSTRAINTS.MAX_WINDOW_WIDTH}mm | 高: {CONSTRAINTS.MIN_WINDOW_HEIGHT}-{CONSTRAINTS.MAX_WINDOW_HEIGHT}mm
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
