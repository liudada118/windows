// WindoorDesigner - L2 玻璃区域渲染组件
// 渲染半透明玻璃填充 + 对角交叉线（X）

import { Group, Rect, Line } from 'react-konva';
import type { Rect as RectType } from '@windoor/shared';
import { COLORS } from '@/lib/constants';

interface GlassRendererProps {
  rect: RectType;
  zoom: number;
  isHovered?: boolean;
}

const MM_TO_PX = 0.5;

/** 渲染玻璃区域 */
export default function GlassRenderer({ rect, zoom, isHovered }: GlassRendererProps) {
  const scale = MM_TO_PX * zoom;
  const x = rect.x * scale;
  const y = rect.y * scale;
  const w = rect.width * scale;
  const h = rect.height * scale;

  return (
    <Group>
      {/* 玻璃半透明填充 */}
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={isHovered ? 'rgba(245, 158, 11, 0.08)' : COLORS.glass}
      />

      {/* 对角交叉线 (X) */}
      <Line
        points={[x, y, x + w, y + h]}
        stroke={COLORS.glassCross}
        strokeWidth={0.5}
        listening={false}
      />
      <Line
        points={[x + w, y, x, y + h]}
        stroke={COLORS.glassCross}
        strokeWidth={0.5}
        listening={false}
      />

      {/* 玻璃边框 */}
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        stroke={COLORS.glassBorder}
        strokeWidth={0.5}
        listening={false}
      />
    </Group>
  );
}
