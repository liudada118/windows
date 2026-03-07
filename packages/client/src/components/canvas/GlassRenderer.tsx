// WindoorDesigner - L2 玻璃区域渲染组件
// 渲染蓝色半透明玻璃填充 + 玻璃压线框
// 玻璃压线框是包裹玻璃的细框（约 15-20mm）
// 支持动态颜色配置

import { Group, Rect, Line, Shape } from 'react-konva';
import type { Rect as RectType } from '@windoor/shared';
import { useDesignStore } from '@/stores/designStore';

interface GlassRendererProps {
  rect: RectType;
  zoom: number;
  isHovered?: boolean;
  /** 是否有扇框（有扇框时玻璃压线在扇框内部） */
  hasSashFrame?: boolean;
  /** 扇框宽度（mm），用于计算玻璃实际区域 */
  sashProfileWidth?: number;
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

/** 调整颜色亮度 */
function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xFF) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xFF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** 渲染玻璃区域 + 玻璃压线框 */
export default function GlassRenderer({
  rect,
  zoom,
  isHovered,
  hasSashFrame = false,
  sashProfileWidth = 0,
}: GlassRendererProps) {
  const materialConfig = useDesignStore((s) => s.designData.materialConfig);
  const glassColor = materialConfig?.colors?.glassColor || '#87CEEB';
  const glassTint = materialConfig?.colors?.glassTint ?? 0.35;
  const frameColor = materialConfig?.colors?.frameColor || '#4A4A4A';

  const scale = MM_TO_PX * zoom;

  // 如果有扇框，玻璃区域需要内缩扇框宽度
  const sashPw = hasSashFrame ? sashProfileWidth * scale : 0;
  const x = rect.x * scale + sashPw;
  const y = rect.y * scale + sashPw;
  const w = rect.width * scale - sashPw * 2;
  const h = rect.height * scale - sashPw * 2;

  if (w <= 0 || h <= 0) return null;

  // 玻璃压线宽度（约 15mm）
  const glazingBeadWidth = 15 * scale;
  const gbw = Math.min(glazingBeadWidth, w * 0.15, h * 0.15);

  // 颜色
  const glassFill = isHovered
    ? 'rgba(245, 158, 11, 0.08)'
    : hexToRgba(glassColor, glassTint);
  const glassBorder = hexToRgba(glassColor, Math.min(1, glassTint * 2));
  const beadColor = adjustBrightness(frameColor, 20); // 压线颜色比框稍亮
  const beadStroke = adjustBrightness(frameColor, -10);

  return (
    <Group>
      {/* 玻璃压线框区域（整个区域先填充压线颜色） */}
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={beadColor}
        listening={false}
      />

      {/* 玻璃压线框描边 */}
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        stroke={beadStroke}
        strokeWidth={0.8}
        listening={false}
      />

      {/* 玻璃压线 45 度对角线（四个角） */}
      <Line points={[x, y, x + gbw, y + gbw]} stroke={beadStroke} strokeWidth={0.6} listening={false} />
      <Line points={[x + w, y, x + w - gbw, y + gbw]} stroke={beadStroke} strokeWidth={0.6} listening={false} />
      <Line points={[x, y + h, x + gbw, y + h - gbw]} stroke={beadStroke} strokeWidth={0.6} listening={false} />
      <Line points={[x + w, y + h, x + w - gbw, y + h - gbw]} stroke={beadStroke} strokeWidth={0.6} listening={false} />

      {/* 内框线（玻璃实际边界） */}
      <Rect
        x={x + gbw}
        y={y + gbw}
        width={Math.max(0, w - gbw * 2)}
        height={Math.max(0, h - gbw * 2)}
        stroke={beadStroke}
        strokeWidth={0.6}
        listening={false}
      />

      {/* 玻璃半透明填充 - 蓝色（在压线框内部） */}
      <Rect
        x={x + gbw}
        y={y + gbw}
        width={Math.max(0, w - gbw * 2)}
        height={Math.max(0, h - gbw * 2)}
        fill={glassFill}
        listening={false}
      />

      {/* 玻璃内部高光效果 */}
      <Rect
        x={x + gbw + 2}
        y={y + gbw + 2}
        width={Math.max(0, w - gbw * 2 - 4)}
        height={Math.max(0, h - gbw * 2 - 4)}
        fill="rgba(255, 255, 255, 0.06)"
        listening={false}
      />
    </Group>
  );
}
