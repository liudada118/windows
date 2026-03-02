// WindoorDesigner - 右侧属性面板
// 显示选中窗户/元素的属性，提供编辑功能

import { useDesignStore } from '@/stores/designStore';
import { useHistoryStore } from '@/stores/historyStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { DEFAULT_PROFILE_SERIES } from '@windoor/shared';
import { CONSTRAINTS } from '@windoor/shared';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

/** 属性行 */
function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <div className="flex-1 text-right">{children}</div>
    </div>
  );
}

/** 数值输入 */
function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = 'mm',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 text-right"
        value={Math.round(value)}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
      />
      <span className="text-xs text-gray-500">{suffix}</span>
    </div>
  );
}

export default function PropertyPanel() {
  const selectedWindowId = useDesignStore((s) => s.selectedWindowId);
  const selectedElementId = useDesignStore((s) => s.selectedElementId);
  const selectedElementType = useDesignStore((s) => s.selectedElementType);
  const designData = useDesignStore((s) => s.designData);
  const updateWindowSize = useDesignStore((s) => s.updateWindowSize);
  const updateWindowPosition = useDesignStore((s) => s.updateWindowPosition);
  const updateWindow = useDesignStore((s) => s.updateWindow);
  const deleteWindow = useDesignStore((s) => s.deleteWindow);
  const deleteMullion = useDesignStore((s) => s.deleteMullion);
  const deleteSash = useDesignStore((s) => s.deleteSash);
  const getSnapshot = useDesignStore((s) => s.getSnapshot);
  const pushHistory = useHistoryStore((s) => s.pushHistory);
  const mouseWorldPos = useCanvasStore((s) => s.mouseWorldPos);

  const selectedWindow = designData.windows.find((w) => w.id === selectedWindowId);

  if (!selectedWindow) {
    return (
      <div className="w-64 bg-gray-900 border-l border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-4">属性面板</h3>
        <p className="text-xs text-gray-500">请选择一个窗户查看属性</p>
        <div className="mt-4 border-t border-gray-700 pt-4">
          <h4 className="text-xs font-semibold text-gray-500 mb-2">画布信息</h4>
          <PropRow label="窗户数量">
            <span className="text-sm text-gray-200">{designData.windows.length}</span>
          </PropRow>
          <PropRow label="鼠标位置">
            <span className="text-xs text-gray-400 font-mono">
              {Math.round(mouseWorldPos.x)}, {Math.round(mouseWorldPos.y)}
            </span>
          </PropRow>
        </div>
      </div>
    );
  }

  const series = DEFAULT_PROFILE_SERIES.find((s) => s.id === selectedWindow.profileSeriesId);

  const handleWidthChange = (newWidth: number) => {
    if (newWidth < CONSTRAINTS.MIN_WINDOW_WIDTH || newWidth > CONSTRAINTS.MAX_WINDOW_WIDTH) {
      toast.error(`宽度范围: ${CONSTRAINTS.MIN_WINDOW_WIDTH}-${CONSTRAINTS.MAX_WINDOW_WIDTH}mm`);
      return;
    }
    pushHistory(getSnapshot());
    updateWindowSize(selectedWindow.id, newWidth, selectedWindow.height);
  };

  const handleHeightChange = (newHeight: number) => {
    if (newHeight < CONSTRAINTS.MIN_WINDOW_HEIGHT || newHeight > CONSTRAINTS.MAX_WINDOW_HEIGHT) {
      toast.error(`高度范围: ${CONSTRAINTS.MIN_WINDOW_HEIGHT}-${CONSTRAINTS.MAX_WINDOW_HEIGHT}mm`);
      return;
    }
    pushHistory(getSnapshot());
    updateWindowSize(selectedWindow.id, selectedWindow.width, newHeight);
  };

  const handleDelete = () => {
    pushHistory(getSnapshot());
    deleteWindow(selectedWindow.id);
    toast.success('已删除窗户');
  };

  const handleDeleteElement = () => {
    if (!selectedElementId || !selectedElementType) return;
    pushHistory(getSnapshot());
    if (selectedElementType === 'mullion') {
      deleteMullion(selectedWindow.id, selectedElementId);
      toast.success('已删除中梃');
    } else if (selectedElementType === 'sash') {
      deleteSash(selectedWindow.id, selectedElementId);
      toast.success('已删除扇');
    }
  };

  // 统计分格数量
  const countOpenings = (openings: any[]): number => {
    let count = 0;
    for (const o of openings) {
      if (o.childOpenings && o.childOpenings.length > 0) {
        count += countOpenings(o.childOpenings);
      } else {
        count += 1;
      }
    }
    return count;
  };

  return (
    <div className="w-64 bg-gray-900 border-l border-gray-700 flex flex-col overflow-y-auto">
      {/* 窗户基本属性 */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-200">窗户属性</h3>
          <button
            className="p-1.5 rounded text-red-400 hover:bg-red-500/20 transition-colors"
            onClick={handleDelete}
            title="删除窗户"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <PropRow label="名称">
          <input
            className="w-28 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 text-right"
            value={selectedWindow.name}
            onChange={(e) => updateWindow(selectedWindow.id, { name: e.target.value })}
          />
        </PropRow>

        <PropRow label="宽度">
          <NumberInput
            value={selectedWindow.width}
            onChange={handleWidthChange}
            min={CONSTRAINTS.MIN_WINDOW_WIDTH}
            max={CONSTRAINTS.MAX_WINDOW_WIDTH}
          />
        </PropRow>

        <PropRow label="高度">
          <NumberInput
            value={selectedWindow.height}
            onChange={handleHeightChange}
            min={CONSTRAINTS.MIN_WINDOW_HEIGHT}
            max={CONSTRAINTS.MAX_WINDOW_HEIGHT}
          />
        </PropRow>

        <PropRow label="位置 X">
          <NumberInput
            value={selectedWindow.posX}
            onChange={(v) => {
              pushHistory(getSnapshot());
              updateWindowPosition(selectedWindow.id, v, selectedWindow.posY);
            }}
          />
        </PropRow>

        <PropRow label="位置 Y">
          <NumberInput
            value={selectedWindow.posY}
            onChange={(v) => {
              pushHistory(getSnapshot());
              updateWindowPosition(selectedWindow.id, selectedWindow.posX, v);
            }}
          />
        </PropRow>
      </div>

      {/* 型材信息 */}
      <div className="p-4 border-b border-gray-700">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">型材信息</h4>
        <PropRow label="系列">
          <span className="text-sm text-gray-200">{series?.name || '-'}</span>
        </PropRow>
        <PropRow label="框宽">
          <span className="text-sm text-gray-200">{selectedWindow.frame.profileWidth}mm</span>
        </PropRow>
        <PropRow label="分格数">
          <span className="text-sm text-gray-200">
            {countOpenings(selectedWindow.frame.openings)}
          </span>
        </PropRow>
      </div>

      {/* 选中元素属性 */}
      {selectedElementId && selectedElementType && (
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase">
              选中: {selectedElementType === 'mullion' ? '中梃' : '扇'}
            </h4>
            <button
              className="p-1 rounded text-red-400 hover:bg-red-500/20 transition-colors"
              onClick={handleDeleteElement}
              title="删除元素"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <PropRow label="ID">
            <span className="text-xs text-gray-400 font-mono">{selectedElementId.slice(0, 8)}</span>
          </PropRow>
        </div>
      )}

      {/* 鼠标坐标 */}
      <div className="p-4 mt-auto">
        <PropRow label="鼠标">
          <span className="text-xs text-gray-400 font-mono">
            {Math.round(mouseWorldPos.x)}, {Math.round(mouseWorldPos.y)} mm
          </span>
        </PropRow>
      </div>
    </div>
  );
}
