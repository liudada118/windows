// WindoorDesigner - L1 中梃渲染组件
// 渲染中梃型材矩形 + 45° 斜线填充

import { Group, Rect, Line } from 'react-konva';
import { useMemo } from 'react';
import type { Mullion, Rect as RectType } from '@windoor/shared';
import { COLORS } from '@/lib/constants';

interface MullionRendererProps {
  mullion: Mullion;
  parentRect: RectType;
  zoom: number;
  isSelected?: boolean;
  isDragging?: boolean;
}

const MM_TO_PX = 0.5;

/** 渲染中梃 */
export default function MullionRenderer({
  mullion,
  parentRect,
  zoom,
  isSelected,
  isDragging,
}: MullionRendererProps) {
  const scale = MM_TO_PX * zoom;
  const halfWidth = (mullion.profileWidth / 2) * scale;

  let x: number, y: number, w: number, h: number;

  if (mullion.type === 'vertical') {
    x = mullion.position * scale - halfWidth;
    y = parentRect.y * scale;
    w = mullion.profileWidth * scale;
    h = parentRect.height * scale;
  } else {
    x = parentRect.x * scale;
    y = mullion.position * scale - halfWidth;
    w = parentRect.width * scale;
    h = mullion.profileWidth * scale;
  }

  // 斜线填充
  const hatchLines = useMemo(() => {
    const lines: number[][] = [];
    const spacing = Math.max(4, 5 * zoom);
    const maxDim = Math.max(w, h);

    for (let i = -maxDim; i < maxDim * 2; i += spacing) {
      if (mullion.type === 'vertical') {
        lines.push([x + i, y, x + i + h, y + h]);
      } else {
        lines.push([x + i, y, x + i + w, y + w]);
      }
    }
    return lines;
  }, [x, y, w, h, zoom, mullion.type]);

  const strokeColor = isDragging
    ? '#FF3B30'
    : isSelected
    ? COLORS.selected
    : COLORS.mullionStroke;

  return (
    <Group>
      {/* 中梃背景 */}
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={COLORS.frameFill}
      />

      {/* 斜线填充 */}
      {hatchLines.map((points, i) => (
        <Line
          key={i}
          points={points}
          stroke={COLORS.frameHatch}
          strokeWidth={0.6}
          listening={false}
        />
      ))}

      {/* 中梃描边 */}
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        stroke={strokeColor}
        strokeWidth={isSelected ? 2 : 1.5}
      />
    </Group>
  );
}
