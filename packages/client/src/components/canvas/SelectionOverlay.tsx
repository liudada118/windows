// WindoorDesigner - L5 选中高亮和控制点组件
// 渲染选中元素的橙色边框、辉光效果和控制点

import { Group, Rect } from 'react-konva';
import type { WindowUnit } from '@windoor/shared';
import { COLORS } from '@/lib/constants';

interface SelectionOverlayProps {
  window: WindowUnit;
  zoom: number;
}

const MM_TO_PX = 0.5;
const CONTROL_POINT_SIZE = 8;

/** 渲染选中高亮和控制点 */
export default function SelectionOverlay({ window: win, zoom }: SelectionOverlayProps) {
  const scale = MM_TO_PX * zoom;
  const w = win.width * scale;
  const h = win.height * scale;
  const half = CONTROL_POINT_SIZE / 2;

  // 控制点位置：四角 + 四边中点
  const controlPoints = [
    { x: -half, y: -half }, // 左上
    { x: w / 2 - half, y: -half }, // 上中
    { x: w - half, y: -half }, // 右上
    { x: w - half, y: h / 2 - half }, // 右中
    { x: w - half, y: h - half }, // 右下
    { x: w / 2 - half, y: h - half }, // 下中
    { x: -half, y: h - half }, // 左下
    { x: -half, y: h / 2 - half }, // 左中
  ];

  return (
    <Group>
      {/* 选中边框 */}
      <Rect
        x={-2}
        y={-2}
        width={w + 4}
        height={h + 4}
        stroke={COLORS.selected}
        strokeWidth={2.5}
        dash={[8, 4]}
        listening={false}
      />

      {/* 控制点 */}
      {controlPoints.map((pt, i) => (
        <Rect
          key={i}
          x={pt.x}
          y={pt.y}
          width={CONTROL_POINT_SIZE}
          height={CONTROL_POINT_SIZE}
          fill={COLORS.controlPointFill}
          stroke={COLORS.controlPointStroke}
          strokeWidth={1.5}
          listening={false}
        />
      ))}
    </Group>
  );
}
