// WindoorDesigner - L4 尺寸标注渲染组件
// 渲染外框尺寸和分格尺寸标注线
// 支持点击数值直接编辑尺寸

import { type ReactElement } from 'react';
import { Group, Line, Text, Rect } from 'react-konva';
import type { WindowUnit, Opening } from '@windoor/shared';
import { COLORS } from '@/lib/constants';

/** 尺寸标注点击信息 */
export interface DimensionClickInfo {
  /** 窗户 ID */
  windowId: string;
  /** 尺寸类型 */
  dimensionType: 'window-width' | 'window-height' | 'opening-width' | 'opening-height';
  /** 当前值 (mm) */
  currentValue: number;
  /** 屏幕坐标 (用于定位输入框) */
  screenX: number;
  screenY: number;
  /** 关联的 opening ID (分格尺寸时) */
  openingId?: string;
  /** 关联的 child index (分格尺寸时) */
  childIndex?: number;
}

interface DimensionRendererProps {
  window: WindowUnit;
  zoom: number;
  /** 点击尺寸数值的回调 */
  onDimensionClick?: (info: DimensionClickInfo) => void;
  /** 是否为选中状态 */
  isSelected?: boolean;
}

const MM_TO_PX = 0.5;
const OFFSET = 25; // 标注线到外框的距离 (px)
const TICK_SIZE = 6; // 标注线端点刻度长度 (px)

/** 获取点击位置的屏幕坐标 */
function getScreenPos(
  e: any,
  fallbackOffsetX: number,
  fallbackOffsetY: number
): { screenX: number; screenY: number } {
  const stage = e.target.getStage();
  if (stage) {
    const container = stage.container();
    const rect = container.getBoundingClientRect();
    const absPos = e.target.getAbsolutePosition();
    return {
      screenX: rect.left + absPos.x + fallbackOffsetX,
      screenY: rect.top + absPos.y + fallbackOffsetY,
    };
  }
  return { screenX: 0, screenY: 0 };
}

/** 渲染单条尺寸标注（可点击） */
function DimensionLine({
  x1,
  y1,
  x2,
  y2,
  value,
  direction,
  onClick,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  value: number;
  direction: 'horizontal' | 'vertical';
  onClick?: (screenX: number, screenY: number) => void;
}) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const text = `${Math.round(value)}`;
  const textWidth = Math.max(40, text.length * 8 + 12);
  const textHeight = 16;
  const bgPadding = 4;
  const isClickable = !!onClick;

  if (direction === 'horizontal') {
    const textX = midX - textWidth / 2;
    const textY = midY - textHeight;

    return (
      <Group>
        {/* 主标注线 */}
        <Line
          points={[x1, y1, x2, y2]}
          stroke={COLORS.dimension}
          strokeWidth={0.8}
          listening={false}
        />
        {/* 左端刻度 */}
        <Line
          points={[x1, y1 - TICK_SIZE / 2, x1, y1 + TICK_SIZE / 2]}
          stroke={COLORS.dimension}
          strokeWidth={0.8}
          listening={false}
        />
        {/* 右端刻度 */}
        <Line
          points={[x2, y2 - TICK_SIZE / 2, x2, y2 + TICK_SIZE / 2]}
          stroke={COLORS.dimension}
          strokeWidth={0.8}
          listening={false}
        />
        {/* 数值背景（点击热区） */}
        <Rect
          name="dimension-label"
          x={textX - bgPadding}
          y={textY - bgPadding}
          width={textWidth + bgPadding * 2}
          height={textHeight + bgPadding * 2}
          fill={isClickable ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)'}
          cornerRadius={3}
          stroke={isClickable ? 'rgba(245,158,11,0.4)' : undefined}
          strokeWidth={isClickable ? 0.5 : 0}
          listening={isClickable}
          onMouseDown={(e) => {
            if (onClick) {
              e.cancelBubble = true;
              const pos = getScreenPos(e, textWidth / 2 + bgPadding, textHeight / 2 + bgPadding);
              onClick(pos.screenX, pos.screenY);
            }
          }}
          onTouchStart={(e) => {
            if (onClick) {
              e.cancelBubble = true;
              const pos = getScreenPos(e, textWidth / 2 + bgPadding, textHeight / 2 + bgPadding);
              onClick(pos.screenX, pos.screenY);
            }
          }}
          hitStrokeWidth={12}
        />
        {/* 数值文字 */}
        <Text
          x={textX}
          y={textY}
          text={text}
          fontSize={11}
          fontFamily="JetBrains Mono, monospace"
          fill={isClickable ? '#ffffff' : COLORS.dimensionText}
          align="center"
          width={textWidth}
          listening={false}
        />
      </Group>
    );
  }

  // Vertical direction
  const textX = midX + 4;
  const textY = midY - textHeight / 2;

  return (
    <Group>
      {/* 主标注线 */}
      <Line
        points={[x1, y1, x2, y2]}
        stroke={COLORS.dimension}
        strokeWidth={0.8}
        listening={false}
      />
      {/* 上端刻度 */}
      <Line
        points={[x1 - TICK_SIZE / 2, y1, x1 + TICK_SIZE / 2, y1]}
        stroke={COLORS.dimension}
        strokeWidth={0.8}
        listening={false}
      />
      {/* 下端刻度 */}
      <Line
        points={[x2 - TICK_SIZE / 2, y2, x2 + TICK_SIZE / 2, y2]}
        stroke={COLORS.dimension}
        strokeWidth={0.8}
        listening={false}
      />
      {/* 数值背景（点击热区） */}
      <Rect
        name="dimension-label"
        x={textX - bgPadding}
        y={textY - bgPadding}
        width={textWidth + bgPadding * 2}
        height={textHeight + bgPadding * 2}
        fill={isClickable ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)'}
        cornerRadius={3}
        stroke={isClickable ? 'rgba(245,158,11,0.4)' : undefined}
        strokeWidth={isClickable ? 0.5 : 0}
        listening={isClickable}
        onMouseDown={(e) => {
          if (onClick) {
            e.cancelBubble = true;
            const pos = getScreenPos(e, textWidth / 2 + bgPadding, textHeight / 2 + bgPadding);
            onClick(pos.screenX, pos.screenY);
          }
        }}
        onTouchStart={(e) => {
          if (onClick) {
            e.cancelBubble = true;
            const pos = getScreenPos(e, textWidth / 2 + bgPadding, textHeight / 2 + bgPadding);
            onClick(pos.screenX, pos.screenY);
          }
        }}
        hitStrokeWidth={12}
      />
      {/* 数值文字 */}
      <Text
        x={textX}
        y={textY}
        text={text}
        fontSize={11}
        fontFamily="JetBrains Mono, monospace"
        fill={isClickable ? '#ffffff' : COLORS.dimensionText}
        listening={false}
      />
    </Group>
  );
}

/** 递归收集子分格的尺寸标注 */
function collectChildDimensions(
  opening: Opening,
  zoom: number,
  windowWidth: number,
  windowHeight: number,
  windowId: string,
  onDimensionClick?: DimensionRendererProps['onDimensionClick'],
): ReactElement[] {
  const elements: ReactElement[] = [];
  const scale = MM_TO_PX * zoom;
  const w = windowWidth * scale;
  const h = windowHeight * scale;

  if (opening.childOpenings.length > 0) {
    opening.childOpenings.forEach((child, i) => {
      const cx = child.rect.x * scale;
      const cw = child.rect.width * scale;
      const cy = child.rect.y * scale;
      const ch = child.rect.height * scale;

      // 底部标注子分格宽度
      if (opening.mullions.some((m) => m.type === 'vertical')) {
        elements.push(
          <DimensionLine
            key={`w-${child.id}`}
            x1={cx}
            y1={h + OFFSET}
            x2={cx + cw}
            y2={h + OFFSET}
            value={child.rect.width}
            direction="horizontal"
            onClick={onDimensionClick ? (screenX, screenY) => {
              onDimensionClick({
                windowId,
                dimensionType: 'opening-width',
                currentValue: Math.round(child.rect.width),
                screenX,
                screenY,
                openingId: child.id,
                childIndex: i,
              });
            } : undefined}
          />
        );
      }

      // 右侧标注子分格高度
      if (opening.mullions.some((m) => m.type === 'horizontal')) {
        elements.push(
          <DimensionLine
            key={`h-${child.id}`}
            x1={w + OFFSET}
            y1={cy}
            x2={w + OFFSET}
            y2={cy + ch}
            value={child.rect.height}
            direction="vertical"
            onClick={onDimensionClick ? (screenX, screenY) => {
              onDimensionClick({
                windowId,
                dimensionType: 'opening-height',
                currentValue: Math.round(child.rect.height),
                screenX,
                screenY,
                openingId: child.id,
                childIndex: i,
              });
            } : undefined}
          />
        );
      }

      // 递归处理更深层的子分格
      if (child.childOpenings.length > 0) {
        elements.push(
          ...collectChildDimensions(child, zoom, windowWidth, windowHeight, windowId, onDimensionClick)
        );
      }
    });
  }

  return elements;
}

/** 渲染窗户的尺寸标注 */
export default function DimensionRenderer({
  window: win,
  zoom,
  onDimensionClick,
  isSelected = true,
}: DimensionRendererProps) {
  const scale = MM_TO_PX * zoom;
  const w = win.width * scale;
  const h = win.height * scale;

  return (
    <Group>
      {/* 顶部宽度标注 - 始终显示 */}
      <DimensionLine
        x1={0}
        y1={-OFFSET}
        x2={w}
        y2={-OFFSET}
        value={win.width}
        direction="horizontal"
        onClick={onDimensionClick ? (screenX, screenY) => {
          onDimensionClick({
            windowId: win.id,
            dimensionType: 'window-width',
            currentValue: Math.round(win.width),
            screenX,
            screenY,
          });
        } : undefined}
      />

      {/* 左侧高度标注 - 始终显示 */}
      <DimensionLine
        x1={-OFFSET}
        y1={0}
        x2={-OFFSET}
        y2={h}
        value={win.height}
        direction="vertical"
        onClick={onDimensionClick ? (screenX, screenY) => {
          onDimensionClick({
            windowId: win.id,
            dimensionType: 'window-height',
            currentValue: Math.round(win.height),
            screenX,
            screenY,
          });
        } : undefined}
      />

      {/* 分格尺寸标注 - 始终显示 */}
      {win.frame.openings.map((opening) =>
        collectChildDimensions(opening, zoom, win.width, win.height, win.id, onDimensionClick)
      )}
    </Group>
  );
}
