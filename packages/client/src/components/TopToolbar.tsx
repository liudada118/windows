// WindoorDesigner - 顶部工具栏
// 提供撤销/重做、缩放控制、视图选项、导入/导出

import { useDesignStore } from '@/stores/designStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useHistoryStore } from '@/stores/historyStore';
import { storageAdapter } from '@/lib/storageAdapter';
import { toast } from 'sonner';
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3x3,
  Ruler,
  Download,
  Upload,
  Save,
} from 'lucide-react';

/** 工具栏按钮 */
function ToolbarButton({
  icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      className={`p-2 rounded transition-colors ${
        disabled
          ? 'text-gray-600 cursor-not-allowed'
          : active
          ? 'text-amber-400 bg-amber-500/20'
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
      }`}
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      {icon}
    </button>
  );
}

export default function TopToolbar() {
  const designData = useDesignStore((s) => s.designData);
  const getSnapshot = useDesignStore((s) => s.getSnapshot);
  const restoreSnapshot = useDesignStore((s) => s.restoreSnapshot);
  const loadDesign = useDesignStore((s) => s.loadDesign);

  const zoom = useCanvasStore((s) => s.zoom);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const resetView = useCanvasStore((s) => s.resetView);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const toggleSnapToGrid = useCanvasStore((s) => s.toggleSnapToGrid);
  const showDimensions = useCanvasStore((s) => s.showDimensions);
  const toggleDimensions = useCanvasStore((s) => s.toggleDimensions);

  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);

  const handleUndo = () => {
    const snapshot = undo(getSnapshot());
    if (snapshot) {
      restoreSnapshot(snapshot);
      toast.info('已撤销');
    }
  };

  const handleRedo = () => {
    const snapshot = redo(getSnapshot());
    if (snapshot) {
      restoreSnapshot(snapshot);
      toast.info('已重做');
    }
  };

  const handleSave = () => {
    storageAdapter.save(designData);
    toast.success('已保存到本地');
  };

  const handleExport = () => {
    storageAdapter.exportJSON(designData);
    toast.success('已导出 JSON 文件');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const data = await storageAdapter.importJSON(file);
        loadDesign(data);
        toast.success('已导入设计方案');
      } catch (err) {
        toast.error('导入失败: 无效的 JSON 文件');
      }
    };
    input.click();
  };

  return (
    <div className="h-12 bg-gray-900 border-b border-gray-700 flex items-center px-4 gap-1">
      {/* 左侧: 项目名称 */}
      <div className="flex items-center gap-3 mr-4">
        <span className="text-sm font-semibold text-gray-200">
          {designData.name || '画门窗设计器'}
        </span>
      </div>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-gray-700 mx-2" />

      {/* 撤销/重做 */}
      <ToolbarButton
        icon={<Undo2 size={16} />}
        label="撤销 (Ctrl+Z)"
        onClick={handleUndo}
        disabled={!canUndo()}
      />
      <ToolbarButton
        icon={<Redo2 size={16} />}
        label="重做 (Ctrl+Y)"
        onClick={handleRedo}
        disabled={!canRedo()}
      />

      <div className="w-px h-6 bg-gray-700 mx-2" />

      {/* 缩放控制 */}
      <ToolbarButton
        icon={<ZoomOut size={16} />}
        label="缩小"
        onClick={() => setZoom(zoom * 0.9)}
      />
      <span className="text-xs text-gray-400 w-12 text-center font-mono">
        {Math.round(zoom * 100)}%
      </span>
      <ToolbarButton
        icon={<ZoomIn size={16} />}
        label="放大"
        onClick={() => setZoom(zoom * 1.1)}
      />
      <ToolbarButton
        icon={<Maximize2 size={16} />}
        label="重置视图"
        onClick={resetView}
      />

      <div className="w-px h-6 bg-gray-700 mx-2" />

      {/* 视图选项 */}
      <ToolbarButton
        icon={<Grid3x3 size={16} />}
        label={`网格吸附 ${snapToGrid ? '开' : '关'}`}
        onClick={toggleSnapToGrid}
        active={snapToGrid}
      />
      <ToolbarButton
        icon={<Ruler size={16} />}
        label={`尺寸标注 ${showDimensions ? '开' : '关'}`}
        onClick={toggleDimensions}
        active={showDimensions}
      />

      {/* 右侧: 保存/导入/导出 */}
      <div className="flex-1" />

      <ToolbarButton
        icon={<Save size={16} />}
        label="保存 (Ctrl+S)"
        onClick={handleSave}
      />
      <ToolbarButton
        icon={<Upload size={16} />}
        label="导入 JSON"
        onClick={handleImport}
      />
      <ToolbarButton
        icon={<Download size={16} />}
        label="导出 JSON"
        onClick={handleExport}
      />
    </div>
  );
}
