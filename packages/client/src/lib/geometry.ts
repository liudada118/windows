// WindoorDesigner - 几何计算工具函数
// 提供画布坐标转换、碰撞检测等基础几何计算

import type { Rect, Point, Opening, Mullion } from '@windoor/shared';

/**
 * 判断点是否在矩形内
 */
export function pointInRect(px: number, py: number, rect: Rect): boolean {
  return (
    px >= rect.x &&
    px <= rect.x + rect.width &&
    py >= rect.y &&
    py <= rect.y + rect.height
  );
}

/**
 * 在 Opening 树中递归查找包含指定点的叶子 Opening
 */
export function findLeafOpeningAtPoint(
  opening: Opening,
  x: number,
  y: number
): Opening | null {
  if (!pointInRect(x, y, opening.rect)) return null;

  // 如果有子 Opening，递归查找
  if (opening.childOpenings.length > 0) {
    for (const child of opening.childOpenings) {
      const found = findLeafOpeningAtPoint(child, x, y);
      if (found) return found;
    }
    return null;
  }

  // 叶子节点
  return opening;
}

/**
 * 在 Opening 树中递归查找指定 ID 的 Opening
 */
export function findOpeningById(
  opening: Opening,
  id: string
): Opening | null {
  if (opening.id === id) return opening;
  for (const child of opening.childOpenings) {
    const found = findOpeningById(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * 在 Opening 树中查找包含指定点的中梃
 * tolerance 是额外的命中扩展（mm），实际命中区域 = profileWidth/2 + tolerance
 */
export function findMullionAtPoint(
  opening: Opening,
  x: number,
  y: number,
  tolerance: number = 8
): { mullion: Mullion; parentOpening: Opening } | null {
  for (const mullion of opening.mullions) {
    // 使用中梃实际宽度来判断命中，命中区域 = profileWidth/2 + tolerance
    const halfWidth = (mullion.profileWidth || 70) / 2 + tolerance;
    if (mullion.type === 'vertical') {
      if (
        Math.abs(x - mullion.position) < halfWidth &&
        y >= opening.rect.y &&
        y <= opening.rect.y + opening.rect.height
      ) {
        return { mullion, parentOpening: opening };
      }
    } else {
      if (
        Math.abs(y - mullion.position) < halfWidth &&
        x >= opening.rect.x &&
        x <= opening.rect.x + opening.rect.width
      ) {
        return { mullion, parentOpening: opening };
      }
    }
  }

  for (const child of opening.childOpenings) {
    const found = findMullionAtPoint(child, x, y, tolerance);
    if (found) return found;
  }

  return null;
}

/**
 * 将网格吸附值
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * 计算两点之间的距离
 */
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * 限制数值在指定范围内
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
