// WindoorDesigner - 窗口工厂函数 v2.0
// 负责创建各种预设窗型和基础窗口对象
// 基于《画图模块可执行规格书》重构

import { nanoid } from 'nanoid';
import type { WindowUnit, Opening, Frame, Sash, ProfileSeries, Rect, Mullion, WindowTemplate, SashType, GlassPane } from './types';
import { CONSTRAINTS } from './types';

// ===== 基础创建函数 =====

export function createRect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

export function createOpening(rect: Rect): Opening {
  return {
    id: nanoid(8),
    rect,
    mullions: [],
    sash: null,
    glass: null,
    glassPane: null,
    childOpenings: [],
    isSplit: false,
  };
}

export function createSash(type: SashType, rect: Rect, sashWidth: number = 55): Sash {
  return {
    id: nanoid(8),
    type,
    rect,
    profileWidth: sashWidth,
    glassPane: null,
    hardware: [],
    hasFlyScreen: false,
  };
}

export function createMullion(type: 'vertical' | 'horizontal', position: number, profileWidth: number = 70): Mullion {
  return {
    id: nanoid(8),
    type,
    position,
    profileWidth,
    isArc: false,
  };
}

export function createFrame(width: number, height: number, profileWidth: number): Frame {
  const pw = profileWidth;
  const innerRect = createRect(pw, pw, width - pw * 2, height - pw * 2);
  return {
    id: nanoid(8),
    shape: 'rectangle',
    points: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    profileWidth: pw,
    openings: [createOpening(innerRect)],
  };
}

export function createWindowUnit(
  width: number,
  height: number,
  x: number,
  y: number,
  series: ProfileSeries,
  name?: string
): WindowUnit {
  return {
    id: nanoid(8),
    name: name || '新窗口',
    width,
    height,
    profileSeriesId: series.id,
    frame: createFrame(width, height, series.frameWidth),
    posX: x,
    posY: y,
    selected: false,
  };
}

// ===== 分割操作 =====

export function splitOpening(
  opening: Opening,
  type: 'vertical' | 'horizontal',
  position: number,
  mullionWidth: number
): Opening {
  const mullion = createMullion(type, position, mullionWidth);
  const halfMullion = mullionWidth / 2;

  let child1Rect: Rect;
  let child2Rect: Rect;

  if (type === 'vertical') {
    child1Rect = createRect(
      opening.rect.x,
      opening.rect.y,
      position - opening.rect.x - halfMullion,
      opening.rect.height
    );
    child2Rect = createRect(
      position + halfMullion,
      opening.rect.y,
      opening.rect.x + opening.rect.width - position - halfMullion,
      opening.rect.height
    );
  } else {
    child1Rect = createRect(
      opening.rect.x,
      opening.rect.y,
      opening.rect.width,
      position - opening.rect.y - halfMullion
    );
    child2Rect = createRect(
      opening.rect.x,
      position + halfMullion,
      opening.rect.width,
      opening.rect.y + opening.rect.height - position - halfMullion
    );
  }

  return {
    ...opening,
    isSplit: true,
    sash: null,
    glass: null,
    glassPane: null,
    mullions: [...opening.mullions, mullion],
    childOpenings: [createOpening(child1Rect), createOpening(child2Rect)],
  };
}

// ===== 查找操作 =====

export function findOpeningAtPoint(
  openings: Opening[],
  x: number,
  y: number
): Opening | null {
  for (const opening of openings) {
    if (opening.isSplit && opening.childOpenings.length > 0) {
      const found = findOpeningAtPoint(opening.childOpenings, x, y);
      if (found) return found;
    } else {
      const r = opening.rect;
      if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
        return opening;
      }
    }
  }
  return null;
}

export function findMullionAtPoint(
  openings: Opening[],
  x: number,
  y: number,
  tolerance: number = 8
): { mullion: Mullion; parentOpening: Opening } | null {
  for (const opening of openings) {
    for (const mullion of opening.mullions) {
      if (mullion.type === 'vertical') {
        if (
          Math.abs(x - mullion.position) < tolerance &&
          y >= opening.rect.y &&
          y <= opening.rect.y + opening.rect.height
        ) {
          return { mullion, parentOpening: opening };
        }
      } else {
        if (
          Math.abs(y - mullion.position) < tolerance &&
          x >= opening.rect.x &&
          x <= opening.rect.x + opening.rect.width
        ) {
          return { mullion, parentOpening: opening };
        }
      }
    }
    if (opening.isSplit && opening.childOpenings.length > 0) {
      const found = findMullionAtPoint(opening.childOpenings, x, y, tolerance);
      if (found) return found;
    }
  }
  return null;
}

// ===== 中梃拖拽更新 =====

export function updateOpeningAfterMullionDrag(
  opening: Opening,
  mullionId: string,
  newPosition: number,
  mullionWidth: number
): Opening {
  const mullionIndex = opening.mullions.findIndex(m => m.id === mullionId);
  if (mullionIndex === -1) return opening;

  const mullion = opening.mullions[mullionIndex];
  const halfMullion = mullionWidth / 2;
  const updatedMullions = [...opening.mullions];
  updatedMullions[mullionIndex] = { ...mullion, position: newPosition };

  let child1Rect: Rect;
  let child2Rect: Rect;

  if (mullion.type === 'vertical') {
    child1Rect = createRect(
      opening.rect.x,
      opening.rect.y,
      newPosition - opening.rect.x - halfMullion,
      opening.rect.height
    );
    child2Rect = createRect(
      newPosition + halfMullion,
      opening.rect.y,
      opening.rect.x + opening.rect.width - newPosition - halfMullion,
      opening.rect.height
    );
  } else {
    child1Rect = createRect(
      opening.rect.x,
      opening.rect.y,
      opening.rect.width,
      newPosition - opening.rect.y - halfMullion
    );
    child2Rect = createRect(
      opening.rect.x,
      newPosition + halfMullion,
      opening.rect.width,
      opening.rect.y + opening.rect.height - newPosition - halfMullion
    );
  }

  // 递归更新子Opening内部结构
  const updatedChildren = opening.childOpenings.map((child, i) => {
    const newRect = i === 0 ? child1Rect : child2Rect;
    return resizeOpeningRecursive(child, newRect);
  });

  return {
    ...opening,
    mullions: updatedMullions,
    childOpenings: updatedChildren,
  };
}

// ===== DF-04: 递归按比例更新Opening尺寸 =====

function resizeOpeningRecursive(opening: Opening, newRect: Rect): Opening {
  const oldRect = opening.rect;
  const scaleX = oldRect.width > 0 ? newRect.width / oldRect.width : 1;
  const scaleY = oldRect.height > 0 ? newRect.height / oldRect.height : 1;

  // 更新扇的rect
  let updatedSash: Sash | null = null;
  if (opening.sash) {
    updatedSash = {
      ...opening.sash,
      rect: newRect, // 扇总是充满Opening
    };
  }

  // 如果没有子Opening，直接返回
  if (!opening.isSplit || opening.childOpenings.length === 0) {
    return {
      ...opening,
      rect: newRect,
      sash: updatedSash,
    };
  }

  // 更新中梃位置
  const updatedMullions = opening.mullions.map(m => {
    if (m.type === 'vertical') {
      const relativePos = m.position - oldRect.x;
      return { ...m, position: newRect.x + relativePos * scaleX };
    } else {
      const relativePos = m.position - oldRect.y;
      return { ...m, position: newRect.y + relativePos * scaleY };
    }
  });

  // 递归更新子Opening
  const updatedChildren = opening.childOpenings.map(child => {
    const childNewRect = createRect(
      newRect.x + (child.rect.x - oldRect.x) * scaleX,
      newRect.y + (child.rect.y - oldRect.y) * scaleY,
      child.rect.width * scaleX,
      child.rect.height * scaleY
    );
    return resizeOpeningRecursive(child, childNewRect);
  });

  return {
    ...opening,
    rect: newRect,
    sash: updatedSash,
    mullions: updatedMullions,
    childOpenings: updatedChildren,
  };
}

// ===== DF-04: 修改窗户整体尺寸 =====

export function resizeWindowUnit(win: WindowUnit, newWidth: number, newHeight: number): WindowUnit {
  const pw = win.frame.profileWidth;
  const newInnerRect = createRect(pw, pw, newWidth - pw * 2, newHeight - pw * 2);

  const updatedOpenings = win.frame.openings.map(opening => {
    return resizeOpeningRecursive(opening, newInnerRect);
  });

  return {
    ...win,
    width: newWidth,
    height: newHeight,
    frame: {
      ...win.frame,
      points: [
        { x: 0, y: 0 },
        { x: newWidth, y: 0 },
        { x: newWidth, y: newHeight },
        { x: 0, y: newHeight },
      ],
      openings: updatedOpenings,
    },
  };
}

// ===== DF-06: 删除中梃 (合并子分格) =====

export function deleteMullionFromOpening(
  openings: Opening[],
  mullionId: string
): Opening[] {
  return openings.map(opening => {
    const mullionIndex = opening.mullions.findIndex(m => m.id === mullionId);
    if (mullionIndex !== -1) {
      // 找到了中梃，合并子Opening
      return {
        ...opening,
        isSplit: false,
        mullions: opening.mullions.filter(m => m.id !== mullionId),
        childOpenings: [],
        sash: null,
        glass: null,
        glassPane: null,
      };
    }
    // 递归搜索子Opening
    if (opening.isSplit && opening.childOpenings.length > 0) {
      return {
        ...opening,
        childOpenings: deleteMullionFromOpening(opening.childOpenings, mullionId),
      };
    }
    return opening;
  });
}

// ===== DF-06: 删除扇 =====

export function deleteSashFromOpening(
  openings: Opening[],
  sashId: string
): Opening[] {
  return openings.map(opening => {
    if (opening.sash && opening.sash.id === sashId) {
      return {
        ...opening,
        sash: null,
      };
    }
    if (opening.isSplit && opening.childOpenings.length > 0) {
      return {
        ...opening,
        childOpenings: deleteSashFromOpening(opening.childOpenings, sashId),
      };
    }
    return opening;
  });
}

// ===== 添加扇到指定Opening =====

export function addSashToOpening(
  openings: Opening[],
  openingId: string,
  sashType: SashType,
  sashWidth: number
): Opening[] {
  return openings.map(opening => {
    if (opening.id === openingId && !opening.isSplit) {
      return {
        ...opening,
        sash: createSash(sashType, opening.rect, sashWidth),
      };
    }
    if (opening.isSplit && opening.childOpenings.length > 0) {
      return {
        ...opening,
        childOpenings: addSashToOpening(opening.childOpenings, openingId, sashType, sashWidth),
      };
    }
    return opening;
  });
}

// ===== 添加中梃到指定Opening =====

export function addMullionToOpening(
  openings: Opening[],
  openingId: string,
  type: 'vertical' | 'horizontal',
  position: number,
  mullionWidth: number
): Opening[] {
  return openings.map(opening => {
    if (opening.id === openingId && !opening.isSplit) {
      return splitOpening(opening, type, position, mullionWidth);
    }
    if (opening.isSplit && opening.childOpenings.length > 0) {
      return {
        ...opening,
        childOpenings: addMullionToOpening(opening.childOpenings, openingId, type, position, mullionWidth),
      };
    }
    return opening;
  });
}

// ===== 边界校验 =====

export function validateMullionPosition(
  opening: Opening,
  type: 'vertical' | 'horizontal',
  position: number,
  mullionWidth: number
): { valid: boolean; reason?: string } {
  const halfMullion = mullionWidth / 2;
  const minSize = CONSTRAINTS.MIN_OPENING_SIZE;
  const minEdge = CONSTRAINTS.MIN_MULLION_EDGE;

  if (type === 'vertical') {
    const leftSpace = position - opening.rect.x - halfMullion;
    const rightSpace = opening.rect.x + opening.rect.width - position - halfMullion;
    if (leftSpace < minEdge) return { valid: false, reason: `左侧空间不足 (${Math.round(leftSpace)}mm < ${minEdge}mm)` };
    if (rightSpace < minEdge) return { valid: false, reason: `右侧空间不足 (${Math.round(rightSpace)}mm < ${minEdge}mm)` };
  } else {
    const topSpace = position - opening.rect.y - halfMullion;
    const bottomSpace = opening.rect.y + opening.rect.height - position - halfMullion;
    if (topSpace < minEdge) return { valid: false, reason: `上方空间不足 (${Math.round(topSpace)}mm < ${minEdge}mm)` };
    if (bottomSpace < minEdge) return { valid: false, reason: `下方空间不足 (${Math.round(bottomSpace)}mm < ${minEdge}mm)` };
  }

  return { valid: true };
}

// ===== 递归更新中梃拖拽 (在整个Opening树中查找) =====

export function updateMullionInOpenings(
  openings: Opening[],
  mullionId: string,
  newPosition: number,
  mullionWidth: number
): Opening[] {
  return openings.map(opening => {
    const hasMullion = opening.mullions.some(m => m.id === mullionId);
    if (hasMullion) {
      return updateOpeningAfterMullionDrag(opening, mullionId, newPosition, mullionWidth);
    }
    if (opening.isSplit && opening.childOpenings.length > 0) {
      return {
        ...opening,
        childOpenings: updateMullionInOpenings(opening.childOpenings, mullionId, newPosition, mullionWidth),
      };
    }
    return opening;
  });
}

// ===== PRESET WINDOW TEMPLATES =====

function createFixedWindow(id: string, x: number, y: number, series: ProfileSeries): WindowUnit {
  const w = 1200, h = 1500;
  const win = createWindowUnit(w, h, x, y, series, '固定窗');
  const opening = win.frame.openings[0];
  opening.sash = createSash('fixed', opening.rect, series.sashWidth);
  return win;
}

function createSingleCasement(id: string, x: number, y: number, series: ProfileSeries): WindowUnit {
  const w = 800, h = 1400;
  const win = createWindowUnit(w, h, x, y, series, '单开窗');
  const opening = win.frame.openings[0];
  opening.sash = createSash('casement-left', opening.rect, series.sashWidth);
  return win;
}

function createDoubleCasement(id: string, x: number, y: number, series: ProfileSeries): WindowUnit {
  const w = 1600, h = 1500;
  const win = createWindowUnit(w, h, x, y, series, '双开窗');
  const pw = series.frameWidth;
  const mw = series.mullionWidth;
  const innerW = w - pw * 2;
  const midX = pw + innerW / 2;

  const topOpening = win.frame.openings[0];
  const splitResult = splitOpening(topOpening, 'vertical', midX, mw);
  splitResult.childOpenings[0].sash = createSash('casement-left', splitResult.childOpenings[0].rect, series.sashWidth);
  splitResult.childOpenings[1].sash = createSash('casement-right', splitResult.childOpenings[1].rect, series.sashWidth);
  win.frame.openings = [splitResult];
  return win;
}

function createThreePanelWindow(id: string, x: number, y: number, series: ProfileSeries): WindowUnit {
  const w = 2400, h = 1500;
  const win = createWindowUnit(w, h, x, y, series, '三等分窗');
  const pw = series.frameWidth;
  const mw = series.mullionWidth;
  const innerW = w - pw * 2;
  const pos1 = pw + innerW / 3;

  const topOpening = win.frame.openings[0];
  const split1 = splitOpening(topOpening, 'vertical', pos1, mw);
  const rightChild = split1.childOpenings[1];
  const adjustedPos2 = rightChild.rect.x + rightChild.rect.width / 2;
  const split2 = splitOpening(rightChild, 'vertical', adjustedPos2, mw);

  split1.childOpenings[0].sash = createSash('casement-left', split1.childOpenings[0].rect, series.sashWidth);
  split2.childOpenings[0].sash = createSash('fixed', split2.childOpenings[0].rect, series.sashWidth);
  split2.childOpenings[1].sash = createSash('casement-right', split2.childOpenings[1].rect, series.sashWidth);
  split1.childOpenings[1] = split2;

  win.frame.openings = [split1];
  return win;
}

function createSlidingWindow(id: string, x: number, y: number, series: ProfileSeries): WindowUnit {
  const w = 2000, h = 1500;
  const win = createWindowUnit(w, h, x, y, series, '推拉窗');
  const pw = series.frameWidth;
  const mw = series.mullionWidth;
  const innerW = w - pw * 2;
  const midX = pw + innerW / 2;

  const topOpening = win.frame.openings[0];
  const splitResult = splitOpening(topOpening, 'vertical', midX, mw);
  splitResult.childOpenings[0].sash = createSash('sliding-left', splitResult.childOpenings[0].rect, series.sashWidth);
  splitResult.childOpenings[1].sash = createSash('sliding-right', splitResult.childOpenings[1].rect, series.sashWidth);
  win.frame.openings = [splitResult];
  return win;
}

function createTopHungWindow(id: string, x: number, y: number, series: ProfileSeries): WindowUnit {
  const w = 1000, h = 800;
  const win = createWindowUnit(w, h, x, y, series, '上悬窗');
  const opening = win.frame.openings[0];
  opening.sash = createSash('casement-top', opening.rect, series.sashWidth);
  return win;
}

// 新增: 四等分窗 (上下+左右)
function createFourPanelWindow(id: string, x: number, y: number, series: ProfileSeries): WindowUnit {
  const w = 2000, h = 2000;
  const win = createWindowUnit(w, h, x, y, series, '四等分窗');
  const pw = series.frameWidth;
  const mw = series.mullionWidth;
  const innerW = w - pw * 2;
  const innerH = h - pw * 2;
  const midX = pw + innerW / 2;
  const midY = pw + innerH / 2;

  const topOpening = win.frame.openings[0];
  // 先横向分割
  const splitH = splitOpening(topOpening, 'horizontal', midY, mw);
  // 上半部分竖向分割
  const topChild = splitH.childOpenings[0];
  const splitTop = splitOpening(topChild, 'vertical', midX, mw);
  splitTop.childOpenings[0].sash = createSash('casement-left', splitTop.childOpenings[0].rect, series.sashWidth);
  splitTop.childOpenings[1].sash = createSash('casement-right', splitTop.childOpenings[1].rect, series.sashWidth);
  // 下半部分竖向分割
  const bottomChild = splitH.childOpenings[1];
  const splitBottom = splitOpening(bottomChild, 'vertical', midX, mw);
  splitBottom.childOpenings[0].sash = createSash('fixed', splitBottom.childOpenings[0].rect, series.sashWidth);
  splitBottom.childOpenings[1].sash = createSash('fixed', splitBottom.childOpenings[1].rect, series.sashWidth);

  splitH.childOpenings[0] = splitTop;
  splitH.childOpenings[1] = splitBottom;
  win.frame.openings = [splitH];
  return win;
}

// 新增: 内开内倒窗
function createTiltTurnWindow(id: string, x: number, y: number, series: ProfileSeries): WindowUnit {
  const w = 800, h = 1400;
  const win = createWindowUnit(w, h, x, y, series, '内开内倒窗');
  const opening = win.frame.openings[0];
  opening.sash = createSash('tilt-turn-left', opening.rect, series.sashWidth);
  return win;
}

export const WINDOW_TEMPLATES: WindowTemplate[] = [
  {
    id: 'fixed',
    name: '固定窗',
    icon: '⬜',
    description: '不可开启的固定玻璃窗',
    width: 1200,
    height: 1500,
    create: createFixedWindow,
  },
  {
    id: 'single-casement',
    name: '单开窗',
    icon: '◧',
    description: '单扇平开窗',
    width: 800,
    height: 1400,
    create: createSingleCasement,
  },
  {
    id: 'double-casement',
    name: '双开窗',
    icon: '◫',
    description: '双扇对开平开窗',
    width: 1600,
    height: 1500,
    create: createDoubleCasement,
  },
  {
    id: 'three-panel',
    name: '三等分窗',
    icon: '⊞',
    description: '三等分窗（左开+固定+右开）',
    width: 2400,
    height: 1500,
    create: createThreePanelWindow,
  },
  {
    id: 'sliding',
    name: '推拉窗',
    icon: '⇔',
    description: '双扇推拉窗',
    width: 2000,
    height: 1500,
    create: createSlidingWindow,
  },
  {
    id: 'top-hung',
    name: '上悬窗',
    icon: '⬒',
    description: '上悬开启窗',
    width: 1000,
    height: 800,
    create: createTopHungWindow,
  },
  {
    id: 'tilt-turn',
    name: '内开内倒',
    icon: '⊿',
    description: '内开内倒窗',
    width: 800,
    height: 1400,
    create: createTiltTurnWindow,
  },
  {
    id: 'four-panel',
    name: '四等分窗',
    icon: '⊞',
    description: '四等分窗（上开+下固定）',
    width: 2000,
    height: 2000,
    create: createFourPanelWindow,
  },
];
