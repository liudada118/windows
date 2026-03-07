// WindoorDesigner - L1 外框渲染组件
// 渲染窗户外框型材 - 四根框料通过45度斜切拼接
// 每根框料用梯形表示，角部有45度对角线
// 支持动态颜色配置

import { Group, Line, Shape } from 'react-konva';
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

/** 调整颜色亮度 */
function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xFF) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xFF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** 渲染窗户外框 - 45度斜切拼接 */
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

  const frameStroke = isSelected ? COLORS.selected : adjustBrightness(frameColor, -30);
  const frameFill = frameColor;
  const frameFillLight = adjustBrightness(frameColor, 15);
  const hatchStroke = adjustBrightness(frameColor, -15) + '22';
  const strokeWidth = isSelected ? 2 : 1.2;

  // 生成斜线填充 - 用于每根框料
  const hatchLines = useMemo(() => {
    const spacing = Math.max(4, 5 * zoom);
    const topLines: number[][] = [];
    const bottomLines: number[][] = [];
    const leftLines: number[][] = [];
    const rightLines: number[][] = [];

    // 上边框斜线
    for (let i = -pw * 2; i < w + pw * 2; i += spacing) {
      topLines.push([i, 0, i + pw, pw]);
    }
    // 下边框斜线
    for (let i = -pw * 2; i < w + pw * 2; i += spacing) {
      bottomLines.push([i, h - pw, i + pw, h]);
    }
    // 左边框斜线
    for (let i = -h; i < h + pw; i += spacing) {
      leftLines.push([0, i, pw, i + pw]);
    }
    // 右边框斜线
    for (let i = -h; i < h + pw; i += spacing) {
      rightLines.push([w - pw, i, w, i + pw]);
    }

    return { topLines, bottomLines, leftLines, rightLines };
  }, [w, h, pw, zoom]);

  return (
    <Group>
      {/* === 上边框（梯形） === */}
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(0, 0);
          context.lineTo(w, 0);
          context.lineTo(w - pw, pw);
          context.lineTo(pw, pw);
          context.closePath();
          context.fillStrokeShape(shape);
        }}
        fill={frameFill}
        listening={false}
      />
      {/* 上边框斜线填充 */}
      <Group
        clipFunc={(ctx: any) => {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(w, 0);
          ctx.lineTo(w - pw, pw);
          ctx.lineTo(pw, pw);
          ctx.closePath();
        }}
      >
        {hatchLines.topLines.map((pts, i) => (
          <Line key={`th${i}`} points={pts} stroke={hatchStroke} strokeWidth={0.6} listening={false} />
        ))}
      </Group>
      {/* 上边框描边 */}
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(0, 0);
          context.lineTo(w, 0);
          context.lineTo(w - pw, pw);
          context.lineTo(pw, pw);
          context.closePath();
          context.strokeShape(shape);
        }}
        stroke={frameStroke}
        strokeWidth={strokeWidth}
        listening={false}
      />

      {/* === 下边框（梯形） === */}
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(pw, h - pw);
          context.lineTo(w - pw, h - pw);
          context.lineTo(w, h);
          context.lineTo(0, h);
          context.closePath();
          context.fillStrokeShape(shape);
        }}
        fill={frameFill}
        listening={false}
      />
      <Group
        clipFunc={(ctx: any) => {
          ctx.beginPath();
          ctx.moveTo(pw, h - pw);
          ctx.lineTo(w - pw, h - pw);
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.closePath();
        }}
      >
        {hatchLines.bottomLines.map((pts, i) => (
          <Line key={`bh${i}`} points={pts} stroke={hatchStroke} strokeWidth={0.6} listening={false} />
        ))}
      </Group>
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(pw, h - pw);
          context.lineTo(w - pw, h - pw);
          context.lineTo(w, h);
          context.lineTo(0, h);
          context.closePath();
          context.strokeShape(shape);
        }}
        stroke={frameStroke}
        strokeWidth={strokeWidth}
        listening={false}
      />

      {/* === 左边框（梯形） === */}
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(0, 0);
          context.lineTo(pw, pw);
          context.lineTo(pw, h - pw);
          context.lineTo(0, h);
          context.closePath();
          context.fillStrokeShape(shape);
        }}
        fill={frameFill}
        listening={false}
      />
      <Group
        clipFunc={(ctx: any) => {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(pw, pw);
          ctx.lineTo(pw, h - pw);
          ctx.lineTo(0, h);
          ctx.closePath();
        }}
      >
        {hatchLines.leftLines.map((pts, i) => (
          <Line key={`lh${i}`} points={pts} stroke={hatchStroke} strokeWidth={0.6} listening={false} />
        ))}
      </Group>
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(0, 0);
          context.lineTo(pw, pw);
          context.lineTo(pw, h - pw);
          context.lineTo(0, h);
          context.closePath();
          context.strokeShape(shape);
        }}
        stroke={frameStroke}
        strokeWidth={strokeWidth}
        listening={false}
      />

      {/* === 右边框（梯形） === */}
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(w, 0);
          context.lineTo(w, h);
          context.lineTo(w - pw, h - pw);
          context.lineTo(w - pw, pw);
          context.closePath();
          context.fillStrokeShape(shape);
        }}
        fill={frameFill}
        listening={false}
      />
      <Group
        clipFunc={(ctx: any) => {
          ctx.beginPath();
          ctx.moveTo(w, 0);
          ctx.lineTo(w, h);
          ctx.lineTo(w - pw, h - pw);
          ctx.lineTo(w - pw, pw);
          ctx.closePath();
        }}
      >
        {hatchLines.rightLines.map((pts, i) => (
          <Line key={`rh${i}`} points={pts} stroke={hatchStroke} strokeWidth={0.6} listening={false} />
        ))}
      </Group>
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(w, 0);
          context.lineTo(w, h);
          context.lineTo(w - pw, h - pw);
          context.lineTo(w - pw, pw);
          context.closePath();
          context.strokeShape(shape);
        }}
        stroke={frameStroke}
        strokeWidth={strokeWidth}
        listening={false}
      />

      {/* === 45度拼接对角线（四个角） === */}
      {/* 左上角 */}
      <Line
        points={[0, 0, pw, pw]}
        stroke={frameStroke}
        strokeWidth={strokeWidth}
        listening={false}
      />
      {/* 右上角 */}
      <Line
        points={[w, 0, w - pw, pw]}
        stroke={frameStroke}
        strokeWidth={strokeWidth}
        listening={false}
      />
      {/* 左下角 */}
      <Line
        points={[0, h, pw, h - pw]}
        stroke={frameStroke}
        strokeWidth={strokeWidth}
        listening={false}
      />
      {/* 右下角 */}
      <Line
        points={[w, h, w - pw, h - pw]}
        stroke={frameStroke}
        strokeWidth={strokeWidth}
        listening={false}
      />

      {/* 选中时的辉光效果 */}
      {isSelected && (
        <Shape
          sceneFunc={(context, shape) => {
            context.beginPath();
            context.rect(0, 0, w, h);
            context.strokeShape(shape);
          }}
          stroke={COLORS.selectedGlow}
          strokeWidth={6}
          listening={false}
          opacity={0.3}
        />
      )}
    </Group>
  );
}
