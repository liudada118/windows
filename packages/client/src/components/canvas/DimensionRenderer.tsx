// WindoorDesigner - L4 尺寸标注渲染组件
// 渲染外框尺寸和分格尺寸标注线

import { Group, Line, Text } from 'react-konva';
import type { WindowUnit, Opening } from '@windoor/shared';
import { COLORS } from '@/lib/constants';

interface DimensionRendererProps {
  window: WindowUnit;
  zoom: number;
}

const MM_TO_PX = 0.5;
const OFFSET = 25; // 标注线到外框的距离 (px)
const TICK_SIZE = 6; // 标注线端点刻度长度 (px)

/** 渲染单条尺寸标注 */
function DimensionLine({
  x1,
  y1,
  x2,
  y2,
  value,
  direction,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  value: number;
  direction: 'horizontal' | 'vertical';
}) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const text = `${Math.round(value)}`;

  if (direction === 'horizontal') {
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
        {/* 数值文字 */}
        <Text
          x={midX - 20}
          y={midY - 14}
          text={text}
          fontSize={11}
          fontFamily="JetBrains Mono, monospace"
          fill={COLORS.dimensionText}
          align="center"
          width={40}
          listening={false}
        />
      </Group>
    );
  }

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
      {/* 数值文字 */}
      <Text
        x={midX + 4}
        y={midY - 6}
        text={text}
        fontSize={11}
        fontFamily="JetBrains Mono, monospace"
        fill={COLORS.dimensionText}
        listening={false}
      />
    </Group>
  );
}

/** 递归收集叶子 Opening 的尺寸标注 */
function collectOpeningDimensions(
  opening: Opening,
  zoom: number,
  offsetY: number
): JSX.Element[] {
  const elements: JSX.Element[] = [];
  const scale = MM_TO_PX * zoom;

  if (opening.childOpenings.length > 0) {
    // 渲染子 Opening 的分格尺寸
    for (const child of opening.childOpenings) {
      elements.push(...collectOpeningDimensions(child, zoom, offsetY));
    }
  }

  return elements;
}

/** 渲染窗户的尺寸标注 */
export default function DimensionRenderer({ window: win, zoom }: DimensionRendererProps) {
  const scale = MM_TO_PX * zoom;
  const w = win.width * scale;
  const h = win.height * scale;

  return (
    <Group>
      {/* 顶部宽度标注 */}
      <DimensionLine
        x1={0}
        y1={-OFFSET}
        x2={w}
        y2={-OFFSET}
        value={win.width}
        direction="horizontal"
      />

      {/* 左侧高度标注 */}
      <DimensionLine
        x1={-OFFSET}
        y1={0}
        x2={-OFFSET}
        y2={h}
        value={win.height}
        direction="vertical"
      />

      {/* 分格尺寸标注 */}
      {win.frame.openings.map((opening) => {
        const elements: JSX.Element[] = [];

        // 如果有子分格，标注每个子分格的宽度
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
                />
              );
            }
          });
        }

        return elements;
      })}
    </Group>
  );
}
