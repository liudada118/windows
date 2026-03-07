// WindoorDesigner - 画图设置面板
// 包含型材尺寸配置（框/梃）和画图选项
// 参考行业标准：框、中梃、加强中梃、扇中梃、上滑、固上滑、扇框、玻璃压线

import { useState, useCallback } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { useDesignStore } from '@/stores/designStore';
import type { DrawingSettings, ProfileDimensions } from '@windoor/shared';

interface DrawingSettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

/** 默认型材尺寸 */
const DEFAULT_PROFILE_DIMENSIONS: ProfileDimensions = {
  frameWidth: 38,
  mullionWidth: 29,
  reinforcedMullionWidth: 90,
  sashMullionWidth: 28,
  topSlideWidth: 0,
  fixedTopSlideWidth: 0,
  sashWidth: 55,
  glazingBeadWidth: 15,
};

/** 默认画图设置 */
const DEFAULT_DRAWING_SETTINGS: DrawingSettings = {
  casementProfile: DEFAULT_PROFILE_DIMENSIONS,
  showInnerDimensions: true,
  showOuterDimensions: true,
};

/** 数值输入框组件 */
function NumberInput({
  label,
  value,
  onChange,
  min = 0,
  max = 200,
  placeholder = '',
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-400">{label}：</label>
      <input
        type="number"
        value={value || ''}
        onChange={(e) => {
          const v = parseInt(e.target.value) || 0;
          onChange(Math.max(min, Math.min(max, v)));
        }}
        placeholder={placeholder}
        className="w-full h-9 px-3 bg-white border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-colors"
        min={min}
        max={max}
      />
    </div>
  );
}

/** 可折叠的分组 */
function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        {isOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>
      {isOpen && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default function DrawingSettingsPanel({ open, onClose }: DrawingSettingsPanelProps) {
  const drawingSettings = useDesignStore((s) => s.designData.drawingSettings);
  const updateDrawingSettings = useDesignStore((s) => s.updateDrawingSettings);

  const settings = drawingSettings || DEFAULT_DRAWING_SETTINGS;
  const profile = settings.casementProfile;

  const [activeTab, setActiveTab] = useState<'profile' | 'drawing'>('profile');

  const updateProfile = useCallback((key: keyof ProfileDimensions, value: number) => {
    const newSettings: DrawingSettings = {
      ...settings,
      casementProfile: {
        ...profile,
        [key]: value,
      },
    };
    updateDrawingSettings(newSettings);
  }, [settings, profile, updateDrawingSettings]);

  const updateSetting = useCallback((key: keyof DrawingSettings, value: boolean) => {
    const newSettings: DrawingSettings = {
      ...settings,
      [key]: value,
    };
    updateDrawingSettings(newSettings);
  }, [settings, updateDrawingSettings]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">画图设置</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-slate-200 px-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            型材
          </button>
          <button
            onClick={() => setActiveTab('drawing')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'drawing'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            画图
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'profile' ? (
            <>
              {/* 型材尺寸标题 */}
              <div className="text-sm text-slate-600 font-medium">
                <span className="inline-block w-2 h-2 bg-slate-800 rounded-full mr-2 align-middle" />
                型材尺寸 (mm)
              </div>

              {/* 框/梃 */}
              <CollapsibleSection title="框/梃" defaultOpen={true}>
                <div className="space-y-4">
                  <div className="text-xs text-blue-500 font-medium mb-2">平开/推拉</div>
                  
                  {/* 第一行：框、中梃、加强中梃 */}
                  <div className="grid grid-cols-3 gap-3">
                    <NumberInput
                      label="框"
                      value={profile.frameWidth}
                      onChange={(v) => updateProfile('frameWidth', v)}
                    />
                    <NumberInput
                      label="中梃"
                      value={profile.mullionWidth}
                      onChange={(v) => updateProfile('mullionWidth', v)}
                    />
                    <NumberInput
                      label="加强中梃"
                      value={profile.reinforcedMullionWidth}
                      onChange={(v) => updateProfile('reinforcedMullionWidth', v)}
                    />
                  </div>

                  {/* 第二行：扇中梃、上滑、固上滑 */}
                  <div className="grid grid-cols-3 gap-3">
                    <NumberInput
                      label="扇中梃"
                      value={profile.sashMullionWidth}
                      onChange={(v) => updateProfile('sashMullionWidth', v)}
                    />
                    <NumberInput
                      label="上滑"
                      value={profile.topSlideWidth}
                      onChange={(v) => updateProfile('topSlideWidth', v)}
                    />
                    <NumberInput
                      label="固上滑"
                      value={profile.fixedTopSlideWidth}
                      onChange={(v) => updateProfile('fixedTopSlideWidth', v)}
                    />
                  </div>
                </div>
              </CollapsibleSection>

              {/* 扇 */}
              <CollapsibleSection title="扇" defaultOpen={true}>
                <div className="space-y-4">
                  <div className="text-xs text-blue-500 font-medium mb-2">平开/推拉</div>
                  <div className="grid grid-cols-3 gap-3">
                    <NumberInput
                      label="扇框"
                      value={profile.sashWidth}
                      onChange={(v) => updateProfile('sashWidth', v)}
                    />
                    <NumberInput
                      label="玻璃压线"
                      value={profile.glazingBeadWidth}
                      onChange={(v) => updateProfile('glazingBeadWidth', v)}
                    />
                    <div /> {/* 占位 */}
                  </div>
                </div>
              </CollapsibleSection>
            </>
          ) : (
            <>
              {/* 画图选项 */}
              <div className="text-sm text-slate-600 font-medium">
                <span className="inline-block w-2 h-2 bg-slate-800 rounded-full mr-2 align-middle" />
                标注显示
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showOuterDimensions}
                    onChange={(e) => updateSetting('showOuterDimensions', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400"
                  />
                  <span className="text-sm text-slate-700">显示外框尺寸</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showInnerDimensions}
                    onChange={(e) => updateSetting('showInnerDimensions', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400"
                  />
                  <span className="text-sm text-slate-700">显示内空尺寸</span>
                </label>
              </div>
            </>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={() => {
              updateDrawingSettings(DEFAULT_DRAWING_SETTINGS);
            }}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            恢复默认
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
