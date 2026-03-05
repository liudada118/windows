// WindoorDesigner - 右侧属性面板 v2.2
// 工业蓝图美学: 紧凑的属性编辑面板
// v2.2: 分格尺寸可直接编辑（点击数字变为输入框），中梃位置精确输入

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { WindowUnit, ProfileSeries, SashType, Opening, Mullion } from '@/lib/types';
import { DEFAULT_PROFILE_SERIES, CONSTRAINTS } from '@/lib/types';
import { WINDOW_TEMPLATES } from '@/lib/window-factory';
import { resizeWindowUnit, updateMullionInOpenings } from '@/lib/window-factory';
import { ChevronDown, ChevronRight, Package, Layers, Settings2, Ruler, Move, Pencil, Grid3X3 } from 'lucide-react';
import MaterialPanel from './MaterialPanel';
import CustomSplitDialog from './CustomSplitDialog';
import type { SplitConfig } from './CustomSplitDialog';

interface PropertiesPanelProps {
  selectedWindow: WindowUnit | null;
  activeProfileSeries: ProfileSeries;
  activeSashType: SashType;
  selectedElementId: string | null;
  selectedElementType: string | null;
  onUpdateWindow: (id: string, updates: Partial<WindowUnit>) => void;
  onProfileSeriesChange: (series: ProfileSeries) => void;
  onSashTypeChange: (type: SashType) => void;
  onAddTemplate: (templateId: string) => void;
  onAddCustomSplit?: (config: SplitConfig) => void;
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

// 内联可编辑数值组件
function EditableValue({
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
  onConfirm: (newValue: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setInputValue(String(Math.round(value)));
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
    }
  }, [editing, value]);

  const handleConfirm = useCallback(() => {
    const num = parseInt(inputValue, 10);
    if (!isNaN(num) && num >= min && num <= max) {
      onConfirm(num);
    }
    setEditing(false);
  }, [inputValue, min, max, onConfirm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      setEditing(false);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      setInputValue(String(Math.min(max, parseInt(inputValue || '0') + step)));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      setInputValue(String(Math.max(min, parseInt(inputValue || '0') - step)));
    }
  }, [handleConfirm, inputValue, min, max]);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleConfirm}
          className="w-16 bg-[oklch(0.10_0.02_260)] border border-amber-500/60 rounded px-1.5 py-0.5 text-[11px] text-amber-300 font-mono text-center focus:outline-none focus:ring-1 focus:ring-amber-500/60"
        />
        <span className="text-[9px] text-slate-600">{suffix}</span>
      </div>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="text-[11px] text-slate-300 font-mono cursor-pointer hover:text-amber-300 hover:bg-amber-500/10 rounded px-1 py-0.5 transition-colors group inline-flex items-center gap-0.5"
      title="点击编辑"
    >
      {Math.round(value)}
      <Pencil size={9} className="text-slate-600 group-hover:text-amber-400 transition-colors" />
    </span>
  );
}

// 递归查找中梃及其父Opening
function findMullionInOpenings(openings: Opening[], mullionId: string): { mullion: Mullion; parentOpening: Opening } | null {
  for (const opening of openings) {
    const m = opening.mullions.find(m => m.id === mullionId);
    if (m) return { mullion: m, parentOpening: opening };
    if (opening.childOpenings.length > 0) {
      const found = findMullionInOpenings(opening.childOpenings, mullionId);
      if (found) return found;
    }
  }
  return null;
}

// 递归查找包含指定opening的父opening（用于通过分格尺寸反推中梃位置）
function findParentOfOpening(openings: Opening[], targetId: string): { parent: Opening; childIndex: number } | null {
  for (const opening of openings) {
    for (let i = 0; i < opening.childOpenings.length; i++) {
      if (opening.childOpenings[i].id === targetId) {
        return { parent: opening, childIndex: i };
      }
    }
    if (opening.childOpenings.length > 0) {
      const found = findParentOfOpening(opening.childOpenings, targetId);
      if (found) return found;
    }
  }
  return null;
}

export default function PropertiesPanel({
  selectedWindow,
  activeProfileSeries,
  activeSashType,
  selectedElementId,
  selectedElementType,
  onUpdateWindow,
  onProfileSeriesChange,
  onSashTypeChange,
  onAddTemplate,
}: PropertiesPanelProps) {
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [mullionOpen, setMullionOpen] = useState(true);
  const [sizesOpen, setSizesOpen] = useState(true);
  const [customSplitOpen, setCustomSplitOpen] = useState(false);

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

  // v2.2: 窗户尺寸精确输入（配合 EditableValue 组件）
  const handleResize = useCallback((dimension: 'width' | 'height', value: number) => {
    if (!selectedWindow) return;
    const clampedValue = Math.max(
      dimension === 'width' ? CONSTRAINTS.MIN_WINDOW_WIDTH : CONSTRAINTS.MIN_WINDOW_HEIGHT,
      Math.min(
        dimension === 'width' ? CONSTRAINTS.MAX_WINDOW_WIDTH : CONSTRAINTS.MAX_WINDOW_HEIGHT,
        value
      )
    );
    if (dimension === 'width' && clampedValue === selectedWindow.width) return;
    if (dimension === 'height' && clampedValue === selectedWindow.height) return;
    const newWidth = dimension === 'width' ? clampedValue : selectedWindow.width;
    const newHeight = dimension === 'height' ? clampedValue : selectedWindow.height;
    const resized = resizeWindowUnit(selectedWindow, newWidth, newHeight);
    onUpdateWindow(selectedWindow.id, {
      width: resized.width,
      height: resized.height,
      frame: resized.frame,
    });
  }, [selectedWindow, onUpdateWindow]);

  // v2.1: 获取选中的中梃信息
  const selectedMullionInfo = useMemo(() => {
    if (!selectedWindow || !selectedElementId || selectedElementType !== 'mullion') return null;
    return findMullionInOpenings(selectedWindow.frame.openings, selectedElementId);
  }, [selectedWindow, selectedElementId, selectedElementType]);

  // v2.1: 修改中梃位置
  const handleMullionPositionChange = (newPosition: number) => {
    if (!selectedWindow || !selectedMullionInfo) return;
    const mullionWidth = activeProfileSeries.mullionWidth;
    const newFrame = JSON.parse(JSON.stringify(selectedWindow.frame));
    newFrame.openings = updateMullionInOpenings(newFrame.openings, selectedMullionInfo.mullion.id, newPosition, mullionWidth);
    onUpdateWindow(selectedWindow.id, { frame: newFrame });
  };

  // v2.2: 收集所有分格尺寸信息（增强版，包含中梃引用）
  const openingSizes = useMemo(() => {
    if (!selectedWindow) return [];
    const sizes: {
      id: string;
      label: string;
      width: number;
      height: number;
      parentOpeningId: string | null;
      mullionId: string | null;
      mullionType: 'vertical' | 'horizontal' | null;
      childIndex: number;
    }[] = [];

    const collectSizes = (openings: Opening[], parentId: string | null, prefix: string = '') => {
      for (let i = 0; i < openings.length; i++) {
        const o = openings[i];
        if (o.isSplit && o.childOpenings.length > 0) {
          const mullion = o.mullions[0];
          for (let j = 0; j < o.childOpenings.length; j++) {
            const child = o.childOpenings[j];
            if (child.isSplit && child.childOpenings.length > 0) {
              collectSizes([child], o.id, `${prefix}${i + 1}.`);
            } else {
              sizes.push({
                id: child.id,
                label: `${prefix}${i + 1}.${j + 1}`,
                width: Math.round(child.rect.width),
                height: Math.round(child.rect.height),
                parentOpeningId: o.id,
                mullionId: mullion?.id || null,
                mullionType: mullion?.type || null,
                childIndex: j,
              });
            }
          }
        } else {
          sizes.push({
            id: o.id,
            label: `${prefix}${i + 1}`,
            width: Math.round(o.rect.width),
            height: Math.round(o.rect.height),
            parentOpeningId: parentId,
            mullionId: null,
            mullionType: null,
            childIndex: i,
          });
        }
      }
    };
    collectSizes(selectedWindow.frame.openings, null);
    return sizes;
  }, [selectedWindow]);

  // v2.2: 通过修改分格尺寸来移动中梃
  const handleOpeningSizeChange = useCallback((
    openingId: string,
    dimension: 'width' | 'height',
    newSize: number,
  ) => {
    if (!selectedWindow) return;

    // 找到这个opening的父opening和对应的中梃
    const parentInfo = findParentOfOpening(selectedWindow.frame.openings, openingId);
    if (!parentInfo) return;

    const { parent, childIndex } = parentInfo;
    const mullion = parent.mullions[0];
    if (!mullion) return;

    const halfMullion = mullion.profileWidth / 2;
    let newPosition: number;

    if (mullion.type === 'vertical' && dimension === 'width') {
      if (childIndex === 0) {
        // 修改左侧分格宽度：中梃位置 = 分格起点 + 新宽度 + 半中梃宽
        newPosition = parent.childOpenings[0].rect.x + newSize + halfMullion;
      } else {
        // 修改右侧分格宽度：中梃位置 = 分格终点 - 新宽度 - 半中梃宽
        const child = parent.childOpenings[childIndex];
        newPosition = child.rect.x + child.rect.width - newSize - halfMullion;
      }
    } else if (mullion.type === 'horizontal' && dimension === 'height') {
      if (childIndex === 0) {
        newPosition = parent.childOpenings[0].rect.y + newSize + halfMullion;
      } else {
        const child = parent.childOpenings[childIndex];
        newPosition = child.rect.y + child.rect.height - newSize - halfMullion;
      }
    } else {
      return; // 不匹配的维度
    }

    const mullionWidth = activeProfileSeries.mullionWidth;
    const newFrame = JSON.parse(JSON.stringify(selectedWindow.frame));
    newFrame.openings = updateMullionInOpenings(newFrame.openings, mullion.id, newPosition, mullionWidth);
    onUpdateWindow(selectedWindow.id, { frame: newFrame });
  }, [selectedWindow, activeProfileSeries.mullionWidth, onUpdateWindow]);

  return (
    <div className="w-64 bg-[oklch(0.17_0.028_260)] border-l border-[oklch(0.28_0.035_260)] flex flex-col overflow-y-auto">
      {/* Material & Color Section */}
      <MaterialPanel />

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
            {/* 自定义等分 */}
            <button
              onClick={() => setCustomSplitOpen(true)}
              className="flex flex-col items-center gap-1 p-2 rounded bg-[oklch(0.20_0.035_260)] hover:bg-[oklch(0.25_0.04_260)] border border-dashed border-amber-500/30 hover:border-amber-500/60 transition-all group"
            >
              <Grid3X3 size={20} className="text-amber-400/60 group-hover:text-amber-400 transition-colors" />
              <span className="text-[10px] text-amber-400/60 group-hover:text-amber-300">自定义等分</span>
            </button>
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

              {/* Width & Height - v2.2: 使用EditableValue组件 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">宽度</label>
                  <EditableValue
                    value={selectedWindow.width}
                    min={CONSTRAINTS.MIN_WINDOW_WIDTH}
                    max={CONSTRAINTS.MAX_WINDOW_WIDTH}
                    onConfirm={(val) => handleResize('width', val)}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">高度</label>
                  <EditableValue
                    value={selectedWindow.height}
                    min={CONSTRAINTS.MIN_WINDOW_HEIGHT}
                    max={CONSTRAINTS.MAX_WINDOW_HEIGHT}
                    onConfirm={(val) => handleResize('height', val)}
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
                <p className="text-[9px] text-amber-500/60 mt-0.5">
                  点击数字可直接编辑 · 双击画布标注也可输入
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

      {/* v2.1: 中梃精确控制面板 */}
      {selectedMullionInfo && selectedWindow && (
        <>
          <div className="h-px bg-[oklch(0.28_0.035_260)]" />
          <SectionHeader
            title="中梃控制"
            icon={<Move size={14} className="text-amber-400" />}
            isOpen={mullionOpen}
            onClick={() => setMullionOpen(!mullionOpen)}
          />
          {mullionOpen && (
            <div className="px-3 pb-3">
              <div className="space-y-2">
                {/* 中梃类型 */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">类型</label>
                  <span className="text-xs text-slate-300">
                    {selectedMullionInfo.mullion.type === 'vertical' ? '竖向中梃' : '横向中梃'}
                  </span>
                </div>

                {/* 中梃位置 - v2.2: 使用EditableValue */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">
                    位置 (相对于窗框内边)
                  </label>
                  <EditableValue
                    value={selectedMullionInfo.mullion.position}
                    min={50}
                    max={selectedMullionInfo.mullion.type === 'vertical'
                      ? selectedWindow.width - 50
                      : selectedWindow.height - 50}
                    onConfirm={(val) => handleMullionPositionChange(val)}
                  />
                </div>

                {/* 分格尺寸 */}
                {selectedMullionInfo.parentOpening.childOpenings.length >= 2 && (
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 block">分格尺寸</label>
                    <div className="space-y-1">
                      {selectedMullionInfo.parentOpening.childOpenings.map((child, i) => {
                        const isVertical = selectedMullionInfo.mullion.type === 'vertical';
                        return (
                          <div key={child.id} className="flex items-center gap-2 p-1.5 rounded bg-[oklch(0.14_0.025_260)] border border-[oklch(0.25_0.035_260)]">
                            <span className="text-[9px] text-slate-500 w-6">#{i + 1}</span>
                            <div className="flex items-center gap-1 flex-1">
                              {isVertical ? (
                                <>
                                  <EditableValue
                                    value={child.rect.width}
                                    min={50}
                                    max={selectedWindow.width - 50}
                                    suffix=""
                                    onConfirm={(val) => handleOpeningSizeChange(child.id, 'width', val)}
                                  />
                                  <span className="text-[9px] text-slate-600">×</span>
                                  <span className="text-[10px] text-slate-400 font-mono">{Math.round(child.rect.height)}</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-[10px] text-slate-400 font-mono">{Math.round(child.rect.width)}</span>
                                  <span className="text-[9px] text-slate-600">×</span>
                                  <EditableValue
                                    value={child.rect.height}
                                    min={50}
                                    max={selectedWindow.height - 50}
                                    suffix=""
                                    onConfirm={(val) => handleOpeningSizeChange(child.id, 'height', val)}
                                  />
                                </>
                              )}
                              <span className="text-[9px] text-slate-600 ml-auto">mm</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 微调提示 */}
                <div className="mt-1 p-1.5 rounded bg-[oklch(0.12_0.02_260)] border border-[oklch(0.22_0.03_260)]">
                  <p className="text-[9px] text-amber-500/60">
                    方向键 ±1mm · Shift+方向键 ±10mm
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* v2.2: 分格尺寸总览（可编辑） */}
      {selectedWindow && openingSizes.length > 1 && !selectedMullionInfo && (
        <>
          <div className="h-px bg-[oklch(0.28_0.035_260)]" />
          <SectionHeader
            title="分格尺寸"
            icon={<Ruler size={14} className="text-amber-400" />}
            isOpen={sizesOpen}
            onClick={() => setSizesOpen(!sizesOpen)}
          />
          {sizesOpen && (
            <div className="px-3 pb-3">
              <div className="space-y-1">
                {openingSizes.map((s) => {
                  const canEditWidth = s.mullionType === 'vertical';
                  const canEditHeight = s.mullionType === 'horizontal';
                  return (
                    <div key={s.id} className="flex items-center gap-2 p-1.5 rounded bg-[oklch(0.14_0.025_260)] border border-[oklch(0.25_0.035_260)]">
                      <span className="text-[9px] text-slate-500 w-8">#{s.label}</span>
                      <div className="flex items-center gap-1 flex-1">
                        {canEditWidth ? (
                          <EditableValue
                            value={s.width}
                            min={50}
                            max={selectedWindow.width - 50}
                            suffix=""
                            onConfirm={(val) => handleOpeningSizeChange(s.id, 'width', val)}
                          />
                        ) : (
                          <span className="text-[10px] text-slate-300 font-mono">{s.width}</span>
                        )}
                        <span className="text-[9px] text-slate-600">×</span>
                        {canEditHeight ? (
                          <EditableValue
                            value={s.height}
                            min={50}
                            max={selectedWindow.height - 50}
                            suffix=""
                            onConfirm={(val) => handleOpeningSizeChange(s.id, 'height', val)}
                          />
                        ) : (
                          <span className="text-[10px] text-slate-300 font-mono">{s.height}</span>
                        )}
                        <span className="text-[9px] text-slate-600 ml-auto">mm</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[9px] text-amber-500/60 mt-2">
                点击可编辑的尺寸数字直接输入精确值
              </p>
            </div>
          )}
        </>
      )}

      {/* 自定义等分对话框 */}
      <CustomSplitDialog
        isOpen={customSplitOpen}
        onClose={() => setCustomSplitOpen(false)}
        onConfirm={(config) => {
          if (onAddCustomSplit) {
            onAddCustomSplit(config);
          }
          setCustomSplitOpen(false);
        }}
      />
    </div>
  );
}
