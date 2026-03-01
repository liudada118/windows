// WindoorDesigner - 主编辑器页面 v2.0
// 工业蓝图美学: 三栏式布局 - 左工具栏 + 中画布 + 右属性面板
// 移动端适配: 底部工具栏 + 触摸手势 + 抽屉面板
// 3D预览: Three.js集成，支持2D/3D一键切换
// v2.0: 交互式添加中梃/扇、中梃拖拽、删除功能、边界校验

import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { useEditorStore } from '@/hooks/useEditorStore';
import CanvasRenderer from '@/components/CanvasRenderer';
import Toolbar from '@/components/Toolbar';
import PropertiesPanel from '@/components/PropertiesPanel';
import StatusBar from '@/components/StatusBar';
import TopBar from '@/components/TopBar';
import MobileToolbar from '@/components/MobileToolbar';
import MobilePropertiesDrawer from '@/components/MobilePropertiesDrawer';
import {
  WINDOW_TEMPLATES,
  createWindowUnit,
  splitOpening,
  findOpeningAtPoint,
  findMullionAtPoint,
  createSash,
  updateMullionInOpenings,
  deleteMullionFromOpening,
  deleteSashFromOpening,
  validateMullionPosition,
  resizeWindowUnit,
} from '@/lib/window-factory';
import type { ToolType, WindowUnit, Opening, Rect } from '@/lib/types';
import { CONSTRAINTS } from '@/lib/types';
import { toast } from 'sonner';
import QuoteDialog from '@/components/QuoteDialog';
import { useIsTouch, useScreenSize } from '@/hooks/useIsMobile';
import { Menu, Box, PenTool, Loader2 } from 'lucide-react';

const ThreePreview = lazy(() => import('@/components/ThreePreview'));

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

  // v2.0: 中梃拖拽状态
  const [isDraggingMullion, setIsDraggingMullion] = useState(false);
  const [draggingMullionInfo, setDraggingMullionInfo] = useState<{
    mullionId: string;
    windowId: string;
    type: 'vertical' | 'horizontal';
  } | null>(null);

  // v2.0: 中梃预览线
  const [mullionPreview, setMullionPreview] = useState<{
    type: 'vertical' | 'horizontal';
    position: number;
    windowId: string;
    openingRect: Rect;
  } | null>(null);

  // Responsive
  const isTouch = useIsTouch();
  const screenSize = useScreenSize();
  const isMobileLayout = screenSize === 'mobile' || screenSize === 'tablet';

  // Touch state refs
  const touchRef = useRef({
    isPinching: false,
    initialDistance: 0,
    initialZoom: 1,
    initialPanX: 0,
    initialPanY: 0,
    lastMidX: 0,
    lastMidY: 0,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    hasMoved: false,
    fingerCount: 0,
    longPressTimer: null as ReturnType<typeof setTimeout> | null,
  });

  // Resize observer
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

  const screenToWorld = useCallback((sx: number, sy: number) => {
    return {
      x: (sx - state.panX) / (MM_TO_PX * state.zoom),
      y: (sy - state.panY) / (MM_TO_PX * state.zoom),
    };
  }, [state.panX, state.panY, state.zoom]);

  const snapValue = useCallback((val: number) => {
    if (!state.snapToGrid) return val;
    const gridMM = state.gridSize;
    return Math.round(val / gridMM) * gridMM;
  }, [state.snapToGrid, state.gridSize]);

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

  // ===== Unified pointer action handlers =====
  const handlePointerDown = useCallback((sx: number, sy: number, isPanGesture: boolean = false) => {
    const world = screenToWorld(sx, sy);

    if (isPanGesture || state.activeTool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: sx - state.panX, y: sy - state.panY });
      return;
    }

    switch (state.activeTool) {
      case 'select': {
        const win = findWindowAtScreen(sx, sy);
        if (win) {
          const localX = world.x - win.posX;
          const localY = world.y - win.posY;

          // v2.0: 检查是否点击了中梃（用于拖拽）
          const mullionHit = findMullionAtPoint(win.frame.openings, localX, localY, 8);
          if (mullionHit) {
            pushHistory();
            setIsDraggingMullion(true);
            setDraggingMullionInfo({
              mullionId: mullionHit.mullion.id,
              windowId: win.id,
              type: mullionHit.mullion.type,
            });
            selectWindow(win.id);
            selectElement(mullionHit.mullion.id, 'mullion');
            return;
          }

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
        if (opening.sash) {
          toast.error('该分格已有扇，请先删除扇再添加中梃');
          return;
        }

        const type = state.activeTool === 'add-mullion-v' ? 'vertical' : 'horizontal';
        const position = type === 'vertical' ? snapValue(localX) : snapValue(localY);
        const mullionWidth = state.activeProfileSeries.mullionWidth;

        // v2.0: 边界校验
        const validation = validateMullionPosition(opening, type, position, mullionWidth);
        if (!validation.valid) {
          toast.error(validation.reason || '中梃位置无效');
          return;
        }

        pushHistory();
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
              return { ...o, sash: createSash(state.activeSashType, o.rect, state.activeProfileSeries.sashWidth) };
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
  }, [state, screenToWorld, snapValue, findWindowAtScreen, selectWindow, selectElement, pushHistory, updateWindow]);

  const handlePointerMove = useCallback((sx: number, sy: number) => {
    const world = screenToWorld(sx, sy);
    setMousePos({ x: world.x, y: world.y });

    if (isPanning) {
      setPan(sx - panStart.x, sy - panStart.y);
      return;
    }

    // v2.0: 中梃拖拽
    if (isDraggingMullion && draggingMullionInfo) {
      const win = state.windows.find(w => w.id === draggingMullionInfo.windowId);
      if (!win) return;
      const localX = world.x - win.posX;
      const localY = world.y - win.posY;
      const newPosition = draggingMullionInfo.type === 'vertical' ? snapValue(localX) : snapValue(localY);
      const mullionWidth = state.activeProfileSeries.mullionWidth;

      const newFrame = JSON.parse(JSON.stringify(win.frame));
      newFrame.openings = updateMullionInOpenings(newFrame.openings, draggingMullionInfo.mullionId, newPosition, mullionWidth);
      updateWindow(win.id, { frame: newFrame });
      return;
    }

    if (isDraggingWindow && state.selectedWindowId) {
      const newX = snapValue(world.x - dragOffset.x);
      const newY = snapValue(world.y - dragOffset.y);
      updateWindow(state.selectedWindowId, { posX: newX, posY: newY });
      return;
    }

    // v2.0: 中梃预览线
    if (state.activeTool === 'add-mullion-v' || state.activeTool === 'add-mullion-h') {
      const win = findWindowAtScreen(sx, sy);
      if (win) {
        const localX = world.x - win.posX;
        const localY = world.y - win.posY;
        const opening = findOpeningAtPoint(win.frame.openings, localX, localY);
        if (opening && !opening.isSplit && !opening.sash) {
          const type = state.activeTool === 'add-mullion-v' ? 'vertical' : 'horizontal';
          const position = type === 'vertical' ? snapValue(localX) : snapValue(localY);
          setMullionPreview({
            type,
            position,
            windowId: win.id,
            openingRect: opening.rect,
          });
        } else {
          setMullionPreview(null);
        }
      } else {
        setMullionPreview(null);
      }
    } else {
      setMullionPreview(null);
    }
  }, [screenToWorld, isPanning, isDraggingMullion, isDraggingWindow, draggingMullionInfo, state, panStart, dragOffset, snapValue, setPan, updateWindow, findWindowAtScreen]);

  const handlePointerUp = useCallback((sx: number, sy: number) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // v2.0: 结束中梃拖拽
    if (isDraggingMullion) {
      setIsDraggingMullion(false);
      setDraggingMullionInfo(null);
      return;
    }

    if (isDraggingWindow) {
      setIsDraggingWindow(false);
      return;
    }

    if (isDrawing && state.activeTool === 'draw-frame') {
      const world = screenToWorld(sx, sy);
      const endX = snapValue(world.x);
      const endY = snapValue(world.y);

      const width = Math.abs(endX - drawStart.x);
      const height = Math.abs(endY - drawStart.y);

      if (width >= CONSTRAINTS.MIN_WINDOW_WIDTH && height >= CONSTRAINTS.MIN_WINDOW_HEIGHT) {
        const clampedWidth = Math.min(width, CONSTRAINTS.MAX_WINDOW_WIDTH);
        const clampedHeight = Math.min(height, CONSTRAINTS.MAX_WINDOW_HEIGHT);
        const posX = Math.min(drawStart.x, endX);
        const posY = Math.min(drawStart.y, endY);
        const newWin = createWindowUnit(
          Math.round(clampedWidth),
          Math.round(clampedHeight),
          Math.round(posX),
          Math.round(posY),
          state.activeProfileSeries,
        );
        addWindow(newWin);
        toast.success(`已创建窗口 (${Math.round(clampedWidth)}×${Math.round(clampedHeight)}mm)`);
      } else if (width > 10 || height > 10) {
        toast.error(`窗口尺寸太小（最小${CONSTRAINTS.MIN_WINDOW_WIDTH}×${CONSTRAINTS.MIN_WINDOW_HEIGHT}mm）`);
      }
      setIsDrawing(false);
    }
  }, [isDrawing, isPanning, isDraggingWindow, isDraggingMullion, state.activeTool, state.activeProfileSeries, drawStart, screenToWorld, snapValue, addWindow]);

  // ===== Mouse handlers =====
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isTouch) return;
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (e.button === 1) {
      handlePointerDown(sx, sy, true);
      return;
    }
    if (e.button !== 0) return;
    handlePointerDown(sx, sy);
  }, [isTouch, handlePointerDown]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isTouch) return;
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    handlePointerMove(e.clientX - rect.left, e.clientY - rect.top);
  }, [isTouch, handlePointerMove]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isTouch) return;
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    handlePointerUp(e.clientX - rect.left, e.clientY - rect.top);
  }, [isTouch, handlePointerUp]);

  // ===== Touch handlers =====
  const getDistance = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const tr = touchRef.current;
    tr.fingerCount = e.touches.length;
    tr.hasMoved = false;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const sx = touch.clientX - rect.left;
      const sy = touch.clientY - rect.top;
      tr.startX = sx;
      tr.startY = sy;
      tr.lastX = sx;
      tr.lastY = sy;
      tr.isPinching = false;

      if (tr.longPressTimer) clearTimeout(tr.longPressTimer);
      tr.longPressTimer = null;

      handlePointerDown(sx, sy);
    } else if (e.touches.length === 2) {
      setIsDrawing(false);
      setIsDraggingWindow(false);
      setIsDraggingMullion(false);
      setIsPanning(false);

      if (tr.longPressTimer) { clearTimeout(tr.longPressTimer); tr.longPressTimer = null; }

      tr.isPinching = true;
      tr.initialDistance = getDistance(e.touches[0], e.touches[1]);
      tr.initialZoom = state.zoom;
      tr.initialPanX = state.panX;
      tr.initialPanY = state.panY;
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      tr.lastMidX = midX;
      tr.lastMidY = midY;
    }
  }, [state.zoom, state.panX, state.panY, handlePointerDown]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const tr = touchRef.current;

    if (e.touches.length === 1 && !tr.isPinching) {
      const touch = e.touches[0];
      const sx = touch.clientX - rect.left;
      const sy = touch.clientY - rect.top;

      const dx = sx - tr.startX;
      const dy = sy - tr.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        tr.hasMoved = true;
        if (tr.longPressTimer) { clearTimeout(tr.longPressTimer); tr.longPressTimer = null; }
      }

      tr.lastX = sx;
      tr.lastY = sy;
      handlePointerMove(sx, sy);
    } else if (e.touches.length === 2) {
      tr.isPinching = true;
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / tr.initialDistance;
      const newZoom = Math.max(0.1, Math.min(5, tr.initialZoom * scale));

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const localMidX = midX - rect.left;
      const localMidY = midY - rect.top;

      const panDeltaX = midX - tr.lastMidX;
      const panDeltaY = midY - tr.lastMidY;

      const newPanX = localMidX - (localMidX - tr.initialPanX) * (newZoom / tr.initialZoom) + panDeltaX;
      const newPanY = localMidY - (localMidY - tr.initialPanY) * (newZoom / tr.initialZoom) + panDeltaY;

      setZoom(newZoom);
      setPan(newPanX, newPanY);

      tr.lastMidX = midX;
      tr.lastMidY = midY;
      tr.initialDistance = currentDistance;
      tr.initialZoom = newZoom;
      tr.initialPanX = newPanX;
      tr.initialPanY = newPanY;
    }
  }, [handlePointerMove, setZoom, setPan]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const tr = touchRef.current;
    if (tr.longPressTimer) { clearTimeout(tr.longPressTimer); tr.longPressTimer = null; }

    if (e.touches.length === 0) {
      if (!tr.isPinching) {
        handlePointerUp(tr.lastX, tr.lastY);
      }
      tr.isPinching = false;
      tr.fingerCount = 0;
    } else if (e.touches.length === 1) {
      tr.isPinching = false;
      const rect = canvasContainerRef.current?.getBoundingClientRect();
      if (rect) {
        tr.lastX = e.touches[0].clientX - rect.left;
        tr.lastY = e.touches[0].clientY - rect.top;
      }
    }
  }, [handlePointerUp]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, state.zoom * delta));

    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const newPanX = mx - (mx - state.panX) * (newZoom / state.zoom);
    const newPanY = my - (my - state.panY) * (newZoom / state.zoom);

    setZoom(newZoom);
    setPan(newPanX, newPanY);
  }, [state.zoom, state.panX, state.panY, setZoom, setPan]);

  // Toggle view mode
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => {
      const next = prev === '2d' ? '3d' : '2d';
      if (next === '3d' && state.windows.length === 0) {
        toast.info('请先在2D编辑器中创建窗口，再切换到3D预览');
        return '2d';
      }
      toast.info(next === '3d' ? '已切换到 3D 预览模式' : '已切换到 2D 编辑模式');
      return next;
    });
  }, [state.windows.length]);

  // v2.0: 删除选中的元素（中梃或扇）
  const handleDeleteSelected = useCallback(() => {
    if (state.selectedElementId && state.selectedWindowId) {
      const win = state.windows.find(w => w.id === state.selectedWindowId);
      if (!win) return;

      pushHistory();
      const newFrame = JSON.parse(JSON.stringify(win.frame));

      if (state.selectedElementType === 'mullion') {
        newFrame.openings = deleteMullionFromOpening(newFrame.openings, state.selectedElementId);
        updateWindow(win.id, { frame: newFrame });
        selectElement(null, null);
        toast.success('已删除中梃（子分格已合并）');
        return;
      }

      if (state.selectedElementType === 'sash') {
        newFrame.openings = deleteSashFromOpening(newFrame.openings, state.selectedElementId);
        updateWindow(win.id, { frame: newFrame });
        selectElement(null, null);
        toast.success('已删除扇');
        return;
      }
    }

    if (state.selectedWindowId) {
      removeWindow(state.selectedWindowId);
      toast.info('已删除窗口');
    }
  }, [state, pushHistory, updateWindow, removeWindow, selectElement]);

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
        case '3': toggleViewMode(); break;
        case 'delete':
        case 'backspace':
          handleDeleteSelected();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDeleteSelected, undo, redo, setTool, toggleViewMode]);

  // Add template
  const handleAddTemplate = useCallback((templateId: string) => {
    const template = WINDOW_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

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

  // Cursor style
  const getCursor = () => {
    if (isTouch) return 'default';
    if (isPanning) return 'grabbing';
    if (isDraggingMullion) return draggingMullionInfo?.type === 'vertical' ? 'col-resize' : 'row-resize';
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
    <div className="h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Bar - responsive */}
      {isMobileLayout ? (
        <div className="h-11 bg-[oklch(0.13_0.022_260)] border-b border-[oklch(0.25_0.035_260)] flex items-center px-3 gap-2 select-none shrink-0">
          <span className="text-sm font-semibold text-slate-200 tracking-tight">WindoorDesigner</span>
          <span className="text-[9px] text-amber-500/70 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded">BETA</span>

          <div className="flex items-center bg-[oklch(0.17_0.028_260)] rounded-lg p-0.5 border border-[oklch(0.25_0.035_260)]">
            <button
              onClick={() => viewMode !== '2d' && toggleViewMode()}
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
              onClick={() => viewMode !== '3d' && toggleViewMode()}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md transition-all ${
                viewMode === '3d'
                  ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30 font-medium'
                  : 'text-slate-500'
              }`}
            >
              <Box size={10} />
              3D
            </button>
          </div>

          <div className="flex-1" />
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
          windowCount={state.windows.length}
          onOpenQuote={() => setQuoteOpen(true)}
          viewMode={viewMode}
          onToggleViewMode={toggleViewMode}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar - desktop only, hidden in 3D mode */}
        {!isMobileLayout && viewMode === '2d' && (
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
            onDeleteSelected={handleDeleteSelected}
          />
        )}

        {/* Canvas / 3D Preview Area */}
        {viewMode === '2d' ? (
          <div
            ref={canvasContainerRef}
            className="flex-1 overflow-hidden relative touch-none"
            style={{ cursor: getCursor() }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
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
              mullionPreview={mullionPreview}
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
                  onClick={() => setZoom(state.zoom * 1.3)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-[oklch(0.17_0.028_260)]/90 backdrop-blur border border-[oklch(0.30_0.04_260)] text-slate-300 active:bg-amber-500/20"
                >
                  <span className="text-lg font-bold">+</span>
                </button>
                <button
                  onClick={() => { setZoom(1); setPan(0, 0); }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-[oklch(0.17_0.028_260)]/90 backdrop-blur border border-[oklch(0.30_0.04_260)] text-slate-400 active:bg-amber-500/20"
                >
                  <span className="text-[10px] font-mono">{Math.round(state.zoom * 100)}%</span>
                </button>
                <button
                  onClick={() => setZoom(state.zoom / 1.3)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-[oklch(0.17_0.028_260)]/90 backdrop-blur border border-[oklch(0.30_0.04_260)] text-slate-300 active:bg-amber-500/20"
                >
                  <span className="text-lg font-bold">-</span>
                </button>
              </div>
            )}
          </div>
        ) : (
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
                windows={state.windows}
                selectedWindowId={state.selectedWindowId}
              />
            </Suspense>
          </div>
        )}

        {/* Right Properties Panel - desktop only */}
        {!isMobileLayout && (
          <PropertiesPanel
            selectedWindow={selectedWindow}
            activeProfileSeries={state.activeProfileSeries}
            activeSashType={state.activeSashType}
            onUpdateWindow={updateWindowWithHistory}
            onProfileSeriesChange={setProfileSeries}
            onSashTypeChange={setSashType}
            onAddTemplate={handleAddTemplate}
          />
        )}
      </div>

      {/* Bottom: Status Bar (desktop) or Mobile Toolbar */}
      {isMobileLayout ? (
        viewMode === '2d' ? (
          <MobileToolbar
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
            onDeleteSelected={handleDeleteSelected}
            onZoomIn={() => setZoom(state.zoom * 1.2)}
            onZoomOut={() => setZoom(state.zoom / 1.2)}
            onZoomReset={() => { setZoom(1); setPan(0, 0); }}
            zoom={state.zoom}
            hasSelection={!!state.selectedWindowId}
          />
        ) : null
      ) : (
        <StatusBar
          mouseX={viewMode === '2d' ? mousePos.x : 0}
          mouseY={viewMode === '2d' ? mousePos.y : 0}
          zoom={state.zoom}
          activeTool={viewMode === '2d' ? state.activeTool : 'select'}
          windowCount={state.windows.length}
          onZoomIn={() => setZoom(state.zoom * 1.2)}
          onZoomOut={() => setZoom(state.zoom / 1.2)}
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
          activeProfileSeries={state.activeProfileSeries}
          activeSashType={state.activeSashType}
          onUpdateWindow={updateWindowWithHistory}
          onProfileSeriesChange={setProfileSeries}
          onSashTypeChange={setSashType}
          onAddTemplate={handleAddTemplate}
        />
      )}

      {/* Quote Dialog */}
      <QuoteDialog
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        windows={state.windows}
      />
    </div>
  );
}
