// WindoorDesigner - L2 玻璃区域渲染组件
// 渲染蓝色半透明玻璃填充（参考专业门窗软件风格）
// 支持动态颜色配置

import { Group, Rect, Line } from 'react-konva';
import type { Rect as RectType } from '@windoor/shared';
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
  const glassColor = materialConfig?.colors?.glassColor || '#87CEEB';
  const glassTint = materialConfig?.colors?.glassTint ?? 0.35;

  const scale = MM_TO_PX * zoom;
  const x = rect.x * scale;
  const y = rect.y * scale;
  const w = rect.width * scale;
  const h = rect.height * scale;

  // 更饱和的蓝色玻璃效果
  const glassFill = isHovered
    ? 'rgba(245, 158, 11, 0.08)'
    : hexToRgba(glassColor, glassTint);
  const glassBorder = hexToRgba(glassColor, Math.min(1, glassTint * 2));

  return (
    <Group>
      {/* 玻璃半透明填充 - 蓝色 */}
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={glassFill}
      />

      {/* 玻璃内部高光效果 */}
      <Rect
        x={x + 2}
        y={y + 2}
        width={Math.max(0, w - 4)}
        height={Math.max(0, h - 4)}
        fill="rgba(255, 255, 255, 0.06)"
        listening={false}
      />

      {/* 玻璃边框 */}
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        stroke={glassBorder}
        strokeWidth={0.8}
        listening={false}
      />
    </Group>
  );
}
