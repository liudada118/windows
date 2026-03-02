// WindoorDesigner - L0 网格背景层
// 渲染 10mm 细网格线和 100mm 粗网格线

import { useMemo } from 'react';
import { Layer, Line } from 'react-konva';
import { COLORS } from '@/lib/constants';

interface GridLayerProps {
  width: number;
  height: number;
  zoom: number;
  panX: number;
  panY: number;
}

const MM_TO_PX = 0.5;

/** L0 网格背景层 - 静态层，listening: false 提升性能 */
export default function GridLayer({ width, height, zoom, panX, panY }: GridLayerProps) {
  const gridLines = useMemo(() => {
    const lines: { points: number[]; stroke: string; strokeWidth: number }[] = [];
    const scale = MM_TO_PX * zoom;
    const smallGrid = 10 * scale; // 10mm 网格
    const largeGrid = 100 * scale; // 100mm 网格

    // 如果网格太密，只显示粗线
    const showSmall = smallGrid >= 4;

    if (showSmall) {
      // 细网格线
      const startX = ((panX % smallGrid) + smallGrid) % smallGrid;
      const startY = ((panY % smallGrid) + smallGrid) % smallGrid;

      for (let x = startX; x < width; x += smallGrid) {
        lines.push({
          points: [x, 0, x, height],
          stroke: COLORS.grid,
          strokeWidth: 0.5,
        });
      }
      for (let y = startY; y < height; y += smallGrid) {
        lines.push({
          points: [0, y, width, y],
          stroke: COLORS.grid,
          strokeWidth: 0.5,
        });
      }
    }

    // 粗网格线
    const startXL = ((panX % largeGrid) + largeGrid) % largeGrid;
    const startYL = ((panY % largeGrid) + largeGrid) % largeGrid;

    for (let x = startXL; x < width; x += largeGrid) {
      lines.push({
        points: [x, 0, x, height],
        stroke: COLORS.gridMajor,
        strokeWidth: 0.8,
      });
    }
    for (let y = startYL; y < height; y += largeGrid) {
      lines.push({
        points: [0, y, width, y],
        stroke: COLORS.gridMajor,
        strokeWidth: 0.8,
      });
    }

    return lines;
  }, [width, height, zoom, panX, panY]);

  return (
    <Layer listening={false}>
      {gridLines.map((line, i) => (
        <Line
          key={i}
          points={line.points}
          stroke={line.stroke}
          strokeWidth={line.strokeWidth}
        />
      ))}
    </Layer>
  );
}
