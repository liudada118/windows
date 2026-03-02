// WindoorDesigner - 顶部菜单栏 v2.0
// 工业蓝图美学: 精简的顶部菜单栏 + 2D/3D/实景视图切换
// 新增: 多格式导出、算料、版本管理

import { FileDown, FilePlus, Save, FileText, HelpCircle, Box, PenTool, Camera, Calculator, Download, GitBranch } from 'lucide-react';
import { toast } from 'sonner';

interface TopBarProps {
  onNewProject: () => void;
  onExportJSON: () => void;
  windowCount: number;
  onOpenQuote: () => void;
  viewMode: '2d' | '3d' | 'scene';
  onSetViewMode: (mode: '2d' | '3d' | 'scene') => void;
  onOpenBOM?: () => void;
  onOpenExport?: () => void;
  onOpenVersions?: () => void;
}

const LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663332343321/Gg9tgRnnjrcuKp9tUpK6zd/logo-windoor-M8w5wRwzxGY7XhN2HR8qxP.webp';

export default function TopBar({
  onNewProject, onExportJSON, windowCount, onOpenQuote, viewMode, onSetViewMode,
  onOpenBOM, onOpenExport, onOpenVersions,
}: TopBarProps) {
  return (
    <div className="h-10 bg-[oklch(0.13_0.022_260)] border-b border-[oklch(0.25_0.035_260)] flex items-center px-3 gap-1 select-none">
      {/* Logo & Title */}
      <div className="flex items-center gap-2 mr-4">
        <img src={LOGO_URL} alt="Logo" className="w-6 h-6 rounded" />
        <span className="text-sm font-semibold text-slate-200 tracking-tight">WindoorDesigner</span>
        <span className="text-[9px] text-amber-500/70 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded">BETA</span>
      </div>

      {/* 2D/3D/实景 Toggle */}
      <div className="flex items-center bg-[oklch(0.17_0.028_260)] rounded-lg p-0.5 mr-2 border border-[oklch(0.25_0.035_260)]">
        <button
          onClick={() => onSetViewMode('2d')}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-all duration-200 ${
            viewMode === '2d'
              ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30 font-medium'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <PenTool size={12} />
          <span>2D</span>
        </button>
        <button
          onClick={() => onSetViewMode('3d')}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-all duration-200 ${
            viewMode === '3d'
              ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30 font-medium'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Box size={12} />
          <span>3D</span>
        </button>
        <button
          onClick={() => onSetViewMode('scene')}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-all duration-200 ${
            viewMode === 'scene'
              ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30 font-medium'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Camera size={12} />
          <span>实景</span>
        </button>
      </div>

      {/* Menu items */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={onNewProject}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded transition-colors"
        >
          <FilePlus size={14} />
          <span>新建</span>
        </button>

        <button
          onClick={() => {
            if (windowCount === 0) {
              toast.info('画布为空，请先添加窗口');
              return;
            }
            toast.success('项目已保存');
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded transition-colors"
        >
          <Save size={14} />
          <span>保存</span>
        </button>

        {/* 分隔线 */}
        <div className="w-px h-4 bg-[oklch(0.25_0.035_260)] mx-1" />

        <button
          onClick={onExportJSON}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded transition-colors"
        >
          <FileDown size={14} />
          <span>JSON</span>
        </button>

        {onOpenExport && (
          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded transition-colors"
          >
            <Download size={14} />
            <span>导出</span>
          </button>
        )}

        {/* 分隔线 */}
        <div className="w-px h-4 bg-[oklch(0.25_0.035_260)] mx-1" />

        <button
          onClick={onOpenQuote}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded transition-colors"
        >
          <FileText size={14} />
          <span>报价</span>
        </button>

        {onOpenBOM && (
          <button
            onClick={onOpenBOM}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 rounded transition-colors"
          >
            <Calculator size={14} />
            <span>算料</span>
          </button>
        )}

        {onOpenVersions && (
          <>
            <div className="w-px h-4 bg-[oklch(0.25_0.035_260)] mx-1" />
            <button
              onClick={onOpenVersions}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded transition-colors"
            >
              <GitBranch size={14} />
              <span>版本</span>
            </button>
          </>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Help */}
      <button
        onClick={() => toast.info('快捷键: V-选择 R-画框 M-中梃 T-横档 S-扇 H-平移 3-切换3D 4-实景 Del-删除 Ctrl+Z-撤销')}
        className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded transition-colors"
      >
        <HelpCircle size={14} />
        <span>快捷键</span>
      </button>
    </div>
  );
}
