// MaterialPanel - 材料类型和颜色自定义编辑面板
// 支持材料类型选择、预设颜色方案、自定义颜色编辑

import { useState, useCallback } from 'react';
import { useDesignStore } from '@/stores/designStore';
import { COLOR_PRESETS, MATERIAL_TYPES, DEFAULT_MATERIAL_CONFIG } from '@/lib/constants';
import type { ColorConfig, MaterialConfig } from '@/lib/types';
import { Palette, ChevronDown, ChevronRight, Check } from 'lucide-react';

function ColorSwatch({ color, selected, onClick, label }: { color: string; selected: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className={`relative w-8 h-8 rounded-md border-2 transition-all ${selected ? 'border-amber-400 ring-1 ring-amber-400/50 scale-110' : 'border-slate-600 hover:border-slate-400'}`}
      style={{ backgroundColor: color }}
      title={label}
    >
      {selected && (
        <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
      )}
    </button>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 w-12 shrink-0">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded cursor-pointer border border-slate-600 bg-transparent"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-slate-200 font-mono"
      />
    </div>
  );
}

export default function MaterialPanel() {
  const materialConfig = useDesignStore((s) => s.designData.materialConfig) || DEFAULT_MATERIAL_CONFIG;
  const updateMaterialConfig = useDesignStore((s) => s.updateMaterialConfig);
  const [isOpen, setIsOpen] = useState(true);
  const [showCustomColors, setShowCustomColors] = useState(false);

  const handleMaterialChange = useCallback((materialName: string) => {
    updateMaterialConfig({
      ...materialConfig,
      name: materialName,
    });
  }, [materialConfig, updateMaterialConfig]);

  const handlePresetChange = useCallback((presetId: string) => {
    const preset = COLOR_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      updateMaterialConfig({
        ...materialConfig,
        colorPreset: presetId,
        colors: { ...preset.colors },
      });
      setShowCustomColors(false);
    }
  }, [materialConfig, updateMaterialConfig]);

  const handleColorChange = useCallback((key: keyof ColorConfig, value: string | number) => {
    updateMaterialConfig({
      ...materialConfig,
      colorPreset: 'custom',
      colors: { ...materialConfig.colors, [key]: value },
    });
  }, [materialConfig, updateMaterialConfig]);

  return (
    <div className="border-b border-slate-700/50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wider hover:bg-white/5 transition-colors"
      >
        <Palette size={14} />
        <span className="flex-1 text-left">材料 / 颜色</span>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-3">
          {/* 材料类型 */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">材料类型</label>
            <select
              value={materialConfig.name}
              onChange={(e) => handleMaterialChange(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-slate-800 border border-slate-600 rounded text-slate-200"
            >
              {MATERIAL_TYPES.map((m) => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* 预设颜色方案 */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">颜色方案</label>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((preset) => (
                <ColorSwatch
                  key={preset.id}
                  color={preset.colors.frameColor}
                  selected={materialConfig.colorPreset === preset.id}
                  onClick={() => handlePresetChange(preset.id)}
                  label={preset.name}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-slate-500">
                当前: {COLOR_PRESETS.find(p => p.id === materialConfig.colorPreset)?.name || '自定义'}
              </span>
            </div>
          </div>

          {/* 自定义颜色展开 */}
          <div>
            <button
              onClick={() => setShowCustomColors(!showCustomColors)}
              className="flex items-center gap-1 text-xs text-amber-400/80 hover:text-amber-400 transition-colors"
            >
              {showCustomColors ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>自定义颜色</span>
            </button>

            {showCustomColors && (
              <div className="mt-2 space-y-2">
                <ColorInput label="框色" value={materialConfig.colors.frameColor} onChange={(v) => handleColorChange('frameColor', v)} />
                <ColorInput label="扇色" value={materialConfig.colors.sashColor} onChange={(v) => handleColorChange('sashColor', v)} />
                <ColorInput label="中梃" value={materialConfig.colors.mullionColor} onChange={(v) => handleColorChange('mullionColor', v)} />
                <ColorInput label="玻璃" value={materialConfig.colors.glassColor} onChange={(v) => handleColorChange('glassColor', v)} />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-12 shrink-0">透明度</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(materialConfig.colors.glassTint * 100)}
                    onChange={(e) => handleColorChange('glassTint', parseInt(e.target.value) / 100)}
                    className="flex-1 h-1 accent-amber-400"
                  />
                  <span className="text-xs text-slate-400 w-8 text-right">{Math.round(materialConfig.colors.glassTint * 100)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* 颜色预览 */}
          <div className="flex gap-1 items-center">
            <span className="text-[10px] text-slate-500 mr-1">预览:</span>
            <div className="w-5 h-5 rounded-sm border border-slate-600" style={{ backgroundColor: materialConfig.colors.frameColor }} title="框" />
            <div className="w-5 h-5 rounded-sm border border-slate-600" style={{ backgroundColor: materialConfig.colors.sashColor }} title="扇" />
            <div className="w-5 h-5 rounded-sm border border-slate-600" style={{ backgroundColor: materialConfig.colors.mullionColor }} title="中梃" />
            <div className="w-5 h-5 rounded-sm border border-slate-600" style={{ backgroundColor: materialConfig.colors.glassColor, opacity: materialConfig.colors.glassTint + 0.3 }} title="玻璃" />
          </div>
        </div>
      )}
    </div>
  );
}
