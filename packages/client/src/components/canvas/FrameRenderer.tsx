// WindoorDesigner - L1 外框渲染组件
// 渲染窗户外框型材（矩形 + 45° 斜线填充）
// 支持动态颜色配置

import { Group, Rect, Line } from 'react-konva';
import { useMemo } from 'react';
import type { Frame } from '@windoor/shared';
import { COLORS } from '@/lib/constants';
import { useDesignStore } from '@/stores/designStore';

interface FrameRendererProps {
  frame: Frame;
  windowWidth: number;
  windowHeight: number;
  isSelected: boolean;
  zoom: number;
}

const MM_TO_PX = 0.5;

/** 渲染窗户外框 */
export default function FrameRenderer({
  frame,
  windowWidth,
  windowHeight,
  isSelected,
  zoom,
}: FrameRendererProps) {
  const materialConfig = useDesignStore((s) => s.designData.materialConfig);
  const frameColor = materialConfig?.colors?.frameColor || '#4A4A4A';

  const scale = MM_TO_PX * zoom;
  const pw = frame.profileWidth * scale;
  const w = windowWidth * scale;
  const h = windowHeight * scale;

  // 生成斜线填充
  const hatchLines = useMemo(() => {
    const lines: number[][] = [];
    const spacing = Math.max(4, 5 * zoom);

    // 上边框斜线
    for (let i = -pw; i < w + pw; i += spacing) {
      lines.push([i, 0, i + pw, pw]);
    }
    // 下边框斜线
    for (let i = -pw; i < w + pw; i += spacing) {
      lines.push([i, h - pw, i + pw, h]);
    }
    // 左边框斜线
    for (let i = -h; i < h; i += spacing) {
      lines.push([0, i, pw, i + pw]);
    }
    // 右边框斜线
    for (let i = -h; i < h; i += spacing) {
      lines.push([w - pw, i, w, i + pw]);
    }

    return lines;
  }, [w, h, pw, zoom]);

  // 根据框色计算填充色和描边色
  const frameFill = frameColor;
  const frameStroke = isSelected ? COLORS.selected : adjustBrightness(frameColor, -30);
  const hatchStroke = adjustBrightness(frameColor, -15) + '18';

  return (
    <Group>
      {/* 外框背景填充 */}
      <Rect
        x={0}
        y={0}
        width={w}
        height={h}
        fill={frameFill}
        shadowColor={isSelected ? COLORS.selectedGlow : 'rgba(0,0,0,0.15)'}
        shadowBlur={isSelected ? 16 : 8}
        shadowOffsetY={2}
      />

      {/* 内部空白区域 */}
      <Rect
        x={pw}
        y={pw}
        width={w - pw * 2}
        height={h - pw * 2}
        fill="#edf0f4"
      />

      {/* 斜线填充 */}
      {hatchLines.map((points, i) => (
        <Line
          key={i}
          points={points}
          stroke={hatchStroke}
          strokeWidth={0.6}
          listening={false}
        />
      ))}

      {/* 外框描边 */}
      <Rect
        x={0}
        y={0}
        width={w}
        height={h}
        stroke={frameStroke}
        strokeWidth={isSelected ? 2.5 : 1.5}
        listening={false}
      />

      {/* 内框描边 */}
      <Rect
        x={pw}
        y={pw}
        width={w - pw * 2}
        height={h - pw * 2}
        stroke={isSelected ? COLORS.selected : adjustBrightness(frameColor, -20)}
        strokeWidth={isSelected ? 1.5 : 1}
        listening={false}
      />
    </Group>
  );
}

/** 调整颜色亮度 */
function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xFF) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xFF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
