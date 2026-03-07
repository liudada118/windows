// WindoorDesigner - L3 扇标记渲染组件
// 渲染 13 种扇类型的 2D 图例标记
// 包含把手图标（参考专业门窗软件）

import { Group, Line, Circle, Rect } from 'react-konva';
import type { Sash, Rect as RectType } from '@windoor/shared';
import { COLORS } from '@/lib/constants';

interface SashRendererProps {
  sash: Sash;
  zoom: number;
  isSelected?: boolean;
}

const MM_TO_PX = 0.5;

/** 渲染把手图标 */
function HandleIcon({
  cx, cy, zoom, rotation = 0,
}: {
  cx: number;
  cy: number;
  zoom: number;
  rotation?: number;
}) {
  const size = Math.max(4, 6 * zoom);
  const handleColor = '#666666';

  return (
    <Group x={cx} y={cy} rotation={rotation}>
      {/* 把手底座 */}
      <Rect
        x={-size * 0.3}
        y={-size * 0.15}
        width={size * 0.6}
        height={size * 0.3}
        fill={handleColor}
        cornerRadius={1}
        listening={false}
      />
      {/* 把手杆 */}
      <Rect
        x={-size * 0.08}
        y={-size * 0.8}
        width={size * 0.16}
        height={size * 0.7}
        fill={handleColor}
        cornerRadius={1}
        listening={false}
      />
    </Group>
  );
}

/** 渲染扇类型标记 */
export default function SashRenderer({ sash, zoom, isSelected }: SashRendererProps) {
  const scale = MM_TO_PX * zoom;
  const rect = sash.rect;
  const x = rect.x * scale;
  const y = rect.y * scale;
  const w = rect.width * scale;
  const h = rect.height * scale;

  const lineColor = isSelected ? COLORS.selected : COLORS.sashLine;
  const slidingColor = isSelected ? COLORS.selected : COLORS.sashLineSliding;
  const fixedColor = isSelected ? COLORS.selected : '#718096';
  const lineWidth = isSelected ? 2.5 : 1.8;
  const dotR = Math.max(2, 3 * zoom);

  const renderSashMark = () => {
    switch (sash.type) {
      case 'fixed':
        // 固定扇: 对角交叉线（X）
        return (
          <Group>
            <Line
              points={[x, y, x + w, y + h]}
              stroke={fixedColor}
              strokeWidth={1.0}
              listening={false}
            />
            <Line
              points={[x + w, y, x, y + h]}
              stroke={fixedColor}
              strokeWidth={1.0}
              listening={false}
            />
          </Group>
        );

      case 'casement-left':
        // 左内开（左侧铰链）- 实线三角形 + 把手
        return (
          <Group>
            <Line
              points={[x, y, x + w, y + h / 2, x, y + h]}
              stroke={lineColor}
              strokeWidth={lineWidth}
              listening={false}
            />
            <Circle x={x} y={y + h * 0.25} radius={dotR} fill={lineColor} listening={false} />
            <Circle x={x} y={y + h * 0.75} radius={dotR} fill={lineColor} listening={false} />
            {/* 把手在右侧中间 */}
            <HandleIcon cx={x + w - 8 * zoom} cy={y + h / 2} zoom={zoom} rotation={0} />
          </Group>
        );

      case 'casement-right':
        // 右内开（右侧铰链）- 实线三角形 + 把手
        return (
          <Group>
            <Line
              points={[x + w, y, x, y + h / 2, x + w, y + h]}
              stroke={lineColor}
              strokeWidth={lineWidth}
              listening={false}
            />
            <Circle x={x + w} y={y + h * 0.25} radius={dotR} fill={lineColor} listening={false} />
            <Circle x={x + w} y={y + h * 0.75} radius={dotR} fill={lineColor} listening={false} />
            {/* 把手在左侧中间 */}
            <HandleIcon cx={x + 8 * zoom} cy={y + h / 2} zoom={zoom} rotation={0} />
          </Group>
        );

      case 'casement-out-left':
        // 左外开 - 虚线三角形
        return (
          <Group>
            <Line
              points={[x, y, x + w, y + h / 2, x, y + h]}
              stroke={lineColor}
              strokeWidth={lineWidth}
              dash={[6, 4]}
              listening={false}
            />
            <Circle x={x} y={y + h * 0.25} radius={dotR} fill={lineColor} listening={false} />
            <Circle x={x} y={y + h * 0.75} radius={dotR} fill={lineColor} listening={false} />
            <HandleIcon cx={x + w - 8 * zoom} cy={y + h / 2} zoom={zoom} rotation={0} />
          </Group>
        );

      case 'casement-out-right':
        // 右外开 - 虚线三角形
        return (
          <Group>
            <Line
              points={[x + w, y, x, y + h / 2, x + w, y + h]}
              stroke={lineColor}
              strokeWidth={lineWidth}
              dash={[6, 4]}
              listening={false}
            />
            <Circle x={x + w} y={y + h * 0.25} radius={dotR} fill={lineColor} listening={false} />
            <Circle x={x + w} y={y + h * 0.75} radius={dotR} fill={lineColor} listening={false} />
            <HandleIcon cx={x + 8 * zoom} cy={y + h / 2} zoom={zoom} rotation={0} />
          </Group>
        );

      case 'casement-top':
        // 上悬（铰链在上）- 实线三角形 + 把手
        return (
          <Group>
            <Line
              points={[x, y, x + w / 2, y + h, x + w, y]}
              stroke={lineColor}
              strokeWidth={lineWidth}
              listening={false}
            />
            <Circle x={x + w * 0.25} y={y} radius={dotR} fill={lineColor} listening={false} />
            <Circle x={x + w * 0.75} y={y} radius={dotR} fill={lineColor} listening={false} />
            <HandleIcon cx={x + w / 2} cy={y + h - 8 * zoom} zoom={zoom} rotation={90} />
          </Group>
        );

      case 'casement-bottom':
        // 下悬（铰链在下）- 实线三角形 + 把手
        return (
          <Group>
            <Line
              points={[x, y + h, x + w / 2, y, x + w, y + h]}
              stroke={lineColor}
              strokeWidth={lineWidth}
              listening={false}
            />
            <Circle x={x + w * 0.25} y={y + h} radius={dotR} fill={lineColor} listening={false} />
            <Circle x={x + w * 0.75} y={y + h} radius={dotR} fill={lineColor} listening={false} />
            <HandleIcon cx={x + w / 2} cy={y + 8 * zoom} zoom={zoom} rotation={90} />
          </Group>
        );

      case 'tilt-turn-left':
        // 左内开内倒 - 实线三角形（平开）+ 虚线三角形（内倒）+ 把手
        return (
          <Group>
            {/* 平开方向 */}
            <Line
              points={[x, y, x + w, y + h / 2, x, y + h]}
              stroke={lineColor}
              strokeWidth={lineWidth}
              listening={false}
            />
            {/* 内倒方向 */}
            <Line
              points={[x, y + h, x + w / 2, y, x + w, y + h]}
              stroke={lineColor}
              strokeWidth={lineWidth}
              dash={[6, 4]}
              listening={false}
            />
            <Circle x={x} y={y + h * 0.25} radius={dotR} fill={lineColor} listening={false} />
            <Circle x={x} y={y + h * 0.75} radius={dotR} fill={lineColor} listening={false} />
            <HandleIcon cx={x + w - 8 * zoom} cy={y + h / 2} zoom={zoom} rotation={0} />
          </Group>
        );

      case 'tilt-turn-right':
        // 右内开内倒 - 实线三角形（平开）+ 虚线三角形（内倒）+ 把手
        return (
          <Group>
            {/* 平开方向 */}
            <Line
              points={[x + w, y, x, y + h / 2, x + w, y + h]}
              stroke={lineColor}
              strokeWidth={lineWidth}
              listening={false}
            />
            {/* 内倒方向 */}
            <Line
              points={[x, y + h, x + w / 2, y, x + w, y + h]}
              stroke={lineColor}
              strokeWidth={lineWidth}
              dash={[6, 4]}
              listening={false}
            />
            <Circle x={x + w} y={y + h * 0.25} radius={dotR} fill={lineColor} listening={false} />
            <Circle x={x + w} y={y + h * 0.75} radius={dotR} fill={lineColor} listening={false} />
            <HandleIcon cx={x + 8 * zoom} cy={y + h / 2} zoom={zoom} rotation={0} />
          </Group>
        );

      case 'sliding-left':
        // 左推拉 - 虚线箭头指向左
        return (
          <Group>
            <Line
              points={[x + w * 0.7, y + h / 2, x + w * 0.3, y + h / 2]}
              stroke={slidingColor}
              strokeWidth={lineWidth}
              dash={[6, 4]}
              listening={false}
            />
            <Line
              points={[x + w * 0.4, y + h / 2 - 8, x + w * 0.3, y + h / 2, x + w * 0.4, y + h / 2 + 8]}
              stroke={slidingColor}
              strokeWidth={lineWidth}
              listening={false}
            />
          </Group>
        );

      case 'sliding-right':
        // 右推拉 - 虚线箭头指向右
        return (
          <Group>
            <Line
              points={[x + w * 0.3, y + h / 2, x + w * 0.7, y + h / 2]}
              stroke={slidingColor}
              strokeWidth={lineWidth}
              dash={[6, 4]}
              listening={false}
            />
            <Line
              points={[x + w * 0.6, y + h / 2 - 8, x + w * 0.7, y + h / 2, x + w * 0.6, y + h / 2 + 8]}
              stroke={slidingColor}
              strokeWidth={lineWidth}
              listening={false}
            />
          </Group>
        );

      case 'folding-left':
        // 左折叠 - 虚线箭头 + 折线
        return (
          <Group>
            <Line
              points={[x + w * 0.6, y + h / 2, x + w * 0.2, y + h / 2]}
              stroke={slidingColor}
              strokeWidth={lineWidth}
              dash={[4, 3]}
              listening={false}
            />
            <Line
              points={[x + w * 0.3, y + h / 2 - 8, x + w * 0.2, y + h / 2, x + w * 0.3, y + h / 2 + 8]}
              stroke={slidingColor}
              strokeWidth={lineWidth}
              listening={false}
            />
            {/* 折叠线 */}
            <Line
              points={[x + w * 0.5, y + h * 0.2, x + w * 0.5, y + h * 0.8]}
              stroke={slidingColor}
              strokeWidth={1}
              dash={[3, 3]}
              listening={false}
            />
          </Group>
        );

      case 'folding-right':
        // 右折叠 - 虚线箭头 + 折线
        return (
          <Group>
            <Line
              points={[x + w * 0.4, y + h / 2, x + w * 0.8, y + h / 2]}
              stroke={slidingColor}
              strokeWidth={lineWidth}
              dash={[4, 3]}
              listening={false}
            />
            <Line
              points={[x + w * 0.7, y + h / 2 - 8, x + w * 0.8, y + h / 2, x + w * 0.7, y + h / 2 + 8]}
              stroke={slidingColor}
              strokeWidth={lineWidth}
              listening={false}
            />
            {/* 折叠线 */}
            <Line
              points={[x + w * 0.5, y + h * 0.2, x + w * 0.5, y + h * 0.8]}
              stroke={slidingColor}
              strokeWidth={1}
              dash={[3, 3]}
              listening={false}
            />
          </Group>
        );

      default:
        return null;
    }
  };

  return <Group>{renderSashMark()}</Group>;
}
