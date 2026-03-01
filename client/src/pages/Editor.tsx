// WindoorDesigner - 主编辑器页面
// 工业蓝图美学: 三栏式布局 - 左工具栏 + 中画布 + 右属性面板

import { useState, useCallback, useRef, useEffect } from 'react';
import { useEditorStore } from '@/hooks/useEditorStore';
import CanvasRenderer from '@/components/CanvasRenderer';
import Toolbar from '@/components/Toolbar';
import PropertiesPanel from '@/components/PropertiesPanel';
import StatusBar from '@/components/StatusBar';
import TopBar from '@/components/TopBar';
import { WINDOW_TEMPLATES, createWindowUnit, splitOpening, findOpeningAtPoint, findMullionAtPoint, createSash } from '@/lib/window-factory';
import type { ToolType, WindowUnit, Opening } from '@/lib/types';
import { toast } from 'sonner';
import QuoteDialog from '@/components/QuoteDialog';

const MM_TO_PX = 0.5;

export default function Editor() {
  const {
    state,
    selectedWindow,
    canUndo,
    canRedo,
    undo,
    redo,
    setTool,
    setZoom,
    setPan,
    addWindow,
    updateWindow,
    updateWindowWithHistory,
    removeWindow,
    selectWindow,
    selectElement,
    setSashType,
    setProfileSeries,
    toggleDimensions,
    toggleSnapToGrid,
    pushHistory,
  } = useEditorStore();

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [quoteOpen, setQuoteOpen] = useState(false);

  // Resize observer for canvas container
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

  // Screen to world coordinates
  const screenToWorld = useCallback((sx: number, sy: number) => {
    return {
      x: (sx - state.panX) / (MM_TO_PX * state.zoom),
      y: (sy - state.panY) / (MM_TO_PX * state.zoom),
    };
  }, [state.panX, state.panY, state.zoom]);

  // Snap to grid
  const snapValue = useCallback((val: number) => {
    if (!state.snapToGrid) return val;
    const gridMM = state.gridSize;
    return Math.round(val / gridMM) * gridMM;
  }, [state.snapToGrid, state.gridSize]);

  // Find window at screen position
  const findWindowAtScreen = useCallback((sx: number, sy: number): WindowUnit | null => {
    const world = screenToWorld(sx, sy);
    for (let i = state.windows.length - 1; i >= 0; i--) {
      const win = state.windows[i];
      if (
        world.x >= win.posX &&
        world.x <= win.posX + win.width &&
        world.y >= win.posY &&
        world.y <= win.posY + win.height
      ) {
        return win;
      }
    }
    return null;
  }, [state.windows, screenToWorld]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = screenToWorld(sx, sy);

    // Middle mouse button or space+click for panning
    if (e.button === 1 || state.activeTool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - state.panX, y: e.clientY - state.panY });
      return;
    }

    if (e.button !== 0) return;

    switch (state.activeTool) {
      case 'select': {
        const win = findWindowAtScreen(sx, sy);
        if (win) {
          selectWindow(win.id);
          setIsDraggingWindow(true);
          setDragOffset({
            x: world.x - win.posX,
            y: world.y - win.posY,
          });
        } else {
          selectWindow(null);
        }
        break;
      }
      case 'draw-frame': {
        setIsDrawing(true);
        setDrawStart({ x: snapValue(world.x), y: snapValue(world.y) });
        break;
      }
      case 'add-mullion-v':
      case 'add-mullion-h': {
        // Find which window and opening was clicked
        const win = findWindowAtScreen(sx, sy);
        if (!win) {
          toast.error('请先点击一个窗口内部');
          return;
        }
        const localX = world.x - win.posX;
        const localY = world.y - win.posY;
        const opening = findOpeningAtPoint(win.frame.openings, localX, localY);
        if (!opening) {
          toast.error('请点击窗口内的空白分格区域');
          return;
        }
        if (opening.isSplit) return;

        pushHistory();
        const type = state.activeTool === 'add-mullion-v' ? 'vertical' : 'horizontal';
        const position = type === 'vertical'
          ? snapValue(localX)
          : snapValue(localY);

        const mullionWidth = state.activeProfileSeries.mullionWidth;

        // Deep clone and update
        const newFrame = JSON.parse(JSON.stringify(win.frame));
        const updateOpeningInTree = (openings: Opening[]): Opening[] => {
          return openings.map(o => {
            if (o.id === opening.id) {
              return splitOpening(o, type, position, mullionWidth);
            }
            if (o.childOpenings.length > 0) {
              return { ...o, childOpenings: updateOpeningInTree(o.childOpenings) };
            }
            return o;
          });
        };
        newFrame.openings = updateOpeningInTree(newFrame.openings);
        updateWindow(win.id, { frame: newFrame });
        toast.success(type === 'vertical' ? '已添加中梃' : '已添加横档');
        break;
      }
      case 'add-sash': {
        const win = findWindowAtScreen(sx, sy);
        if (!win) {
          toast.error('请先点击一个窗口内部');
          return;
        }
        const localX = world.x - win.posX;
        const localY = world.y - win.posY;
        const opening = findOpeningAtPoint(win.frame.openings, localX, localY);
        if (!opening) return;
        if (opening.isSplit) {
          toast.error('请点击未分割的分格区域');
          return;
        }

        pushHistory();
        const newFrame = JSON.parse(JSON.stringify(win.frame));
        const addSashToTree = (openings: Opening[]): Opening[] => {
          return openings.map(o => {
            if (o.id === opening.id) {
              return { ...o, sash: createSash(state.activeSashType, o.rect) };
            }
            if (o.childOpenings.length > 0) {
              return { ...o, childOpenings: addSashToTree(o.childOpenings) };
            }
            return o;
          });
        };
        newFrame.openings = addSashToTree(newFrame.openings);
        updateWindow(win.id, { frame: newFrame });
        toast.success('已添加扇');
        break;
      }
    }
  }, [state, screenToWorld, snapValue, findWindowAtScreen, selectWindow, pushHistory, updateWindow]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = screenToWorld(sx, sy);
    setMousePos({ x: world.x, y: world.y });

    if (isPanning) {
      setPan(e.clientX - panStart.x, e.clientY - panStart.y);
      return;
    }

    if (isDraggingWindow && state.selectedWindowId) {
      const newX = snapValue(world.x - dragOffset.x);
      const newY = snapValue(world.y - dragOffset.y);
      updateWindow(state.selectedWindowId, { posX: newX, posY: newY });
      return;
    }
  }, [screenToWorld, isPanning, isDraggingWindow, state.selectedWindowId, panStart, dragOffset, snapValue, setPan, updateWindow]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDraggingWindow) {
      setIsDraggingWindow(false);
      return;
    }

    if (isDrawing && state.activeTool === 'draw-frame') {
      const rect = canvasContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy);
      const endX = snapValue(world.x);
      const endY = snapValue(world.y);

      const width = Math.abs(endX - drawStart.x);
      const height = Math.abs(endY - drawStart.y);

      if (width > 100 && height > 100) {
        const posX = Math.min(drawStart.x, endX);
        const posY = Math.min(drawStart.y, endY);
        const newWin = createWindowUnit(
          Math.round(width),
          Math.round(height),
          Math.round(posX),
          Math.round(posY),
          state.activeProfileSeries,
        );
        addWindow(newWin);
        toast.success(`已创建窗口 (${Math.round(width)}×${Math.round(height)}mm)`);
      } else if (width > 10 || height > 10) {
        toast.error('窗口尺寸太小（最小100×100mm）');
      }
      setIsDrawing(false);
    }
  }, [isDrawing, isPanning, isDraggingWindow, state.activeTool, state.activeProfileSeries, drawStart, screenToWorld, snapValue, addWindow]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, state.zoom * delta));

    // Zoom towards mouse position
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const newPanX = mx - (mx - state.panX) * (newZoom / state.zoom);
    const newPanY = my - (my - state.panY) * (newZoom / state.zoom);

    setZoom(newZoom);
    setPan(newPanX, newPanY);
  }, [state.zoom, state.panX, state.panY, setZoom, setPan]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
        if (e.key === 'Z') { e.preventDefault(); redo(); }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v': setTool('select'); break;
        case 'r': setTool('draw-frame'); break;
        case 'm': setTool('add-mullion-v'); break;
        case 't': setTool('add-mullion-h'); break;
        case 's': setTool('add-sash'); break;
        case 'h': setTool('pan'); break;
        case 'delete':
        case 'backspace':
          if (state.selectedWindowId) {
            removeWindow(state.selectedWindowId);
            toast.info('已删除窗口');
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedWindowId, undo, redo, setTool, removeWindow]);

  // Add template
  const handleAddTemplate = useCallback((templateId: string) => {
    const template = WINDOW_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    // Place at center of visible canvas
    const centerWorldX = (canvasSize.width / 2 - state.panX) / (MM_TO_PX * state.zoom);
    const centerWorldY = (canvasSize.height / 2 - state.panY) / (MM_TO_PX * state.zoom);
    const posX = snapValue(centerWorldX - template.width / 2);
    const posY = snapValue(centerWorldY - template.height / 2);

    const newWin = template.create(template.id, posX, posY, state.activeProfileSeries);
    addWindow(newWin);
    toast.success(`已添加 ${template.name}`);
  }, [state.panX, state.panY, state.zoom, state.activeProfileSeries, canvasSize, snapValue, addWindow]);

  // New project
  const handleNewProject = useCallback(() => {
    if (state.windows.length > 0) {
      if (!confirm('确定要新建项目吗？当前设计将被清除。')) return;
    }
    // Reset state by reloading
    window.location.reload();
  }, [state.windows]);

  // Export JSON
  const handleExportJSON = useCallback(() => {
    if (state.windows.length === 0) {
      toast.error('画布为空，无法导出');
      return;
    }
    const data = JSON.stringify(state.windows, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'windoor-design.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('已导出设计文件');
  }, [state.windows]);

  // Cursor style based on tool
  const getCursor = () => {
    if (isPanning) return 'grabbing';
    switch (state.activeTool) {
      case 'select': return isDraggingWindow ? 'grabbing' : 'default';
      case 'draw-frame': return 'crosshair';
      case 'add-mullion-v': return 'col-resize';
      case 'add-mullion-h': return 'row-resize';
      case 'add-sash': return 'cell';
      case 'pan': return 'grab';
      default: return 'default';
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Bar */}
      <TopBar
        onNewProject={handleNewProject}
        onExportJSON={handleExportJSON}
        windowCount={state.windows.length}
        onOpenQuote={() => setQuoteOpen(true)}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar */}
        <Toolbar
          activeTool={state.activeTool}
          onToolChange={setTool}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          showDimensions={state.showDimensions}
          onToggleDimensions={toggleDimensions}
          snapToGrid={state.snapToGrid}
          onToggleSnap={toggleSnapToGrid}
          onDeleteSelected={() => {
            if (state.selectedWindowId) {
              removeWindow(state.selectedWindowId);
              toast.info('已删除窗口');
            }
          }}
        />

        {/* Canvas Area */}
        <div
          ref={canvasContainerRef}
          className="flex-1 overflow-hidden relative"
          style={{ cursor: getCursor() }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
        >
          <CanvasRenderer
            windows={state.windows}
            selectedWindowId={state.selectedWindowId}
            selectedElementId={state.selectedElementId}
            zoom={state.zoom}
            panX={state.panX}
            panY={state.panY}
            showDimensions={state.showDimensions}
            width={canvasSize.width}
            height={canvasSize.height}
          />

          {/* Drawing preview overlay */}
          {isDrawing && (
            <div
              className="absolute border-2 border-dashed border-amber-400/60 bg-amber-400/5 pointer-events-none"
              style={{
                left: Math.min(drawStart.x, mousePos.x) * MM_TO_PX * state.zoom + state.panX,
                top: Math.min(drawStart.y, mousePos.y) * MM_TO_PX * state.zoom + state.panY,
                width: Math.abs(mousePos.x - drawStart.x) * MM_TO_PX * state.zoom,
                height: Math.abs(mousePos.y - drawStart.y) * MM_TO_PX * state.zoom,
              }}
            >
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-amber-400 whitespace-nowrap">
                {Math.round(Math.abs(mousePos.x - drawStart.x))} × {Math.round(Math.abs(mousePos.y - drawStart.y))} mm
              </span>
            </div>
          )}

          {/* Empty state hint */}
          {state.windows.length === 0 && !isDrawing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-4xl mb-3 opacity-20">🪟</div>
                <p className="text-sm text-slate-500">按 <kbd className="px-1.5 py-0.5 bg-slate-700/50 rounded text-amber-400 text-xs font-mono">R</kbd> 在画布上拖拽绘制窗框</p>
                <p className="text-xs text-slate-600 mt-1">或从右侧面板选择预设窗型</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Properties Panel */}
        <PropertiesPanel
          selectedWindow={selectedWindow}
          activeProfileSeries={state.activeProfileSeries}
          activeSashType={state.activeSashType}
          onUpdateWindow={updateWindowWithHistory}
          onProfileSeriesChange={setProfileSeries}
          onSashTypeChange={setSashType}
          onAddTemplate={handleAddTemplate}
        />
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        mouseX={mousePos.x}
        mouseY={mousePos.y}
        zoom={state.zoom}
        activeTool={state.activeTool}
        windowCount={state.windows.length}
        onZoomIn={() => setZoom(state.zoom * 1.2)}
        onZoomOut={() => setZoom(state.zoom / 1.2)}
        onZoomReset={() => { setZoom(1); setPan(0, 0); }}
      />
      {/* Quote Dialog */}
      <QuoteDialog
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        windows={state.windows}
      />
    </div>
  );
}
