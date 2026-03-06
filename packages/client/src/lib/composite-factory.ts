// WindoorDesigner - 组合窗工厂函数
// 创建 U 形窗、L 形窗、凸窗等多面板组合窗

import { nanoid } from 'nanoid';
import type { CompositeWindow, CompositePanel, CompositeWindowType, ProfileSeries, WindowUnit } from './types';
import { createWindowUnit, createSash, splitOpening } from './window-factory';

// ===== 组合窗面板创建 =====

function createPanel(
  width: number,
  height: number,
  series: ProfileSeries,
  angle: number,
  label: string,
  connectionType: CompositePanel['connectionType'] = 'corner-post',
  name?: string
): CompositePanel {
  const win = createWindowUnit(width, height, 0, 0, series, name || label);
  // 给每个面板的 Opening 添加默认固定扇
  const opening = win.frame.openings[0];
  opening.sash = createSash('fixed', opening.rect, series.sashWidth);

  return {
    id: nanoid(8),
    windowUnit: win,
    angle,
    connectionType,
    label,
  };
}

// ===== 组合窗创建 =====

function createCompositeWindow(
  type: CompositeWindowType,
  name: string,
  panels: CompositePanel[],
  x: number,
  y: number
): CompositeWindow {
  return {
    id: nanoid(8),
    name,
    type,
    panels,
    posX: x,
    posY: y,
    selected: false,
    viewMode: 'unfold',
  };
}

// ===== U 形窗 (3面 90°) =====
// 左侧面 + 正面 + 右侧面，转角 90°

export function createUShapeWindow(
  x: number,
  y: number,
  series: ProfileSeries,
  frontWidth: number = 1800,
  sideWidth: number = 800,
  height: number = 1500
): CompositeWindow {
  const leftPanel = createPanel(sideWidth, height, series, -90, '左侧面', 'corner-post', '左侧面');
  const frontPanel = createPanel(frontWidth, height, series, 0, '正面', 'corner-post', '正面');
  const rightPanel = createPanel(sideWidth, height, series, 90, '右侧面', 'corner-post', '右侧面');

  // 给正面添加双开扇
  const pw = series.frameWidth;
  const mw = series.mullionWidth;
  const innerW = frontWidth - pw * 2;
  const midX = pw + innerW / 2;
  const topOpening = frontPanel.windowUnit.frame.openings[0];
  const splitResult = splitOpening(topOpening, 'vertical', midX, mw);
  splitResult.childOpenings[0].sash = createSash('casement-left', splitResult.childOpenings[0].rect, series.sashWidth);
  splitResult.childOpenings[1].sash = createSash('casement-right', splitResult.childOpenings[1].rect, series.sashWidth);
  frontPanel.windowUnit.frame.openings = [splitResult];

  return createCompositeWindow('u-shape', 'U形窗', [leftPanel, frontPanel, rightPanel], x, y);
}

// ===== L 形窗 (2面 90°) =====

export function createLShapeWindow(
  x: number,
  y: number,
  series: ProfileSeries,
  frontWidth: number = 1500,
  sideWidth: number = 1000,
  height: number = 1500
): CompositeWindow {
  const frontPanel = createPanel(frontWidth, height, series, 0, '正面', 'corner-post', '正面');
  const sidePanel = createPanel(sideWidth, height, series, 90, '侧面', 'corner-post', '侧面');

  return createCompositeWindow('l-shape', 'L形窗', [frontPanel, sidePanel], x, y);
}

// ===== 凸窗/飘窗 (3面 135°) =====

export function createBayWindow(
  x: number,
  y: number,
  series: ProfileSeries,
  frontWidth: number = 1600,
  sideWidth: number = 600,
  height: number = 1500
): CompositeWindow {
  const leftPanel = createPanel(sideWidth, height, series, -45, '左斜面', 'miter', '左斜面');
  const frontPanel = createPanel(frontWidth, height, series, 0, '正面', 'miter', '正面');
  const rightPanel = createPanel(sideWidth, height, series, 45, '右斜面', 'miter', '右斜面');

  return createCompositeWindow('bay-window', '凸窗/飘窗', [leftPanel, frontPanel, rightPanel], x, y);
}

// ===== 自定义组合窗 =====

export interface CompositeConfig {
  type: CompositeWindowType;
  name: string;
  panels: {
    width: number;
    height: number;
    angle: number;
    label: string;
    connectionType: CompositePanel['connectionType'];
  }[];
}

export function createCustomCompositeWindow(
  config: CompositeConfig,
  x: number,
  y: number,
  series: ProfileSeries
): CompositeWindow {
  const panels = config.panels.map(p =>
    createPanel(p.width, p.height, series, p.angle, p.label, p.connectionType)
  );
  return createCompositeWindow(config.type, config.name, panels, x, y);
}

// ===== 组合窗模板 =====

export interface CompositeTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  type: CompositeWindowType;
  create: (x: number, y: number, series: ProfileSeries) => CompositeWindow;
}

export const COMPOSITE_TEMPLATES: CompositeTemplate[] = [
  {
    id: 'u-shape',
    name: 'U形窗',
    icon: '⊔',
    description: '三面转角窗（左侧+正面+右侧，90°转角）',
    type: 'u-shape',
    create: (x, y, series) => createUShapeWindow(x, y, series),
  },
  {
    id: 'l-shape',
    name: 'L形窗',
    icon: '⌐',
    description: '双面转角窗（正面+侧面，90°转角）',
    type: 'l-shape',
    create: (x, y, series) => createLShapeWindow(x, y, series),
  },
  {
    id: 'bay-window',
    name: '凸窗/飘窗',
    icon: '⏢',
    description: '三面凸窗（左斜面+正面+右斜面，135°转角）',
    type: 'bay-window',
    create: (x, y, series) => createBayWindow(x, y, series),
  },
];
