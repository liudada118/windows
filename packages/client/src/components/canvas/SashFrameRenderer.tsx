// WindoorDesigner - 扇框渲染组件
// 渲染开启扇的框料 - 四根扇框通过45度斜切拼接
// 扇框在外框内部，包裹玻璃区域

import { Group, Line, Shape } from 'react-konva';
import { useMemo } from 'react';
import type { Sash } from '@windoor/shared';
import { COLORS } from '@/lib/constants';
import { useDesignStore } from '@/stores/designStore';

interface SashFrameRendererProps {
  sash: Sash;
  zoom: number;
  isSelected?: boolean;
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

/** 渲染扇框 - 45度斜切拼接 */
export default function SashFrameRenderer({
  sash,
  zoom,
  isSelected,
}: SashFrameRendererProps) {
  const materialConfig = useDesignStore((s) => s.designData.materialConfig);
  const sashColor = materialConfig?.colors?.sashColor || '#4A4A4A';

  const scale = MM_TO_PX * zoom;
  const rect = sash.rect;
  const ox = rect.x * scale;
  const oy = rect.y * scale;
  const ow = rect.width * scale;
  const oh = rect.height * scale;
  const pw = sash.profileWidth * scale;

  // 固定扇没有扇框
  if (sash.type === 'fixed') return null;

  const frameStroke = isSelected ? COLORS.selected : adjustBrightness(sashColor, -25);
  const frameFill = adjustBrightness(sashColor, 8); // 扇框比外框稍亮
  const hatchStroke = adjustBrightness(sashColor, -10) + '1A';
  const strokeWidth = isSelected ? 1.8 : 1.0;

  // 斜线填充
  const hatchLines = useMemo(() => {
    const spacing = Math.max(4, 5 * zoom);
    const topLines: number[][] = [];
    const bottomLines: number[][] = [];
    const leftLines: number[][] = [];
    const rightLines: number[][] = [];

    // 上边框斜线
    for (let i = -pw * 2; i < ow + pw * 2; i += spacing) {
      topLines.push([ox + i, oy, ox + i + pw, oy + pw]);
    }
    // 下边框斜线
    for (let i = -pw * 2; i < ow + pw * 2; i += spacing) {
      bottomLines.push([ox + i, oy + oh - pw, ox + i + pw, oy + oh]);
    }
    // 左边框斜线
    for (let i = -oh; i < oh + pw; i += spacing) {
      leftLines.push([ox, oy + i, ox + pw, oy + i + pw]);
    }
    // 右边框斜线
    for (let i = -oh; i < oh + pw; i += spacing) {
      rightLines.push([ox + ow - pw, oy + i, ox + ow, oy + i + pw]);
    }

    return { topLines, bottomLines, leftLines, rightLines };
  }, [ox, oy, ow, oh, pw, zoom]);

  return (
    <Group>
      {/* === 上扇框（梯形） === */}
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(ox, oy);
          context.lineTo(ox + ow, oy);
          context.lineTo(ox + ow - pw, oy + pw);
          context.lineTo(ox + pw, oy + pw);
          context.closePath();
          context.fillStrokeShape(shape);
        }}
        fill={frameFill}
        listening={false}
      />
      <Group
        clipFunc={(ctx: any) => {
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + ow, oy);
          ctx.lineTo(ox + ow - pw, oy + pw);
          ctx.lineTo(ox + pw, oy + pw);
          ctx.closePath();
        }}
      >
        {hatchLines.topLines.map((pts, i) => (
          <Line key={`sth${i}`} points={pts} stroke={hatchStroke} strokeWidth={0.5} listening={false} />
        ))}
      </Group>
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(ox, oy);
          context.lineTo(ox + ow, oy);
          context.lineTo(ox + ow - pw, oy + pw);
          context.lineTo(ox + pw, oy + pw);
          context.closePath();
          context.strokeShape(shape);
        }}
        stroke={frameStroke}
        strokeWidth={strokeWidth}
        listening={false}
      />

      {/* === 下扇框（梯形） === */}
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(ox + pw, oy + oh - pw);
          context.lineTo(ox + ow - pw, oy + oh - pw);
          context.lineTo(ox + ow, oy + oh);
          context.lineTo(ox, oy + oh);
          context.closePath();
          context.fillStrokeShape(shape);
        }}
        fill={frameFill}
        listening={false}
      />
      <Group
        clipFunc={(ctx: any) => {
          ctx.beginPath();
          ctx.moveTo(ox + pw, oy + oh - pw);
          ctx.lineTo(ox + ow - pw, oy + oh - pw);
          ctx.lineTo(ox + ow, oy + oh);
          ctx.lineTo(ox, oy + oh);
          ctx.closePath();
        }}
      >
        {hatchLines.bottomLines.map((pts, i) => (
          <Line key={`sbh${i}`} points={pts} stroke={hatchStroke} strokeWidth={0.5} listening={false} />
        ))}
      </Group>
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(ox + pw, oy + oh - pw);
          context.lineTo(ox + ow - pw, oy + oh - pw);
          context.lineTo(ox + ow, oy + oh);
          context.lineTo(ox, oy + oh);
          context.closePath();
          context.strokeShape(shape);
        }}
        stroke={frameStroke}
        strokeWidth={strokeWidth}
        listening={false}
      />

      {/* === 左扇框（梯形） === */}
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(ox, oy);
          context.lineTo(ox + pw, oy + pw);
          context.lineTo(ox + pw, oy + oh - pw);
          context.lineTo(ox, oy + oh);
          context.closePath();
          context.fillStrokeShape(shape);
        }}
        fill={frameFill}
        listening={false}
      />
      <Group
        clipFunc={(ctx: any) => {
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + pw, oy + pw);
          ctx.lineTo(ox + pw, oy + oh - pw);
          ctx.lineTo(ox, oy + oh);
          ctx.closePath();
        }}
      >
        {hatchLines.leftLines.map((pts, i) => (
          <Line key={`slh${i}`} points={pts} stroke={hatchStroke} strokeWidth={0.5} listening={false} />
        ))}
      </Group>
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(ox, oy);
          context.lineTo(ox + pw, oy + pw);
          context.lineTo(ox + pw, oy + oh - pw);
          context.lineTo(ox, oy + oh);
          context.closePath();
          context.strokeShape(shape);
        }}
        stroke={frameStroke}
        strokeWidth={strokeWidth}
        listening={false}
      />

      {/* === 右扇框（梯形） === */}
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(ox + ow, oy);
          context.lineTo(ox + ow, oy + oh);
          context.lineTo(ox + ow - pw, oy + oh - pw);
          context.lineTo(ox + ow - pw, oy + pw);
          context.closePath();
          context.fillStrokeShape(shape);
        }}
        fill={frameFill}
        listening={false}
      />
      <Group
        clipFunc={(ctx: any) => {
          ctx.beginPath();
          ctx.moveTo(ox + ow, oy);
          ctx.lineTo(ox + ow, oy + oh);
          ctx.lineTo(ox + ow - pw, oy + oh - pw);
          ctx.lineTo(ox + ow - pw, oy + pw);
          ctx.closePath();
        }}
      >
        {hatchLines.rightLines.map((pts, i) => (
          <Line key={`srh${i}`} points={pts} stroke={hatchStroke} strokeWidth={0.5} listening={false} />
        ))}
      </Group>
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(ox + ow, oy);
          context.lineTo(ox + ow, oy + oh);
          context.lineTo(ox + ow - pw, oy + oh - pw);
          context.lineTo(ox + ow - pw, oy + pw);
          context.closePath();
          context.strokeShape(shape);
        }}
        stroke={frameStroke}
        strokeWidth={strokeWidth}
        listening={false}
      />

      {/* === 45度拼接对角线（四个角） === */}
      <Line points={[ox, oy, ox + pw, oy + pw]} stroke={frameStroke} strokeWidth={strokeWidth} listening={false} />
      <Line points={[ox + ow, oy, ox + ow - pw, oy + pw]} stroke={frameStroke} strokeWidth={strokeWidth} listening={false} />
      <Line points={[ox, oy + oh, ox + pw, oy + oh - pw]} stroke={frameStroke} strokeWidth={strokeWidth} listening={false} />
      <Line points={[ox + ow, oy + oh, ox + ow - pw, oy + oh - pw]} stroke={frameStroke} strokeWidth={strokeWidth} listening={false} />
    </Group>
  );
}
