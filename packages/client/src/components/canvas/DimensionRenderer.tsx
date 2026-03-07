// WindoorDesigner - L4 尺寸标注渲染组件
// 多层尺寸标注系统：外框总尺寸 + 分格外框尺寸 + 分格内空尺寸
// 参考专业门窗软件标注风格
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
const LAYER_GAP = 22;  // 多层标注之间的间距 (px)
const TICK_SIZE = 6;   // 标注线端点刻度长度 (px)
const BASE_OFFSET = 20; // 第一层标注到外框的距离 (px)

// 标注线颜色 - 蓝色系（参考专业门窗软件）
const DIM_LINE_COLOR = '#4A90D9';
const DIM_TEXT_COLOR = '#1a1a1a';
const DIM_TEXT_BOLD_COLOR = '#000000';
const DIM_BG_COLOR = 'rgba(255, 255, 255, 0.92)';
const DIM_BG_CLICKABLE = 'rgba(255, 255, 255, 0.95)';
const DIM_BORDER_CLICKABLE = 'rgba(74, 144, 217, 0.5)';

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
  x1, y1, x2, y2,
  value,
  direction,
  onClick,
  isBold = false,
  fontSize: customFontSize,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  value: number;
  direction: 'horizontal' | 'vertical';
  onClick?: (screenX: number, screenY: number) => void;
  isBold?: boolean;
  fontSize?: number;
}) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const text = `${Math.round(value)}`;
  const fontSize = customFontSize || (isBold ? 13 : 11);
  const textWidth = Math.max(36, text.length * (fontSize * 0.65) + 14);
  const textHeight = fontSize + 4;
  const bgPadding = 3;
  const isClickable = !!onClick;
  const textColor = isBold ? DIM_TEXT_BOLD_COLOR : DIM_TEXT_COLOR;
  const fontWeight = isBold ? 'bold' : 'normal';

  if (direction === 'horizontal') {
    const textX = midX - textWidth / 2;
    const textY = midY - textHeight / 2;

    return (
      <Group>
        {/* 左侧标注线段 */}
        <Line
          points={[x1, y1, textX - bgPadding - 2, y1]}
          stroke={DIM_LINE_COLOR}
          strokeWidth={0.8}
          listening={false}
        />
        {/* 右侧标注线段 */}
        <Line
          points={[textX + textWidth + bgPadding + 2, y2, x2, y2]}
          stroke={DIM_LINE_COLOR}
          strokeWidth={0.8}
          listening={false}
        />
        {/* 左端刻度 */}
        <Line
          points={[x1, y1 - TICK_SIZE / 2, x1, y1 + TICK_SIZE / 2]}
          stroke={DIM_LINE_COLOR}
          strokeWidth={0.8}
          listening={false}
        />
        {/* 右端刻度 */}
        <Line
          points={[x2, y2 - TICK_SIZE / 2, x2, y2 + TICK_SIZE / 2]}
          stroke={DIM_LINE_COLOR}
          strokeWidth={0.8}
          listening={false}
        />
        {/* 数值背景 */}
        <Rect
          name="dimension-label"
          x={textX - bgPadding}
          y={textY - bgPadding}
          width={textWidth + bgPadding * 2}
          height={textHeight + bgPadding * 2}
          fill={isClickable ? DIM_BG_CLICKABLE : DIM_BG_COLOR}
          cornerRadius={2}
          stroke={isClickable ? DIM_BORDER_CLICKABLE : undefined}
          strokeWidth={isClickable ? 0.8 : 0}
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
          fontSize={fontSize}
          fontStyle={fontWeight}
          fontFamily="Arial, sans-serif"
          fill={textColor}
          align="center"
          width={textWidth}
          listening={false}
        />
      </Group>
    );
  }

  // Vertical direction
  const textX = midX - textWidth / 2;
  const textY = midY - textHeight / 2;

  return (
    <Group>
      {/* 上方标注线段 */}
      <Line
        points={[x1, y1, x1, textY - bgPadding - 2]}
        stroke={DIM_LINE_COLOR}
        strokeWidth={0.8}
        listening={false}
      />
      {/* 下方标注线段 */}
      <Line
        points={[x2, textY + textHeight + bgPadding + 2, x2, y2]}
        stroke={DIM_LINE_COLOR}
        strokeWidth={0.8}
        listening={false}
      />
      {/* 上端刻度 */}
      <Line
        points={[x1 - TICK_SIZE / 2, y1, x1 + TICK_SIZE / 2, y1]}
        stroke={DIM_LINE_COLOR}
        strokeWidth={0.8}
        listening={false}
      />
      {/* 下端刻度 */}
      <Line
        points={[x2 - TICK_SIZE / 2, y2, x2 + TICK_SIZE / 2, y2]}
        stroke={DIM_LINE_COLOR}
        strokeWidth={0.8}
        listening={false}
      />
      {/* 数值背景 */}
      <Rect
        name="dimension-label"
        x={textX - bgPadding}
        y={textY - bgPadding}
        width={textWidth + bgPadding * 2}
        height={textHeight + bgPadding * 2}
        fill={isClickable ? DIM_BG_CLICKABLE : DIM_BG_COLOR}
        cornerRadius={2}
        stroke={isClickable ? DIM_BORDER_CLICKABLE : undefined}
        strokeWidth={isClickable ? 0.8 : 0}
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
        fontSize={fontSize}
        fontStyle={fontWeight}
        fontFamily="Arial, sans-serif"
        fill={textColor}
        align="center"
        width={textWidth}
        listening={false}
      />
    </Group>
  );
}

/** 渲染引出线（从标注层连接到窗户边缘） */
function ExtensionLine({
  x1, y1, x2, y2,
}: {
  x1: number; y1: number; x2: number; y2: number;
}) {
  return (
    <Line
      points={[x1, y1, x2, y2]}
      stroke={DIM_LINE_COLOR}
      strokeWidth={0.5}
      dash={[2, 2]}
      listening={false}
    />
  );
}

/** 递归收集子分格的尺寸标注（第二层：分格外框尺寸） */
function collectChildDimensions(
  opening: Opening,
  zoom: number,
  windowWidth: number,
  windowHeight: number,
  windowId: string,
  frameProfileWidth: number,
  onDimensionClick?: DimensionRendererProps['onDimensionClick'],
): ReactElement[] {
  const elements: ReactElement[] = [];
  const scale = MM_TO_PX * zoom;
  const w = windowWidth * scale;
  const h = windowHeight * scale;

  if (opening.childOpenings.length > 0) {
    const hasVerticalMullion = opening.mullions.some((m) => m.type === 'vertical');
    const hasHorizontalMullion = opening.mullions.some((m) => m.type === 'horizontal');

    opening.childOpenings.forEach((child, i) => {
      const cx = child.rect.x * scale;
      const cw = child.rect.width * scale;
      const cy = child.rect.y * scale;
      const ch = child.rect.height * scale;

      // ---- 底部标注子分格宽度（第二层：分格内空尺寸） ----
      if (hasVerticalMullion) {
        const layer2Y = h + BASE_OFFSET;
        elements.push(
          <DimensionLine
            key={`w-inner-${child.id}`}
            x1={cx}
            y1={layer2Y}
            x2={cx + cw}
            y2={layer2Y}
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

        // 引出线
        elements.push(
          <ExtensionLine key={`ext-bl-${child.id}`} x1={cx} y1={h} x2={cx} y2={layer2Y + TICK_SIZE / 2} />,
          <ExtensionLine key={`ext-br-${child.id}`} x1={cx + cw} y1={h} x2={cx + cw} y2={layer2Y + TICK_SIZE / 2} />,
        );
      }

      // ---- 右侧标注子分格高度（第二层：分格内空尺寸） ----
      if (hasHorizontalMullion) {
        const layer2X = w + BASE_OFFSET;
        elements.push(
          <DimensionLine
            key={`h-inner-${child.id}`}
            x1={layer2X}
            y1={cy}
            x2={layer2X}
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

        // 引出线
        elements.push(
          <ExtensionLine key={`ext-rt-${child.id}`} x1={w} y1={cy} x2={layer2X + TICK_SIZE / 2} y2={cy} />,
          <ExtensionLine key={`ext-rb-${child.id}`} x1={w} y1={cy + ch} x2={layer2X + TICK_SIZE / 2} y2={cy + ch} />,
        );
      }

      // 递归处理更深层的子分格
      if (child.childOpenings.length > 0) {
        elements.push(
          ...collectChildDimensions(child, zoom, windowWidth, windowHeight, windowId, frameProfileWidth, onDimensionClick)
        );
      }
    });
  }

  return elements;
}

/** 渲染窗户的尺寸标注 - 多层标注系统 */
export default function DimensionRenderer({
  window: win,
  zoom,
  onDimensionClick,
  isSelected = true,
}: DimensionRendererProps) {
  const scale = MM_TO_PX * zoom;
  const w = win.width * scale;
  const h = win.height * scale;
  const frameWidth = win.frame.profileWidth;

  // 检查是否有分格
  const rootOpening = win.frame.openings[0];
  const hasVerticalSplit = rootOpening?.childOpenings.length > 0 &&
    rootOpening.mullions.some(m => m.type === 'vertical');
  const hasHorizontalSplit = rootOpening?.childOpenings.length > 0 &&
    rootOpening.mullions.some(m => m.type === 'horizontal');

  // 计算各层标注位置
  // 顶部：第一层 = 分格内空宽度，第二层 = 总宽度
  // 底部：第一层 = 分格内空宽度
  // 左侧：第一层 = 分格内空高度，第二层 = 总高度
  // 右侧：第一层 = 分格内空高度

  const topLayer1Y = -BASE_OFFSET;                                    // 分格内空（如果有分格）
  const topLayer2Y = hasVerticalSplit ? -BASE_OFFSET - LAYER_GAP : -BASE_OFFSET; // 总宽度

  const leftLayer1X = -BASE_OFFSET;                                     // 分格内空（如果有分格）
  const leftLayer2X = hasHorizontalSplit ? -BASE_OFFSET - LAYER_GAP : -BASE_OFFSET; // 总高度

  return (
    <Group>
      {/* ===== 顶部标注 ===== */}

      {/* 第一层（靠近窗户）：分格内空宽度 */}
      {hasVerticalSplit && rootOpening.childOpenings.map((child, i) => {
        const cx = child.rect.x * scale;
        const cw = child.rect.width * scale;
        return (
          <Group key={`top-inner-${child.id}`}>
            <DimensionLine
              x1={cx}
              y1={topLayer1Y}
              x2={cx + cw}
              y2={topLayer1Y}
              value={child.rect.width}
              direction="horizontal"
              onClick={onDimensionClick ? (screenX, screenY) => {
                onDimensionClick({
                  windowId: win.id,
                  dimensionType: 'opening-width',
                  currentValue: Math.round(child.rect.width),
                  screenX,
                  screenY,
                  openingId: child.id,
                  childIndex: i,
                });
              } : undefined}
            />
            {/* 引出线 */}
            <ExtensionLine x1={cx} y1={0} x2={cx} y2={topLayer1Y - TICK_SIZE / 2} />
            <ExtensionLine x1={cx + cw} y1={0} x2={cx + cw} y2={topLayer1Y - TICK_SIZE / 2} />
          </Group>
        );
      })}

      {/* 第二层（远离窗户）：总宽度 */}
      <Group>
        <DimensionLine
          x1={0}
          y1={topLayer2Y}
          x2={w}
          y2={topLayer2Y}
          value={win.width}
          direction="horizontal"
          isBold={true}
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
        {/* 引出线 */}
        <ExtensionLine x1={0} y1={0} x2={0} y2={topLayer2Y - TICK_SIZE / 2} />
        <ExtensionLine x1={w} y1={0} x2={w} y2={topLayer2Y - TICK_SIZE / 2} />
      </Group>

      {/* ===== 左侧标注 ===== */}

      {/* 第一层（靠近窗户）：分格内空高度 */}
      {hasHorizontalSplit && rootOpening.childOpenings.map((child, i) => {
        const cy = child.rect.y * scale;
        const ch = child.rect.height * scale;
        return (
          <Group key={`left-inner-${child.id}`}>
            <DimensionLine
              x1={leftLayer1X}
              y1={cy}
              x2={leftLayer1X}
              y2={cy + ch}
              value={child.rect.height}
              direction="vertical"
              onClick={onDimensionClick ? (screenX, screenY) => {
                onDimensionClick({
                  windowId: win.id,
                  dimensionType: 'opening-height',
                  currentValue: Math.round(child.rect.height),
                  screenX,
                  screenY,
                  openingId: child.id,
                  childIndex: i,
                });
              } : undefined}
            />
            {/* 引出线 */}
            <ExtensionLine x1={0} y1={cy} x2={leftLayer1X - TICK_SIZE / 2} y2={cy} />
            <ExtensionLine x1={0} y1={cy + ch} x2={leftLayer1X - TICK_SIZE / 2} y2={cy + ch} />
          </Group>
        );
      })}

      {/* 第二层（远离窗户）：总高度 */}
      <Group>
        <DimensionLine
          x1={leftLayer2X}
          y1={0}
          x2={leftLayer2X}
          y2={h}
          value={win.height}
          direction="vertical"
          isBold={true}
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
        {/* 引出线 */}
        <ExtensionLine x1={0} y1={0} x2={leftLayer2X - TICK_SIZE / 2} y2={0} />
        <ExtensionLine x1={0} y1={h} x2={leftLayer2X - TICK_SIZE / 2} y2={h} />
      </Group>

      {/* ===== 底部标注（分格内空宽度 - 如果有竖向分格） ===== */}
      {hasVerticalSplit && rootOpening.childOpenings.map((child, i) => {
        const cx = child.rect.x * scale;
        const cw = child.rect.width * scale;
        const bottomY = h + BASE_OFFSET;
        return (
          <Group key={`bottom-inner-${child.id}`}>
            <DimensionLine
              x1={cx}
              y1={bottomY}
              x2={cx + cw}
              y2={bottomY}
              value={child.rect.width}
              direction="horizontal"
              onClick={onDimensionClick ? (screenX, screenY) => {
                onDimensionClick({
                  windowId: win.id,
                  dimensionType: 'opening-width',
                  currentValue: Math.round(child.rect.width),
                  screenX,
                  screenY,
                  openingId: child.id,
                  childIndex: i,
                });
              } : undefined}
            />
            {/* 引出线 */}
            <ExtensionLine x1={cx} y1={h} x2={cx} y2={bottomY + TICK_SIZE / 2} />
            <ExtensionLine x1={cx + cw} y1={h} x2={cx + cw} y2={bottomY + TICK_SIZE / 2} />
          </Group>
        );
      })}

      {/* ===== 右侧标注（分格内空高度 - 如果有横向分格） ===== */}
      {hasHorizontalSplit && rootOpening.childOpenings.map((child, i) => {
        const cy = child.rect.y * scale;
        const ch = child.rect.height * scale;
        const rightX = w + BASE_OFFSET;
        return (
          <Group key={`right-inner-${child.id}`}>
            <DimensionLine
              x1={rightX}
              y1={cy}
              x2={rightX}
              y2={cy + ch}
              value={child.rect.height}
              direction="vertical"
              onClick={onDimensionClick ? (screenX, screenY) => {
                onDimensionClick({
                  windowId: win.id,
                  dimensionType: 'opening-height',
                  currentValue: Math.round(child.rect.height),
                  screenX,
                  screenY,
                  openingId: child.id,
                  childIndex: i,
                });
              } : undefined}
            />
            {/* 引出线 */}
            <ExtensionLine x1={w} y1={cy} x2={rightX + TICK_SIZE / 2} y2={cy} />
            <ExtensionLine x1={w} y1={cy + ch} x2={rightX + TICK_SIZE / 2} y2={cy + ch} />
          </Group>
        );
      })}

      {/* ===== 递归处理更深层的子分格 ===== */}
      {rootOpening?.childOpenings.map((child) => {
        if (child.childOpenings.length > 0) {
          return collectChildDimensions(
            child, zoom, win.width, win.height, win.id, frameWidth, onDimensionClick
          );
        }
        return null;
      })}
    </Group>
  );
}
