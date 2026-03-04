// WindoorDesigner - 尺寸标注命中检测
// 用于判断双击位置是否命中某个尺寸标注区域

import type { WindowUnit, Opening, Mullion } from './types';

const MM_TO_PX = 0.5;

export type DimensionTarget =
  | { type: 'window-width'; windowId: string; currentValue: number }
  | { type: 'window-height'; windowId: string; currentValue: number }
  | { type: 'opening-width'; windowId: string; openingId: string; mullionId: string; childIndex: number; currentValue: number; parentOpening: Opening }
  | { type: 'opening-height'; windowId: string; openingId: string; mullionId: string; childIndex: number; currentValue: number; parentOpening: Opening }
  | { type: 'mullion'; windowId: string; mullionId: string; mullionType: 'vertical' | 'horizontal'; currentPosition: number; parentOpening: Opening };

/**
 * 检测屏幕坐标是否命中某个尺寸标注
 * @param sx 屏幕X坐标（相对于画布容器）
 * @param sy 屏幕Y坐标（相对于画布容器）
 * @param windows 所有窗户
 * @param zoom 缩放
 * @param panX 平移X
 * @param panY 平移Y
 * @returns 命中的尺寸目标，或null
 */
export function hitTestDimension(
  sx: number,
  sy: number,
  windows: WindowUnit[],
  zoom: number,
  panX: number,
  panY: number,
): DimensionTarget | null {
  const scale = MM_TO_PX * zoom;
  const hitRadius = 20; // 命中半径（像素）

  for (const win of windows) {
    const ox = win.posX * scale + panX;
    const oy = win.posY * scale + panY;
    const w = win.width * scale;
    const h = win.height * scale;
    const offset = 28;

    // 1. 宽度标注（窗口上方）
    const widthLabelX = ox + w / 2;
    const widthLabelY = oy - offset;
    if (Math.abs(sx - widthLabelX) < 40 && Math.abs(sy - widthLabelY) < hitRadius) {
      return { type: 'window-width', windowId: win.id, currentValue: win.width };
    }

    // 2. 高度标注（窗口右侧）
    const heightLabelX = ox + w + offset;
    const heightLabelY = oy + h / 2;
    if (Math.abs(sx - heightLabelX) < hitRadius && Math.abs(sy - heightLabelY) < 40) {
      return { type: 'window-height', windowId: win.id, currentValue: win.height };
    }

    // 3. 分格尺寸标注
    const openingHit = hitTestOpeningDimensions(
      sx, sy, win.frame.openings, win.id, win.posX, win.posY,
      oy + h + 18, ox - 18, scale, hitRadius
    );
    if (openingHit) return openingHit;
  }

  return null;
}

function hitTestOpeningDimensions(
  sx: number,
  sy: number,
  openings: Opening[],
  windowId: string,
  winPosX: number,
  winPosY: number,
  bottomY: number,
  leftX: number,
  scale: number,
  hitRadius: number,
): DimensionTarget | null {
  for (const opening of openings) {
    if (!opening.isSplit) continue;

    for (const mullion of opening.mullions) {
      if (mullion.type === 'vertical' && opening.childOpenings.length >= 2) {
        // 分格宽度标注（窗口下方）
        for (let i = 0; i < opening.childOpenings.length; i++) {
          const child = opening.childOpenings[i];
          const cx = (winPosX + child.rect.x) * scale;
          const cw = child.rect.width * scale;
          const labelX = cx + cw / 2;
          const labelY = bottomY + 10;

          if (Math.abs(sx - labelX) < 35 && Math.abs(sy - labelY) < hitRadius) {
            return {
              type: 'opening-width',
              windowId,
              openingId: opening.id,
              mullionId: mullion.id,
              childIndex: i,
              currentValue: Math.round(child.rect.width),
              parentOpening: opening,
            };
          }
        }
      }

      if (mullion.type === 'horizontal' && opening.childOpenings.length >= 2) {
        // 分格高度标注（窗口左侧）
        for (let i = 0; i < opening.childOpenings.length; i++) {
          const child = opening.childOpenings[i];
          const cy = (winPosY + child.rect.y) * scale;
          const ch = child.rect.height * scale;
          const labelX = leftX - 4;
          const labelY = cy + ch / 2;

          if (Math.abs(sx - labelX) < hitRadius && Math.abs(sy - labelY) < 35) {
            return {
              type: 'opening-height',
              windowId,
              openingId: opening.id,
              mullionId: mullion.id,
              childIndex: i,
              currentValue: Math.round(child.rect.height),
              parentOpening: opening,
            };
          }
        }
      }
    }

    // 递归检查子Opening
    const childHit = hitTestOpeningDimensions(
      sx, sy, opening.childOpenings, windowId, winPosX, winPosY,
      bottomY, leftX, scale, hitRadius
    );
    if (childHit) return childHit;
  }

  return null;
}

/**
 * 根据分格尺寸变化计算新的中梃位置
 */
export function calculateNewMullionPosition(
  target: Extract<DimensionTarget, { type: 'opening-width' | 'opening-height' }>,
  newSize: number,
): number {
  const { parentOpening, mullionId, childIndex } = target;
  const mullion = parentOpening.mullions.find(m => m.id === mullionId);
  if (!mullion) return 0;

  const halfMullion = mullion.profileWidth / 2;

  if (target.type === 'opening-width') {
    if (childIndex === 0) {
      // 修改左侧分格宽度：中梃位置 = 分格起点 + 新宽度 + 半中梃宽
      return parentOpening.childOpenings[0].rect.x + newSize + halfMullion;
    } else {
      // 修改右侧分格宽度：中梃位置 = 分格终点 - 新宽度 - 半中梃宽
      const child = parentOpening.childOpenings[childIndex];
      return child.rect.x + child.rect.width - newSize - halfMullion;
    }
  } else {
    if (childIndex === 0) {
      // 修改上侧分格高度
      return parentOpening.childOpenings[0].rect.y + newSize + halfMullion;
    } else {
      // 修改下侧分格高度
      const child = parentOpening.childOpenings[childIndex];
      return child.rect.y + child.rect.height - newSize - halfMullion;
    }
  }
}

/**
 * 计算尺寸标注在屏幕上的位置（用于放置输入框）
 */
export function getDimensionScreenPosition(
  target: DimensionTarget,
  windows: WindowUnit[],
  zoom: number,
  panX: number,
  panY: number,
): { x: number; y: number } {
  const scale = MM_TO_PX * zoom;
  const win = windows.find(w => w.id === target.windowId);
  if (!win) return { x: 0, y: 0 };

  const ox = win.posX * scale + panX;
  const oy = win.posY * scale + panY;
  const w = win.width * scale;
  const h = win.height * scale;

  switch (target.type) {
    case 'window-width':
      return { x: ox + w / 2, y: oy - 28 };
    case 'window-height':
      return { x: ox + w + 28, y: oy + h / 2 };
    case 'opening-width': {
      const child = target.parentOpening.childOpenings[target.childIndex];
      const cx = (win.posX + child.rect.x) * scale + panX;
      const cw = child.rect.width * scale;
      return { x: cx + cw / 2, y: oy + h + 28 };
    }
    case 'opening-height': {
      const child = target.parentOpening.childOpenings[target.childIndex];
      const cy = (win.posY + child.rect.y) * scale + panY;
      const ch = child.rect.height * scale;
      return { x: ox - 28, y: cy + ch / 2 };
    }
    case 'mullion':
      return { x: ox + w / 2, y: oy + h / 2 };
    default:
      return { x: 0, y: 0 };
  }
}
