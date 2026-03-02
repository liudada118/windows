// WindoorDesigner - 高级形状渲染
// Phase 5: 异形框（圆弧顶/三角顶/梯形顶）、格条（Georgian bars）

import React, { useMemo } from 'react';
import { Group, Line, Arc, Shape, Rect, Text } from 'react-konva';
import type { WindowUnit, Opening } from '@/lib/types';

// ===== 异形框类型 =====
export type ArcTopType = 'arch' | 'triangle' | 'trapezoid' | 'gothic' | 'eyebrow';

export interface ArcTopConfig {
  type: ArcTopType;
  height: number; // 弧顶高度 (mm)
}

// ===== 格条类型 =====
export type GridPatternType = 'colonial' | 'prairie' | 'diamond' | 'custom';

export interface GridBarConfig {
  pattern: GridPatternType;
  barWidth: number;   // 格条宽度 (mm), 默认 8
  rows: number;       // 横向分割数
  cols: number;       // 纵向分割数
  color: string;      // 格条颜色
}

// ===== 异形框渲染 =====
interface ArcTopRendererProps {
  x: number;
  y: number;
  width: number;
  height: number;
  arcConfig: ArcTopConfig;
  scale: number;
  frameColor?: string;
  glassColor?: string;
}

export function ArcTopRenderer({
  x, y, width, height, arcConfig, scale,
  frameColor = '#C0C0C0',
  glassColor = 'rgba(200, 230, 240, 0.3)',
}: ArcTopRendererProps) {
  const s = scale;
  const arcH = arcConfig.height * s;
  const w = width * s;
  const h = height * s;
  const px = x * s;
  const py = y * s;

  const arcPoints = useMemo(() => {
    switch (arcConfig.type) {
      case 'arch': {
        // 半圆弧顶
        const points: number[] = [];
        const cx = px + w / 2;
        const cy = py - arcH;
        const rx = w / 2;
        const ry = arcH;
        for (let i = 0; i <= 40; i++) {
          const angle = Math.PI * (1 - i / 40);
          points.push(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
        }
        return points;
      }
      case 'triangle':
        return [px, py, px + w / 2, py - arcH, px + w, py];
      case 'trapezoid': {
        const inset = w * 0.15;
        return [px, py, px + inset, py - arcH, px + w - inset, py - arcH, px + w, py];
      }
      case 'gothic': {
        const points: number[] = [];
        const cx = px + w / 2;
        // Left arc
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          const ax = px + t * w / 2;
          const ay = py - arcH * Math.pow(Math.sin(t * Math.PI / 2), 0.7);
          points.push(ax, ay);
        }
        // Right arc (mirror)
        for (let i = 20; i >= 0; i--) {
          const t = i / 20;
          const ax = px + w - t * w / 2;
          const ay = py - arcH * Math.pow(Math.sin(t * Math.PI / 2), 0.7);
          points.push(ax, ay);
        }
        return points;
      }
      case 'eyebrow': {
        const points: number[] = [];
        for (let i = 0; i <= 40; i++) {
          const t = i / 40;
          const ax = px + t * w;
          const ay = py - arcH * Math.sin(t * Math.PI) * 0.4;
          points.push(ax, ay);
        }
        return points;
      }
      default:
        return [px, py, px + w, py];
    }
  }, [arcConfig.type, px, py, w, arcH]);

  return (
    <Group>
      {/* 弧顶玻璃区域 */}
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(arcPoints[0], arcPoints[1]);
          for (let i = 2; i < arcPoints.length; i += 2) {
            context.lineTo(arcPoints[i], arcPoints[i + 1]);
          }
          context.closePath();
          context.fillStrokeShape(shape);
        }}
        fill={glassColor}
        stroke="#999"
        strokeWidth={0.5}
      />
      {/* 弧顶框线 */}
      <Line
        points={arcPoints}
        stroke={frameColor}
        strokeWidth={3}
        closed={false}
      />
    </Group>
  );
}

// ===== 格条渲染 =====
interface GridBarRendererProps {
  x: number;
  y: number;
  width: number;
  height: number;
  config: GridBarConfig;
  scale: number;
}

export function GridBarRenderer({
  x, y, width, height, config, scale,
}: GridBarRendererProps) {
  const s = scale;
  const px = x * s;
  const py = y * s;
  const w = width * s;
  const h = height * s;
  const barW = config.barWidth * s;

  const bars = useMemo(() => {
    const result: { x1: number; y1: number; x2: number; y2: number }[] = [];

    switch (config.pattern) {
      case 'colonial': {
        // 等间距横竖格条
        for (let i = 1; i < config.cols; i++) {
          const bx = px + (w / config.cols) * i;
          result.push({ x1: bx, y1: py, x2: bx, y2: py + h });
        }
        for (let i = 1; i < config.rows; i++) {
          const by = py + (h / config.rows) * i;
          result.push({ x1: px, y1: by, x2: px + w, y2: by });
        }
        break;
      }
      case 'prairie': {
        // 只在边缘区域有格条（Prairie style）
        const edgeX = w * 0.25;
        const edgeY = h * 0.25;
        // 竖线
        result.push({ x1: px + edgeX, y1: py, x2: px + edgeX, y2: py + h });
        result.push({ x1: px + w - edgeX, y1: py, x2: px + w - edgeX, y2: py + h });
        // 横线
        result.push({ x1: px, y1: py + edgeY, x2: px + w, y2: py + edgeY });
        result.push({ x1: px, y1: py + h - edgeY, x2: px + w, y2: py + h - edgeY });
        break;
      }
      case 'diamond': {
        // 菱形格条
        const cx = px + w / 2;
        const cy = py + h / 2;
        const stepX = w / (config.cols + 1);
        const stepY = h / (config.rows + 1);
        // 对角线
        for (let i = 0; i <= config.cols; i++) {
          const startX = px + stepX * i;
          result.push({ x1: startX, y1: py, x2: startX + w / 2, y2: py + h });
          result.push({ x1: startX + w, y1: py, x2: startX + w / 2, y2: py + h });
        }
        break;
      }
      case 'custom':
      default: {
        // 自定义等间距
        for (let i = 1; i < config.cols; i++) {
          const bx = px + (w / config.cols) * i;
          result.push({ x1: bx, y1: py, x2: bx, y2: py + h });
        }
        for (let i = 1; i < config.rows; i++) {
          const by = py + (h / config.rows) * i;
          result.push({ x1: px, y1: by, x2: px + w, y2: by });
        }
        break;
      }
    }

    return result;
  }, [config, px, py, w, h]);

  return (
    <Group>
      {bars.map((bar, i) => (
        <Line
          key={i}
          points={[bar.x1, bar.y1, bar.x2, bar.y2]}
          stroke={config.color}
          strokeWidth={barW}
          lineCap="butt"
          opacity={0.8}
        />
      ))}
    </Group>
  );
}

// ===== 多选框渲染 =====
interface MultiSelectBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function MultiSelectBox({ x, y, width, height }: MultiSelectBoxProps) {
  return (
    <Rect
      x={Math.min(x, x + width)}
      y={Math.min(y, y + height)}
      width={Math.abs(width)}
      height={Math.abs(height)}
      fill="rgba(59, 130, 246, 0.1)"
      stroke="rgba(59, 130, 246, 0.6)"
      strokeWidth={1}
      dash={[4, 4]}
    />
  );
}
