// WindoorDesigner - L2 玻璃区域渲染组件
// 渲染半透明玻璃填充 + 对角交叉线（X）
// 支持动态颜色配置

import { Group, Rect, Line } from 'react-konva';
import type { Rect as RectType } from '@windoor/shared';
import { COLORS } from '@/lib/constants';
import { useDesignStore } from '@/stores/designStore';

interface GlassRendererProps {
  rect: RectType;
  zoom: number;
  isHovered?: boolean;
}

const MM_TO_PX = 0.5;

/** 将 hex 颜色转为 rgba */
function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xFF;
  const g = (num >> 8) & 0xFF;
  const b = num & 0xFF;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 渲染玻璃区域 */
export default function GlassRenderer({ rect, zoom, isHovered }: GlassRendererProps) {
  const materialConfig = useDesignStore((s) => s.designData.materialConfig);
  const glassColor = materialConfig?.colors?.glassColor || '#ADD8E6';
  const glassTint = materialConfig?.colors?.glassTint ?? 0.2;

  const scale = MM_TO_PX * zoom;
  const x = rect.x * scale;
  const y = rect.y * scale;
  const w = rect.width * scale;
  const h = rect.height * scale;

  const glassFill = hexToRgba(glassColor, glassTint);
  const glassCross = hexToRgba(glassColor, glassTint * 0.6);
  const glassBorder = hexToRgba(glassColor, glassTint * 1.5);

  return (
    <Group>
      {/* 玻璃半透明填充 */}
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={isHovered ? 'rgba(245, 158, 11, 0.08)' : glassFill}
      />

      {/* 对角交叉线 (X) */}
      <Line
        points={[x, y, x + w, y + h]}
        stroke={glassCross}
        strokeWidth={0.5}
        listening={false}
      />
      <Line
        points={[x + w, y, x, y + h]}
        stroke={glassCross}
        strokeWidth={0.5}
        listening={false}
      />

      {/* 玻璃边框 */}
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        stroke={glassBorder}
        strokeWidth={0.5}
        listening={false}
      />
    </Group>
  );
}
