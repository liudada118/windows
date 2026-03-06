// CompositeWindowRenderer - 组合窗（U形窗/L形窗/凸窗）的 2D 画布渲染
// 支持展开视图和透视视图两种模式

import { Group, Rect, Line, Text, Shape } from 'react-konva';
import type { CompositeWindow, CompositePanel } from '@/lib/types';
import { MM_TO_PX } from '@/lib/constants';
import FrameRenderer from './FrameRenderer';
import OpeningRenderer from './OpeningRenderer';
import DimensionRenderer from './DimensionRenderer';

interface CompositeWindowRendererProps {
  compositeWindow: CompositeWindow;
  zoom: number;
  isSelected: boolean;
  selectedElementId: string | null;
  hoveredOpeningId: string | null;
}

// ===== 展开视图渲染 =====
// 所有面板水平排列，面板之间用转角标记连接

function UnfoldView({
  compositeWindow,
  zoom,
  isSelected,
  selectedElementId,
  hoveredOpeningId,
}: CompositeWindowRendererProps) {
  const scale = MM_TO_PX * zoom;
  const panels = compositeWindow.panels;
  const GAP = 30; // 面板之间的间距（mm）
  const CORNER_MARK_SIZE = 20; // 转角标记大小（mm）

  // 计算每个面板的 x 偏移
  let currentX = 0;
  const panelPositions: { panel: CompositePanel; offsetX: number }[] = [];

  panels.forEach((panel, i) => {
    panelPositions.push({ panel, offsetX: currentX });
    currentX += panel.windowUnit.width + (i < panels.length - 1 ? GAP : 0);
  });

  return (
    <Group>
      {panelPositions.map(({ panel, offsetX }, i) => {
        const win = panel.windowUnit;
        return (
          <Group key={panel.id} x={offsetX * scale} y={0}>
            {/* 面板标签 */}
            <Text
              x={0}
              y={-24 * zoom}
              text={panel.label}
              fontSize={12 * zoom}
              fill="#666"
              fontStyle="bold"
              align="center"
              width={win.width * scale}
            />

            {/* 角度标注 */}
            {panel.angle !== 0 && (
              <Text
                x={0}
                y={-12 * zoom}
                text={`${Math.abs(panel.angle)}°`}
                fontSize={10 * zoom}
                fill="#999"
                align="center"
                width={win.width * scale}
              />
            )}

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
            {isSelected && (
              <DimensionRenderer window={win} zoom={zoom} />
            )}

            {/* 转角连接标记 */}
            {i < panels.length - 1 && (
              <Group x={win.width * scale} y={0}>
                {/* 转角虚线 */}
                <Line
                  points={[
                    GAP * scale * 0.1, 0,
                    GAP * scale * 0.1, win.height * scale,
                  ]}
                  stroke="#E74C3C"
                  strokeWidth={1.5 * zoom}
                  dash={[6 * zoom, 3 * zoom]}
                />
                <Line
                  points={[
                    GAP * scale * 0.9, 0,
                    GAP * scale * 0.9, win.height * scale,
                  ]}
                  stroke="#E74C3C"
                  strokeWidth={1.5 * zoom}
                  dash={[6 * zoom, 3 * zoom]}
                />
                {/* 转角角度标记 */}
                <Shape
                  sceneFunc={(context, shape) => {
                    const cx = GAP * scale * 0.5;
                    const cy = win.height * scale * 0.5;
                    const r = CORNER_MARK_SIZE * scale * 0.5;
                    context.beginPath();
                    context.arc(cx, cy, r, 0, Math.PI * 2);
                    context.closePath();
                    context.fillStrokeShape(shape);
                  }}
                  fill="rgba(231, 76, 60, 0.1)"
                  stroke="#E74C3C"
                  strokeWidth={1 * zoom}
                />
                {/* 角度文字 */}
                <Text
                  x={0}
                  y={win.height * scale * 0.5 - 6 * zoom}
                  text={`${Math.abs(panels[i + 1].angle)}°`}
                  fontSize={10 * zoom}
                  fill="#E74C3C"
                  fontStyle="bold"
                  align="center"
                  width={GAP * scale}
                />
              </Group>
            )}
          </Group>
        );
      })}

      {/* 组合窗名称 */}
      <Text
        x={0}
        y={-40 * zoom}
        text={compositeWindow.name}
        fontSize={14 * zoom}
        fill={isSelected ? '#2980B9' : '#333'}
        fontStyle="bold"
      />
    </Group>
  );
}

// ===== 透视视图渲染 =====
// 用简单的等轴测投影显示 3D 效果

function PerspectiveView({
  compositeWindow,
  zoom,
  isSelected,
}: CompositeWindowRendererProps) {
  const scale = MM_TO_PX * zoom;
  const panels = compositeWindow.panels;
  const DEPTH_FACTOR = 0.35; // 深度缩放系数
  const SKEW_ANGLE = 30; // 倾斜角度（度）
  const skewRad = (SKEW_ANGLE * Math.PI) / 180;

  // 根据组合窗类型计算每个面板的 3D 投影位置
  const renderPanels: {
    panel: CompositePanel;
    points: number[]; // 四边形的 4 个顶点 [x0,y0, x1,y1, x2,y2, x3,y3]
    isFront: boolean;
    zIndex: number;
  }[] = [];

  if (compositeWindow.type === 'u-shape') {
    // U 形窗: 左侧面（透视缩短）+ 正面 + 右侧面（透视缩短）
    const frontPanel = panels.find(p => p.angle === 0) || panels[1];
    const leftPanel = panels.find(p => p.angle < 0) || panels[0];
    const rightPanel = panels.find(p => p.angle > 0) || panels[2];

    const fw = frontPanel.windowUnit.width * scale;
    const fh = frontPanel.windowUnit.height * scale;
    const lw = leftPanel.windowUnit.width * scale * DEPTH_FACTOR;
    const rw = rightPanel.windowUnit.width * scale * DEPTH_FACTOR;
    const depthY = lw * Math.sin(skewRad);

    // 左侧面 - 透视变形
    renderPanels.push({
      panel: leftPanel,
      points: [
        0, depthY,                    // 左上（远）
        lw, 0,                        // 右上（近）
        lw, fh,                       // 右下（近）
        0, fh + depthY,              // 左下（远）
      ],
      isFront: false,
      zIndex: 0,
    });

    // 正面
    renderPanels.push({
      panel: frontPanel,
      points: [
        lw, 0,
        lw + fw, 0,
        lw + fw, fh,
        lw, fh,
      ],
      isFront: true,
      zIndex: 1,
    });

    // 右侧面 - 透视变形
    renderPanels.push({
      panel: rightPanel,
      points: [
        lw + fw, 0,
        lw + fw + rw, depthY,
        lw + fw + rw, fh + depthY,
        lw + fw, fh,
      ],
      isFront: false,
      zIndex: 0,
    });
  } else if (compositeWindow.type === 'l-shape') {
    // L 形窗: 正面 + 侧面（透视缩短）
    const frontPanel = panels[0];
    const sidePanel = panels[1];

    const fw = frontPanel.windowUnit.width * scale;
    const fh = frontPanel.windowUnit.height * scale;
    const sw = sidePanel.windowUnit.width * scale * DEPTH_FACTOR;
    const depthY = sw * Math.sin(skewRad);

    renderPanels.push({
      panel: frontPanel,
      points: [0, 0, fw, 0, fw, fh, 0, fh],
      isFront: true,
      zIndex: 1,
    });

    renderPanels.push({
      panel: sidePanel,
      points: [
        fw, 0,
        fw + sw, depthY,
        fw + sw, fh + depthY,
        fw, fh,
      ],
      isFront: false,
      zIndex: 0,
    });
  } else if (compositeWindow.type === 'bay-window') {
    // 凸窗: 左斜面 + 正面 + 右斜面
    const leftPanel = panels[0];
    const frontPanel = panels[1];
    const rightPanel = panels[2];

    const fw = frontPanel.windowUnit.width * scale;
    const fh = frontPanel.windowUnit.height * scale;
    const lw = leftPanel.windowUnit.width * scale * DEPTH_FACTOR * 0.8;
    const rw = rightPanel.windowUnit.width * scale * DEPTH_FACTOR * 0.8;
    const depthY = lw * Math.sin(skewRad * 0.5);

    renderPanels.push({
      panel: leftPanel,
      points: [
        0, depthY * 0.5,
        lw, 0,
        lw, fh,
        0, fh + depthY * 0.5,
      ],
      isFront: false,
      zIndex: 0,
    });

    renderPanels.push({
      panel: frontPanel,
      points: [lw, 0, lw + fw, 0, lw + fw, fh, lw, fh],
      isFront: true,
      zIndex: 1,
    });

    renderPanels.push({
      panel: rightPanel,
      points: [
        lw + fw, 0,
        lw + fw + rw, depthY * 0.5,
        lw + fw + rw, fh + depthY * 0.5,
        lw + fw, fh,
      ],
      isFront: false,
      zIndex: 0,
    });
  }

  // 排序渲染（先渲染远处的面板）
  const sorted = [...renderPanels].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <Group>
      {sorted.map(({ panel, points, isFront }) => {
        const win = panel.windowUnit;
        const frameColor = isFront ? '#B0BEC5' : '#90A4AE';
        const glassColor = isFront ? 'rgba(173, 216, 230, 0.4)' : 'rgba(173, 216, 230, 0.25)';

        return (
          <Group key={panel.id}>
            {/* 面板填充 */}
            <Line
              points={points}
              closed
              fill={glassColor}
              stroke={isSelected ? '#2980B9' : '#546E7A'}
              strokeWidth={2 * zoom}
            />

            {/* 框架边框（内框） */}
            {(() => {
              const pw = win.frame.profileWidth * scale;
              // 简化：对于正面面板绘制内框
              if (isFront) {
                const x0 = points[0];
                const y0 = points[1];
                const x1 = points[2];
                const y1 = points[5]; // bottom y
                return (
                  <Rect
                    x={x0 + pw}
                    y={y0 + pw}
                    width={x1 - x0 - pw * 2}
                    height={y1 - y0 - pw * 2}
                    stroke={frameColor}
                    strokeWidth={1 * zoom}
                    fill="transparent"
                  />
                );
              }
              return null;
            })()}

            {/* 面板标签 */}
            <Text
              x={points[0]}
              y={points[1] - 16 * zoom}
              text={panel.label}
              fontSize={11 * zoom}
              fill="#666"
              fontStyle="bold"
            />
          </Group>
        );
      })}

      {/* 组合窗名称 */}
      <Text
        x={0}
        y={-30 * zoom}
        text={`${compositeWindow.name} (透视图)`}
        fontSize={14 * zoom}
        fill={isSelected ? '#2980B9' : '#333'}
        fontStyle="bold"
      />
    </Group>
  );
}

// ===== 主渲染组件 =====

export default function CompositeWindowRenderer(props: CompositeWindowRendererProps) {
  const { compositeWindow } = props;

  if (compositeWindow.viewMode === 'perspective') {
    return <PerspectiveView {...props} />;
  }

  return <UnfoldView {...props} />;
}
