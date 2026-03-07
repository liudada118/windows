// WindoorDesigner - 主编辑器页面 v2.0 (Konva + Zustand)
// 工业蓝图美学: 三栏式布局 - 左工具栏 + 中画布 + 右属性面板
// 移动端适配: 底部工具栏 + 触摸手势 + 抽屉面板
// 3D预览: Three.js集成，支持2D/3D/实景一键切换
// 基于 Konva.js 渲染引擎 + Zustand 状态管理

import { useState, useCallback, useRef, useEffect, lazy, Suspense, useMemo } from 'react';
import { useDesignStore } from '@/stores/designStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useHistoryStore } from '@/stores/historyStore';
import KonvaCanvas from '@/components/canvas/KonvaCanvas';
import Toolbar from '@/components/Toolbar';
import PropertiesPanel from '@/components/PropertiesPanel';
import StatusBar from '@/components/StatusBar';
import TopBar from '@/components/TopBar';
import MobileToolbar from '@/components/MobileToolbar';
import MobilePropertiesDrawer from '@/components/MobilePropertiesDrawer';
import {
  WINDOW_TEMPLATES,
  deleteMullionFromOpening,
  deleteSashFromOpening,
  createCustomSplitWindow,
} from '@/lib/window-factory';
import { COMPOSITE_TEMPLATES, createLShapeWindow, createUShapeWindow, createBayWindow } from '@/lib/composite-factory';
import type { SplitConfig } from '@/components/CustomSplitDialog';
import type { WindowUnit } from '@/lib/types';
import { toast } from 'sonner';
import QuoteDialog from '@/components/QuoteDialog';
import { useIsTouch, useScreenSize } from '@/hooks/useIsMobile';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAutoSave } from '@/hooks/useAutoSave';
import { Menu, Box, PenTool, Loader2, Camera, Calculator, Download, GitBranch, HelpCircle, Move3d } from 'lucide-react';
import { storageAdapter } from '@/lib/storageAdapter';
import BOMPanel from '@/components/BOMPanel';
import DrawingSettingsPanel from '@/components/DrawingSettingsPanel';
import ExportDialog from '@/components/ExportDialog';
import VersionManager from '@/components/VersionManager';
import SketchPad from '@/components/SketchPad';
import type { SketchRecognitionResult } from '@/components/SketchPad';
import Konva from 'konva';
import { useLocation } from 'wouter';

const ThreePreview = lazy(() => import('@/components/ThreePreview'));
const ScenePreview = lazy(() => import('@/components/ScenePreview'));
const SceneFusion3D = lazy(() => import('@/components/SceneFusion3D'));

const MM_TO_PX = 0.5;

export default function EditorPage() {
  // ===== Zustand Stores =====
  const windows = useDesignStore((s) => s.designData.windows);
  const selectedWindowId = useDesignStore((s) => s.selectedWindowId);
  const selectedElementId = useDesignStore((s) => s.selectedElementId);
  const selectedElementType = useDesignStore((s) => s.selectedElementType);
  const activeSashType = useDesignStore((s) => s.activeSashType);
  const activeProfileSeries = useDesignStore((s) => s.activeProfileSeries);
  const selectWindow = useDesignStore((s) => s.selectWindow);
  const selectElement = useDesignStore((s) => s.selectElement);
  const addWindowUnit = useDesignStore((s) => s.addWindowUnit);
  const deleteWindow = useDesignStore((s) => s.deleteWindow);
  const updateWindow = useDesignStore((s) => s.updateWindow);
  const setActiveSashType = useDesignStore((s) => s.setActiveSashType);
  const setActiveProfileSeries = useDesignStore((s) => s.setActiveProfileSeries);
  const getSnapshot = useDesignStore((s) => s.getSnapshot);
  const restoreSnapshot = useDesignStore((s) => s.restoreSnapshot);
  const loadDesign = useDesignStore((s) => s.loadDesign);
  const addCompositeWindow = useDesignStore((s) => s.addCompositeWindow);
  const deleteCompositeWindow = useDesignStore((s) => s.deleteCompositeWindow);
  const selectedCompositeWindowId = useDesignStore((s) => s.selectedCompositeWindowId);
  const compositeWindows = useDesignStore((s) => s.designData.compositeWindows);

  const activeTool = useCanvasStore((s) => s.activeTool);
  const zoom = useCanvasStore((s) => s.zoom);
  const panX = useCanvasStore((s) => s.panX);
  const panY = useCanvasStore((s) => s.panY);
  const showDimensions = useCanvasStore((s) => s.showDimensions);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const mouseWorldPos = useCanvasStore((s) => s.mouseWorldPos);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const setPan = useCanvasStore((s) => s.setPan);
  const toggleDimensions = useCanvasStore((s) => s.toggleDimensions);
  const toggleSnapToGrid = useCanvasStore((s) => s.toggleSnapToGrid);

  const pushHistory = useHistoryStore((s) => s.pushHistory);
  const undoAction = useHistoryStore((s) => s.undo);
  const redoAction = useHistoryStore((s) => s.redo);
  const canUndoFn = useHistoryStore((s) => s.canUndo);
  const canRedoFn = useHistoryStore((s) => s.canRedo);

  // ===== Local State =====
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'2d' | '3d' | 'scene' | 'scene3d'>('2d');
  const [bomOpen, setBomOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [drawingSettingsOpen, setDrawingSettingsOpen] = useState(false);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [, navigate] = useLocation();

  // Responsive
  const isTouch = useIsTouch();
  const screenSize = useScreenSize();
  const isMobileLayout = screenSize === 'mobile' || screenSize === 'tablet';

  // Derived state
  const canUndo = canUndoFn();
  const canRedo = canRedoFn();
  const selectedWindow = windows.find((w) => w.id === selectedWindowId) || null;
  const selectedCompositeWindow = compositeWindows?.find(cw => cw.id === selectedCompositeWindowId) || null;

  // ===== Auto-save & Keyboard shortcuts =====
  useAutoSave();
  useKeyboardShortcuts();

  // ===== Resize observer =====
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ===== Undo / Redo wrappers =====
  const undo = useCallback(() => {
    const snapshot = undoAction(getSnapshot());
    if (snapshot) restoreSnapshot(snapshot);
  }, [undoAction, getSnapshot, restoreSnapshot]);

  const redo = useCallback(() => {
    const snapshot = redoAction(getSnapshot());
    if (snapshot) restoreSnapshot(snapshot);
  }, [redoAction, getSnapshot, restoreSnapshot]);

  // ===== View mode switching =====
  const handleSetViewMode = useCallback((mode: '2d' | '3d' | 'scene' | 'scene3d') => {
    if ((mode === '3d' || mode === 'scene') && windows.length === 0) {
      toast.info('请先在2D编辑器中创建窗口');
      return;
    }
    const labels = { '2d': '2D 编辑模式', '3d': '3D 预览模式', 'scene': '实景融合模式', 'scene3d': '3D 实景融合' };
    toast.info(`已切换到 ${labels[mode]}`);
    setViewMode(mode);
  }, [windows.length]);

  // ===== SUG-006: 删除确认 + Delete selected element =====
  const handleDeleteSelected = useCallback(() => {
    if (selectedElementId && selectedWindowId) {
      const win = windows.find((w) => w.id === selectedWindowId);
      if (!win) return;

      if (selectedElementType === 'mullion') {
        if (!confirm('确定要删除此中梃吗？子分格将被合并。')) return;
        pushHistory(getSnapshot());
        const newFrame = JSON.parse(JSON.stringify(win.frame));
        newFrame.openings = deleteMullionFromOpening(newFrame.openings, selectedElementId);
        updateWindow(win.id, { frame: newFrame });
        selectElement(null, null);
        toast.success('已删除中梃（子分格已合并）');
        return;
      }

      if (selectedElementType === 'sash') {
        pushHistory(getSnapshot());
        const newFrame = JSON.parse(JSON.stringify(win.frame));
        newFrame.openings = deleteSashFromOpening(newFrame.openings, selectedElementId);
        updateWindow(win.id, { frame: newFrame });
        selectElement(null, null);
        toast.success('已删除扇');
        return;
      }
    }

    if (selectedWindowId) {
      if (!confirm('确定要删除此窗户吗？')) return;
      pushHistory(getSnapshot());
      deleteWindow(selectedWindowId);
      toast.info('已删除窗口');
    }
  }, [selectedElementId, selectedWindowId, selectedElementType, windows, pushHistory, getSnapshot, updateWindow, selectElement, deleteWindow]);

  // ===== BUG-005: 智能放置 - 避免窗户重叠 =====
  const findNonOverlappingPosition = useCallback((w: number, h: number): { x: number; y: number } => {
    const centerWorldX = (canvasSize.width / 2 - panX) / (MM_TO_PX * zoom);
    const centerWorldY = (canvasSize.height / 2 - panY) / (MM_TO_PX * zoom);
    const gridMM = 10;
    let posX = snapToGrid ? Math.round((centerWorldX - w / 2) / gridMM) * gridMM : centerWorldX - w / 2;
    let posY = snapToGrid ? Math.round((centerWorldY - h / 2) / gridMM) * gridMM : centerWorldY - h / 2;

    // 检查是否与现有窗户重叠，如果重叠则偏移
    const MARGIN = 50; // mm 间距
    let attempts = 0;
    while (attempts < 20) {
      const overlaps = windows.some((win) => {
        return (
          posX < win.posX + win.width + MARGIN &&
          posX + w + MARGIN > win.posX &&
          posY < win.posY + win.height + MARGIN &&
          posY + h + MARGIN > win.posY
        );
      });
      if (!overlaps) break;
      // 向右下偏移
      posX += w + MARGIN;
      if (posX > centerWorldX + 3000) {
        posX = centerWorldX - w / 2;
        posY += h + MARGIN;
      }
      attempts++;
    }
    return { x: posX, y: posY };
  }, [windows, canvasSize, panX, panY, zoom, snapToGrid]);

  // ===== Add template =====
  const handleAddTemplate = useCallback((templateId: string) => {
    const template = WINDOW_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    const pos = findNonOverlappingPosition(template.width, template.height);

    pushHistory(getSnapshot());
    const newWin = template.create(template.id, pos.x, pos.y, activeProfileSeries);
    addWindowUnit(newWin);
    toast.success(`已添加 ${template.name}`);
  }, [activeProfileSeries, findNonOverlappingPosition, pushHistory, getSnapshot, addWindowUnit]);

  // ===== Add custom split window =====
  const handleAddCustomSplit = useCallback((config: SplitConfig) => {
    const pos = findNonOverlappingPosition(config.totalWidth, config.totalHeight);
    pushHistory(getSnapshot());
    const newWin = createCustomSplitWindow(
      config.totalWidth,
      config.totalHeight,
      config.direction,
      config.panelSizes,
      pos.x,
      pos.y,
      activeProfileSeries
    );
    addWindowUnit(newWin);
    toast.success(`已添加 ${config.panelCount}等分窗`);
  }, [activeProfileSeries, findNonOverlappingPosition, pushHistory, getSnapshot, addWindowUnit]);

  // ===== Add composite window =====
  const handleAddComposite = useCallback((templateId: string) => {
    const template = COMPOSITE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    const pos = findNonOverlappingPosition(2000, 1500);
    pushHistory(getSnapshot());
    const newCW = template.create(pos.x, pos.y, activeProfileSeries);
    addCompositeWindow(newCW);
    toast.success(`已添加 ${template.name}`);
  }, [activeProfileSeries, findNonOverlappingPosition, pushHistory, getSnapshot, addCompositeWindow]);

  // ===== Delete composite window =====
  const handleDeleteCompositeWindow = useCallback(() => {
    if (!selectedCompositeWindowId) return;
    pushHistory(getSnapshot());
    deleteCompositeWindow(selectedCompositeWindowId);
    toast.info('已删除组合窗');
  }, [selectedCompositeWindowId, pushHistory, getSnapshot, deleteCompositeWindow]);

  // ===== Sketch Recognition: 手绘草图识别生成窗户 =====
  const handleSketchGenerate = useCallback((result: SketchRecognitionResult) => {
    console.log('[SketchGenerate] called with result:', JSON.stringify(result));
    try {  pushHistory(getSnapshot());

    // 组合窗识别结果（转角窗/凸窗）
    if (result.compositeType) {
      const pos = findNonOverlappingPosition(2000, 1500);
      let newCW;
      switch (result.compositeType) {
        case 'l-shape': {
          const panels = result.compositePanels || [];
          const frontW = panels[0]?.width || 1500;
          const sideW = panels[1]?.width || 1000;
          const h = panels[0]?.height || 1500;
          newCW = createLShapeWindow(pos.x, pos.y, activeProfileSeries, frontW, sideW, h);
          break;
        }
        case 'u-shape': {
          const panels = result.compositePanels || [];
          const frontW = panels[1]?.width || 1800;
          const sideW = panels[0]?.width || 800;
          const h = panels[0]?.height || 1500;
          newCW = createUShapeWindow(pos.x, pos.y, activeProfileSeries, frontW, sideW, h);
          break;
        }
        case 'bay-window': {
          const panels = result.compositePanels || [];
          const frontW = panels[1]?.width || 1600;
          const sideW = panels[0]?.width || 600;
          const h = panels[0]?.height || 1500;
          newCW = createBayWindow(pos.x, pos.y, activeProfileSeries, frontW, sideW, h);
          break;
        }
        default: {
          newCW = createUShapeWindow(pos.x, pos.y, activeProfileSeries);
          break;
        }
      }
      addCompositeWindow(newCW);
      toast.success(`手绘识别成功：已生成 ${result.name}`);
    } else if (result.splitConfig) {
      // 普通等分窗
      const config = result.splitConfig;
      const pos = findNonOverlappingPosition(config.totalWidth, config.totalHeight);
      const newWin = createCustomSplitWindow(
        config.totalWidth,
        config.totalHeight,
        config.direction,
        config.panelSizes,
        pos.x,
        pos.y,
        activeProfileSeries
      );
      newWin.name = result.name || newWin.name;
      addWindowUnit(newWin);
      toast.success(`手绘识别成功：已生成 ${result.name || '窗户'}`);
    } else {
      // 简单窗户 - 使用 createCustomSplitWindow 创建指定尺寸的单格窗
      const pos = findNonOverlappingPosition(result.width, result.height);
      const newWin = createCustomSplitWindow(
        result.width,
        result.height,
        'vertical',
        [result.width],
        pos.x,
        pos.y,
        activeProfileSeries
      );
      newWin.name = result.name || '固定窗';
      addWindowUnit(newWin);
      toast.success(`手绘识别成功：已生成 ${result.name || '固定窗'}`);
    }
    console.log('[SketchGenerate] completed successfully');
    } catch (err: any) {
      console.error('[SketchGenerate] ERROR:', err?.message, err?.stack);
      toast.error('生成失败: ' + (err?.message || '未知错误'));
    }
    setSketchOpen(false);
  }, [activeProfileSeries, findNonOverlappingPosition, pushHistory, getSnapshot, addWindowUnit, addCompositeWindow]);

  // ===== Update window with history =====
  const handleUpdateWindowWithHistory = useCallback((id: string, updates: Partial<WindowUnit>) => {
    pushHistory(getSnapshot());
    updateWindow(id, updates);
  }, [pushHistory, getSnapshot, updateWindow]);

  // ===== BUG-008: 新建项目 - 清空 store 而非 reload =====
  const handleNewProject = useCallback(() => {
    if (windows.length > 0) {
      if (!confirm('确定要新建项目吗？当前设计将被清除。')) return;
    }
    // 清空所有 store 状态
    storageAdapter.clear();
    loadDesign({ id: '', name: '新设计方案', windows: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    useCanvasStore.getState().resetView();
    useHistoryStore.getState().clear();
    toast.success('已新建项目');
  }, [windows, loadDesign]);

  // ===== Export JSON =====
  const handleExportJSON = useCallback(() => {
    if (windows.length === 0) {
      toast.error('画布为空，无法导出');
      return;
    }
    const data = JSON.stringify(windows, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'windoor-design.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('已导出设计文件');
  }, [windows]);

  // ===== Version restore =====
  const handleVersionRestore = useCallback((restoredWindows: WindowUnit[]) => {
    pushHistory(getSnapshot());
    loadDesign({ windows: restoredWindows });
    toast.success('已恢复版本');
  }, [pushHistory, getSnapshot, loadDesign]);

  // ===== View mode & delete keyboard shortcuts (supplementary to useKeyboardShortcuts) =====
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey) return; // Ctrl shortcuts handled by useKeyboardShortcuts

      switch (e.key) {
        case '3': handleSetViewMode(viewMode === '3d' ? '2d' : '3d'); break;
        case '4': handleSetViewMode(viewMode === 'scene' ? '2d' : 'scene'); break;
        case '5': handleSetViewMode(viewMode === 'scene3d' ? '2d' : 'scene3d'); break;
        case '?': setShortcutsOpen(true); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSetViewMode, viewMode]);

  return (
    <div className="h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Bar - responsive */}
      {isMobileLayout ? (
        <div className="h-11 bg-[oklch(0.13_0.022_260)] border-b border-[oklch(0.25_0.035_260)] flex items-center px-3 gap-2 select-none shrink-0">
          <span className="text-sm font-semibold text-slate-200 tracking-tight">WindoorDesigner</span>
          <span className="text-[9px] text-amber-500/70 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded">BETA</span>

          <div className="flex items-center bg-[oklch(0.17_0.028_260)] rounded-lg p-0.5 border border-[oklch(0.25_0.035_260)]">
            <button
              onClick={() => handleSetViewMode('2d')}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md transition-all ${
                viewMode === '2d'
                  ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30 font-medium'
                  : 'text-slate-500'
              }`}
            >
              <PenTool size={10} />
              2D
            </button>
            <button
              onClick={() => handleSetViewMode('3d')}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md transition-all ${
                viewMode === '3d'
                  ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30 font-medium'
                  : 'text-slate-500'
              }`}
            >
              <Box size={10} />
              3D
            </button>
            <button
              onClick={() => handleSetViewMode('scene')}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md transition-all ${
                viewMode === 'scene'
                  ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30 font-medium'
                  : 'text-slate-500'
              }`}
            >
              <Camera size={10} />
              实景
            </button>
            <button
              onClick={() => handleSetViewMode('scene3d')}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md transition-all ${
                viewMode === 'scene3d'
                  ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30 font-medium'
                  : 'text-slate-500'
              }`}
            >
              <Move3d size={10} />
              3D实景
            </button>
          </div>

          <div className="flex-1" />
          <button
            onClick={() => navigate('/photo')}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-violet-400 active:bg-violet-500/10"
            title="拍照识别"
          >
            <Camera size={18} />
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 active:bg-white/10"
          >
            <Menu size={20} />
          </button>
        </div>
      ) : (
        <TopBar
          onNewProject={handleNewProject}
          onExportJSON={handleExportJSON}
          windowCount={windows.length}
          onOpenQuote={() => setQuoteOpen(true)}
          viewMode={viewMode}
          onSetViewMode={handleSetViewMode}
          onOpenBOM={() => setBomOpen(true)}
          onOpenExport={() => setExportOpen(true)}
          onOpenVersions={() => setVersionOpen(true)}
          onOpenSketch={() => setSketchOpen(true)}
          onOpenShowcase={() => navigate('/showcase')}
          onOpenPhoto={() => navigate('/photo')}
          onOpenDrawingSettings={() => setDrawingSettingsOpen(true)}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar - desktop only, hidden in 3D mode */}
        {!isMobileLayout && viewMode === '2d' && (
          <Toolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            showDimensions={showDimensions}
            onToggleDimensions={toggleDimensions}
            snapToGrid={snapToGrid}
            onToggleSnap={toggleSnapToGrid}
            onDeleteSelected={handleDeleteSelected}
          />
        )}

        {/* Canvas / 3D Preview Area */}
        {viewMode === '2d' ? (
          <div
            ref={canvasContainerRef}
            className="flex-1 overflow-hidden relative touch-none"
          >
            <KonvaCanvas
              width={canvasSize.width}
              height={canvasSize.height}
            />

            {/* Empty state hint */}
            {windows.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center px-6">
                  <div className="text-4xl mb-3 opacity-20">🪟</div>
                  {isMobileLayout ? (
                    <>
                      <p className="text-sm text-slate-500">选择底部「画框」工具后在画布上拖拽绘制</p>
                      <p className="text-xs text-slate-600 mt-1">或点击右上角菜单选择预设窗型</p>
                      <p className="text-xs text-slate-600 mt-1">双指可缩放和平移画布</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-slate-500">按 <kbd className="px-1.5 py-0.5 bg-slate-700/50 rounded text-amber-400 text-xs font-mono">R</kbd> 在画布上拖拽绘制窗框</p>
                      <p className="text-xs text-slate-600 mt-1">或从右侧面板选择预设窗型</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Mobile: floating zoom controls */}
            {isMobileLayout && (
              <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
                <button
                  onClick={() => setZoom(zoom * 1.3)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-[oklch(0.17_0.028_260)]/90 backdrop-blur border border-[oklch(0.30_0.04_260)] text-slate-300 active:bg-amber-500/20"
                >
                  <span className="text-lg font-bold">+</span>
                </button>
                <button
                  onClick={() => { setZoom(1); setPan(0, 0); }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-[oklch(0.17_0.028_260)]/90 backdrop-blur border border-[oklch(0.30_0.04_260)] text-slate-400 active:bg-amber-500/20"
                >
                  <span className="text-[10px] font-mono">{Math.round(zoom * 100)}%</span>
                </button>
                <button
                  onClick={() => setZoom(zoom / 1.3)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-[oklch(0.17_0.028_260)]/90 backdrop-blur border border-[oklch(0.30_0.04_260)] text-slate-300 active:bg-amber-500/20"
                >
                  <span className="text-lg font-bold">-</span>
                </button>
              </div>
            )}
          </div>
        ) : viewMode === '3d' ? (
          /* 3D Preview Mode */
          <div className="flex-1 overflow-hidden relative">
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center bg-[oklch(0.10_0.02_260)]">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                    <span className="text-sm text-slate-400">加载 3D 引擎...</span>
                  </div>
                </div>
              }
            >
              <ThreePreview
                windows={windows}
                selectedWindowId={selectedWindowId}
              />
            </Suspense>
          </div>
        ) : viewMode === 'scene' ? (
          /* Scene Preview Mode - 实景融合 */
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center bg-[oklch(0.10_0.02_260)]">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                    <span className="text-sm text-slate-400">加载实景引擎...</span>
                  </div>
                </div>
              }
            >
              <ScenePreview
                windows={windows}
                selectedWindowId={selectedWindowId}
              />
            </Suspense>
          </div>
        ) : (
          /* 3D Scene Fusion Mode - 3D实景融合 */
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center bg-[oklch(0.10_0.02_260)]">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                    <span className="text-sm text-slate-400">加载 3D 实景引擎...</span>
                  </div>
                </div>
              }
            >
              <SceneFusion3D
                windows={windows}
                selectedWindowId={selectedWindowId}
              />
            </Suspense>
          </div>
        )}

        {/* Right Properties Panel - desktop only, hidden in scene mode */}
        {!isMobileLayout && viewMode !== 'scene' && viewMode !== 'scene3d' && (
          <PropertiesPanel
            selectedWindow={selectedWindow}
            activeProfileSeries={activeProfileSeries}
            activeSashType={activeSashType}
            selectedElementId={selectedElementId}
            selectedElementType={selectedElementType}
            onUpdateWindow={handleUpdateWindowWithHistory}
            onProfileSeriesChange={setActiveProfileSeries}
            onSashTypeChange={setActiveSashType}
            onAddTemplate={handleAddTemplate}
            onAddCustomSplit={handleAddCustomSplit}
            onAddComposite={handleAddComposite}
            selectedCompositeWindow={selectedCompositeWindow}
            onDeleteCompositeWindow={handleDeleteCompositeWindow}
          />
        )}
      </div>

      {/* Bottom: Status Bar (desktop) or Mobile Toolbar */}
      {isMobileLayout ? (
        viewMode === '2d' ? (
          <MobileToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            showDimensions={showDimensions}
            onToggleDimensions={toggleDimensions}
            snapToGrid={snapToGrid}
            onToggleSnap={toggleSnapToGrid}
            onDeleteSelected={handleDeleteSelected}
            onZoomIn={() => setZoom(zoom * 1.2)}
            onZoomOut={() => setZoom(zoom / 1.2)}
            onZoomReset={() => { setZoom(1); setPan(0, 0); }}
            zoom={zoom}
            hasSelection={!!selectedWindowId}
          />
        ) : null
      ) : (
        <StatusBar
          mouseX={viewMode === '2d' ? mouseWorldPos.x : 0}
          mouseY={viewMode === '2d' ? mouseWorldPos.y : 0}
          zoom={zoom}
          activeTool={viewMode === '2d' ? activeTool : 'select'}
          windowCount={windows.length}
          onZoomIn={() => setZoom(zoom * 1.2)}
          onZoomOut={() => setZoom(zoom / 1.2)}
          onZoomReset={() => { setZoom(1); setPan(0, 0); }}
          viewMode={viewMode}
        />
      )}

      {/* Mobile Properties Drawer */}
      {isMobileLayout && (
        <MobilePropertiesDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          selectedWindow={selectedWindow}
          activeProfileSeries={activeProfileSeries}
          activeSashType={activeSashType}
          onUpdateWindow={handleUpdateWindowWithHistory}
          onProfileSeriesChange={setActiveProfileSeries}
          onSashTypeChange={setActiveSashType}
          onAddTemplate={handleAddTemplate}
          onAddCustomSplit={handleAddCustomSplit}
        />
      )}

      {/* Quote Dialog */}
      <QuoteDialog
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        windows={windows}
      />

      {/* BOM Panel */}
      {bomOpen && (
        <BOMPanel windows={windows} onClose={() => setBomOpen(false)} />
      )}

      {/* Export Dialog */}
      {exportOpen && (
        <ExportDialog
          windows={windows}
          stageRef={stageRef}
          onClose={() => setExportOpen(false)}
        />
      )}

      {/* Version Manager */}
      {versionOpen && (
        <VersionManager
          currentWindows={windows}
          onRestore={handleVersionRestore}
          onClose={() => setVersionOpen(false)}
        />
      )}

      {/* 画图设置 */}
      <DrawingSettingsPanel
        open={drawingSettingsOpen}
        onClose={() => setDrawingSettingsOpen(false)}
      />

      {/* 手绘草图识别 */}
      {sketchOpen && (
        <SketchPad
          onGenerate={handleSketchGenerate}
          onClose={() => setSketchOpen(false)}
        />
      )}

      {/* SUG-008: 快捷键帮助面板 */}
      {shortcutsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShortcutsOpen(false)}>
          <div className="bg-[oklch(0.17_0.028_260)] border border-[oklch(0.30_0.04_260)] rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[oklch(0.25_0.035_260)]">
              <h3 className="text-sm font-semibold text-slate-200">快捷键参考</h3>
              <button onClick={() => setShortcutsOpen(false)} className="text-slate-500 hover:text-slate-300 text-lg">&times;</button>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {[
                { group: '工具切换', items: [
                  ['V', '选择工具'],
                  ['R', '绘制外框'],
                  ['M', '添加中梃'],
                  ['S', '添加扇'],
                  ['H', '平移工具'],
                ]},
                { group: '编辑操作', items: [
                  ['Ctrl+Z', '撤销'],
                  ['Ctrl+Y / Ctrl+Shift+Z', '重做'],
                  ['Delete / Backspace', '删除选中'],
                  ['Escape', '取消选择'],
                ]},
                { group: '视图控制', items: [
                  ['滚轮', '缩放（以鼠标为中心）'],
                  ['中键拖拽', '平移画布'],
                  ['3', '切换 2D/3D 视图'],
                  ['4', '切换 2D/实景 视图'],
                  ['G', '切换网格吸附'],
                  ['D', '切换尺寸标注'],
                ]},
                { group: '其他', items: [
                  ['?', '显示此帮助面板'],
                ]},
              ].map((section) => (
                <div key={section.group}>
                  <h4 className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">{section.group}</h4>
                  <div className="space-y-1">
                    {section.items.map(([key, desc]) => (
                      <div key={key} className="flex items-center justify-between py-1">
                        <span className="text-xs text-slate-400">{desc}</span>
                        <kbd className="px-2 py-0.5 bg-[oklch(0.22_0.03_260)] border border-[oklch(0.30_0.04_260)] rounded text-[10px] text-amber-400 font-mono min-w-[2rem] text-center">{key}</kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 快捷键帮助按钮 - 右下角浮动 */}
      {!isMobileLayout && viewMode === '2d' && (
        <button
          onClick={() => setShortcutsOpen(true)}
          className="fixed bottom-12 right-4 z-30 w-8 h-8 flex items-center justify-center rounded-full bg-[oklch(0.20_0.035_260)]/80 backdrop-blur border border-[oklch(0.30_0.04_260)] text-slate-500 hover:text-amber-400 hover:border-amber-500/30 transition-all"
          title="快捷键帮助 (?)"
        >
          <HelpCircle size={14} />
        </button>
      )}
    </div>
  );
}
