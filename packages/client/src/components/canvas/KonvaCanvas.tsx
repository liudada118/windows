// WindoorDesigner - Konva.js 主画布容器
// Stage → Layer 结构，集成所有渲染层和交互逻辑

import { useRef, useCallback, useEffect, useState } from 'react';
import { Stage, Layer, Group, Rect, Line, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useDesignStore } from '@/stores/designStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useHistoryStore } from '@/stores/historyStore';
import GridLayer from './GridLayer';
import FrameRenderer from './FrameRenderer';
import OpeningRenderer from './OpeningRenderer';
import DimensionRenderer from './DimensionRenderer';
import SelectionOverlay from './SelectionOverlay';
import { COLORS, MM_TO_PX } from '@/lib/constants';
import { validateWindowSize, validateMullionPlacement, validateSashPlacement } from '@/lib/validators';
import { findLeafOpeningAtPoint, findMullionAtPoint as findMullionAtPointGeo, snapToGrid } from '@/lib/geometry';
import { toast } from 'sonner';

interface KonvaCanvasProps {
  width: number;
  height: number;
}

/** Konva.js 主画布组件 */
export default function KonvaCanvas({ width, height }: KonvaCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);

  // Design Store
  const designData = useDesignStore((s) => s.designData);
  const selectedWindowId = useDesignStore((s) => s.selectedWindowId);
  const selectedElementId = useDesignStore((s) => s.selectedElementId);
  const activeSashType = useDesignStore((s) => s.activeSashType);
  const activeProfileSeries = useDesignStore((s) => s.activeProfileSeries);
  const addWindow = useDesignStore((s) => s.addWindow);
  const deleteWindow = useDesignStore((s) => s.deleteWindow);
  const selectWindow = useDesignStore((s) => s.selectWindow);
  const selectElement = useDesignStore((s) => s.selectElement);
  const updateWindowPosition = useDesignStore((s) => s.updateWindowPosition);
  const addMullion = useDesignStore((s) => s.addMullion);
  const setSash = useDesignStore((s) => s.setSash);
  const moveMullion = useDesignStore((s) => s.moveMullion);
  const getSnapshot = useDesignStore((s) => s.getSnapshot);

  // Canvas Store
  const activeTool = useCanvasStore((s) => s.activeTool);
  const zoom = useCanvasStore((s) => s.zoom);
  const panX = useCanvasStore((s) => s.panX);
  const panY = useCanvasStore((s) => s.panY);
  const gridSizeMM = useCanvasStore((s) => s.gridSize);
  const snapEnabled = useCanvasStore((s) => s.snapToGrid);
  const showDimensions = useCanvasStore((s) => s.showDimensions);
  const mullionPreview = useCanvasStore((s) => s.mullionPreview);
  const drawPreview = useCanvasStore((s) => s.drawPreview);
  const hoveredOpeningId = useCanvasStore((s) => s.hoveredOpeningId);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const zoomAtPoint = useCanvasStore((s) => s.zoomAtPoint);
  const setPan = useCanvasStore((s) => s.setPan);
  const setMullionPreview = useCanvasStore((s) => s.setMullionPreview);
  const setDrawPreview = useCanvasStore((s) => s.setDrawPreview);
  const setMouseWorldPos = useCanvasStore((s) => s.setMouseWorldPos);
  const setHoveredOpeningId = useCanvasStore((s) => s.setHoveredOpeningId);

  // History Store
  const pushHistory = useHistoryStore((s) => s.pushHistory);

  // 本地交互状态
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDraggingMullion, setIsDraggingMullion] = useState(false);
  const [draggingMullionInfo, setDraggingMullionInfo] = useState<{
    mullionId: string;
    windowId: string;
    type: 'vertical' | 'horizontal';
  } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  /** 屏幕坐标转世界坐标 */
  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - panX) / (MM_TO_PX * zoom),
      y: (sy - panY) / (MM_TO_PX * zoom),
    }),
    [panX, panY, zoom]
  );

  /** 吸附到网格 */
  const snap = useCallback(
    (val: number) => (snapEnabled ? snapToGrid(val, gridSizeMM) : val),
    [snapEnabled, gridSizeMM]
  );

  /** 查找屏幕坐标下的窗户 */
  const findWindowAtScreen = useCallback(
    (sx: number, sy: number) => {
      const world = screenToWorld(sx, sy);
      for (let i = designData.windows.length - 1; i >= 0; i--) {
        const win = designData.windows[i];
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
    },
    [designData.windows, screenToWorld]
  );

  // ===== 鼠标按下 =====
  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const { x: sx, y: sy } = pos;
      const world = screenToWorld(sx, sy);

      // 中键或空格拖拽 → 平移
      if (e.evt.button === 1 || spaceHeld || activeTool === 'pan') {
        setIsPanning(true);
        setPanStart({ x: sx - panX, y: sy - panY });
        return;
      }

      if (e.evt.button !== 0) return; // 只处理左键

      switch (activeTool) {
        case 'select': {
          const win = findWindowAtScreen(sx, sy);
          if (win) {
            // 检查是否点击了中梃
            const localX = world.x - win.posX;
            const localY = world.y - win.posY;
            const rootOpening = win.frame.openings[0];
            if (rootOpening) {
              const mullionHit = findMullionAtPointGeo(rootOpening, localX, localY, 8);
              if (mullionHit) {
                pushHistory(getSnapshot());
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
            }

            selectWindow(win.id);
            setIsDraggingWindow(true);
            setDragOffset({ x: world.x - win.posX, y: world.y - win.posY });
          } else {
            selectWindow(null);
          }
          break;
        }

        case 'draw-frame': {
          setIsDrawing(true);
          setDrawStart({ x: snap(world.x), y: snap(world.y) });
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
          const rootOpening = win.frame.openings[0];
          if (!rootOpening) return;

          const opening = findLeafOpeningAtPoint(rootOpening, localX, localY);
          if (!opening) {
            toast.error('请点击窗口内的空白分格区域');
            return;
          }
          if (opening.isSplit) return;
          if (opening.sash) {
            toast.error('该分格已有扇，请先删除扇再添加中梃');
            return;
          }

          const direction = activeTool === 'add-mullion-v' ? 'vertical' : 'horizontal';
          const position = direction === 'vertical' ? snap(localX) : snap(localY);

          const validation = validateMullionPlacement(
            opening,
            direction,
            position,
            activeProfileSeries.mullionWidth
          );
          if (!validation.valid) {
            toast.error(validation.errors[0] || '中梃位置无效');
            return;
          }

          pushHistory(getSnapshot());
          addMullion(win.id, opening.id, direction, position);
          toast.success(direction === 'vertical' ? '已添加中梃' : '已添加横档');
          setMullionPreview(null);
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
          const rootOpening = win.frame.openings[0];
          if (!rootOpening) return;

          const opening = findLeafOpeningAtPoint(rootOpening, localX, localY);
          if (!opening) return;

          const validation = validateSashPlacement(opening);
          if (!validation.valid) {
            toast.error(validation.errors[0] || '无法添加扇');
            return;
          }

          pushHistory(getSnapshot());
          setSash(win.id, opening.id, activeSashType);
          toast.success('已添加扇');
          setActiveTool('select');
          break;
        }
      }
    },
    [
      activeTool, spaceHeld, panX, panY, zoom, screenToWorld, snap,
      findWindowAtScreen, selectWindow, selectElement, pushHistory,
      getSnapshot, addMullion, setSash, activeSashType, activeProfileSeries,
      setActiveTool, setMullionPreview,
    ]
  );

  // ===== 鼠标移动 =====
  const handleMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const { x: sx, y: sy } = pos;
      const world = screenToWorld(sx, sy);
      setMouseWorldPos(world.x, world.y);

      // 平移
      if (isPanning) {
        setPan(sx - panStart.x, sy - panStart.y);
        return;
      }

      // 拖拽窗户
      if (isDraggingWindow && selectedWindowId) {
        const newX = snap(world.x - dragOffset.x);
        const newY = snap(world.y - dragOffset.y);
        updateWindowPosition(selectedWindowId, newX, newY);
        return;
      }

      // 拖拽中梃
      if (isDraggingMullion && draggingMullionInfo) {
        const win = designData.windows.find((w) => w.id === draggingMullionInfo.windowId);
        if (!win) return;
        const localX = world.x - win.posX;
        const localY = world.y - win.posY;
        const newPosition =
          draggingMullionInfo.type === 'vertical' ? snap(localX) : snap(localY);
        moveMullion(draggingMullionInfo.windowId, draggingMullionInfo.mullionId, newPosition);
        return;
      }

      // 绘制外框预览
      if (isDrawing) {
        const endX = snap(world.x);
        const endY = snap(world.y);
        const x = Math.min(drawStart.x, endX);
        const y = Math.min(drawStart.y, endY);
        const w = Math.abs(endX - drawStart.x);
        const h = Math.abs(endY - drawStart.y);
        setDrawPreview({ x, y, width: w, height: h });
        return;
      }

      // 中梃预览线
      if (activeTool === 'add-mullion-v' || activeTool === 'add-mullion-h') {
        const win = findWindowAtScreen(sx, sy);
        if (win) {
          const localX = world.x - win.posX;
          const localY = world.y - win.posY;
          const rootOpening = win.frame.openings[0];
          if (rootOpening) {
            const opening = findLeafOpeningAtPoint(rootOpening, localX, localY);
            if (opening && !opening.isSplit && !opening.sash) {
              const direction = activeTool === 'add-mullion-v' ? 'vertical' : 'horizontal';
              const position = direction === 'vertical' ? snap(localX) : snap(localY);
              setMullionPreview({
                type: direction,
                position,
                windowId: win.id,
                openingRect: opening.rect,
              });
              setHoveredOpeningId(opening.id);
              return;
            }
          }
        }
        setMullionPreview(null);
        setHoveredOpeningId(null);
        return;
      }

      // 扇工具悬停高亮
      if (activeTool === 'add-sash') {
        const win = findWindowAtScreen(sx, sy);
        if (win) {
          const localX = world.x - win.posX;
          const localY = world.y - win.posY;
          const rootOpening = win.frame.openings[0];
          if (rootOpening) {
            const opening = findLeafOpeningAtPoint(rootOpening, localX, localY);
            if (opening && !opening.isSplit) {
              setHoveredOpeningId(opening.id);
              return;
            }
          }
        }
        setHoveredOpeningId(null);
      }
    },
    [
      isPanning, panStart, isDraggingWindow, isDraggingMullion, isDrawing,
      selectedWindowId, draggingMullionInfo, drawStart, activeTool,
      screenToWorld, snap, findWindowAtScreen, designData.windows,
      setPan, updateWindowPosition, moveMullion, setDrawPreview,
      setMullionPreview, setHoveredOpeningId, setMouseWorldPos, dragOffset,
    ]
  );

  // ===== 鼠标松开 =====
  const handleMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // 结束平移
      if (isPanning) {
        setIsPanning(false);
        return;
      }

      // 结束窗户拖拽
      if (isDraggingWindow) {
        setIsDraggingWindow(false);
        return;
      }

      // 结束中梃拖拽
      if (isDraggingMullion) {
        setIsDraggingMullion(false);
        setDraggingMullionInfo(null);
        return;
      }

      // 结束绘制外框
      if (isDrawing && drawPreview) {
        setIsDrawing(false);
        setDrawPreview(null);

        const { width: w, height: h } = drawPreview;
        const validation = validateWindowSize(w, h);
        if (!validation.valid) {
          toast.error(validation.errors[0]);
          return;
        }

        pushHistory(getSnapshot());
        addWindow(w, h, drawPreview.x, drawPreview.y);
        setActiveTool('select');
        toast.success(`已创建窗户 (${Math.round(w)} × ${Math.round(h)})`);
        return;
      }

      setIsDrawing(false);
    },
    [
      isPanning, isDraggingWindow, isDraggingMullion, isDrawing, drawPreview,
      pushHistory, getSnapshot, addWindow, setActiveTool, setDrawPreview,
    ]
  );

  // ===== 滚轮缩放 =====
  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const delta = e.evt.deltaY > 0 ? -0.1 : 0.1;
      zoomAtPoint(delta, pos.x, pos.y);
    },
    [zoomAtPoint]
  );

  // ===== 空格键平移 =====
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceHeld(false);
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 光标样式
  const getCursor = () => {
    if (isPanning || spaceHeld) return 'grab';
    switch (activeTool) {
      case 'draw-frame': return 'crosshair';
      case 'add-mullion-v': return 'col-resize';
      case 'add-mullion-h': return 'row-resize';
      case 'add-sash': return 'cell';
      case 'pan': return 'grab';
      default: return 'default';
    }
  };

  const scale = MM_TO_PX * zoom;

  return (
    <div style={{ cursor: getCursor(), width: '100%', height: '100%' }}>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* L0 - 网格背景 */}
        <GridLayer width={width} height={height} zoom={zoom} panX={panX} panY={panY} />

        {/* L1-L3 - 窗户渲染层 */}
        <Layer>
          {designData.windows.map((win) => {
            const isSelected = win.id === selectedWindowId;
            const wx = win.posX * scale + panX;
            const wy = win.posY * scale + panY;

            return (
              <Group key={win.id} x={wx} y={wy}>
                {/* 外框 */}
                <FrameRenderer
                  frame={win.frame}
                  windowWidth={win.width}
                  windowHeight={win.height}
                  isSelected={isSelected}
                  zoom={zoom}
                />

                {/* Opening 递归渲染 */}
                {win.frame.openings.map((opening) => (
                  <OpeningRenderer
                    key={opening.id}
                    opening={opening}
                    zoom={zoom}
                    selectedElementId={selectedElementId}
                    hoveredOpeningId={hoveredOpeningId}
                  />
                ))}

                {/* 尺寸标注 */}
                {showDimensions && (
                  <DimensionRenderer window={win} zoom={zoom} />
                )}

                {/* 选中高亮 */}
                {isSelected && (
                  <SelectionOverlay window={win} zoom={zoom} />
                )}
              </Group>
            );
          })}
        </Layer>

        {/* L5 - 交互层 */}
        <Layer>
          {/* 绘制外框预览 */}
          {drawPreview && (
            <Rect
              x={drawPreview.x * scale + panX}
              y={drawPreview.y * scale + panY}
              width={drawPreview.width * scale}
              height={drawPreview.height * scale}
              stroke={COLORS.drawPreview}
              strokeWidth={2}
              dash={[8, 4]}
              listening={false}
            />
          )}

          {/* 绘制外框预览尺寸标注 */}
          {drawPreview && (
            <Text
              x={drawPreview.x * scale + panX + drawPreview.width * scale + 5}
              y={drawPreview.y * scale + panY + drawPreview.height * scale + 5}
              text={`${Math.round(drawPreview.width)} × ${Math.round(drawPreview.height)}`}
              fontSize={12}
              fontFamily="JetBrains Mono, monospace"
              fill={COLORS.drawPreview}
              listening={false}
            />
          )}

          {/* 中梃预览线 */}
          {mullionPreview && (() => {
            const win = designData.windows.find((w) => w.id === mullionPreview.windowId);
            if (!win) return null;
            const wx = win.posX * scale + panX;
            const wy = win.posY * scale + panY;
            const rect = mullionPreview.openingRect;

            if (mullionPreview.type === 'vertical') {
              const px = mullionPreview.position * scale + wx;
              const py1 = rect.y * scale + wy;
              const py2 = (rect.y + rect.height) * scale + wy;
              return (
                <Line
                  points={[px, py1, px, py2]}
                  stroke={COLORS.mullionPreview}
                  strokeWidth={1}
                  dash={[6, 4]}
                  listening={false}
                />
              );
            } else {
              const py = mullionPreview.position * scale + wy;
              const px1 = rect.x * scale + wx;
              const px2 = (rect.x + rect.width) * scale + wx;
              return (
                <Line
                  points={[px1, py, px2, py]}
                  stroke={COLORS.mullionPreview}
                  strokeWidth={1}
                  dash={[6, 4]}
                  listening={false}
                />
              );
            }
          })()}
        </Layer>
      </Stage>
    </div>
  );
}
