// WindoorDesigner - 边界条件校验工具函数
// 所有交互操作的校验规则

import type { Opening } from '@windoor/shared';
import { CONSTRAINTS } from '@windoor/shared';

/** 校验结果 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 校验窗户尺寸是否合法
 */
export function validateWindowSize(width: number, height: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (width < CONSTRAINTS.MIN_WINDOW_WIDTH) {
    errors.push(`窗户宽度不能小于 ${CONSTRAINTS.MIN_WINDOW_WIDTH}mm`);
  }
  if (width > CONSTRAINTS.MAX_WINDOW_WIDTH) {
    errors.push(`窗户宽度不能大于 ${CONSTRAINTS.MAX_WINDOW_WIDTH}mm`);
  }
  if (height < CONSTRAINTS.MIN_WINDOW_HEIGHT) {
    errors.push(`窗户高度不能小于 ${CONSTRAINTS.MIN_WINDOW_HEIGHT}mm`);
  }
  if (height > CONSTRAINTS.MAX_WINDOW_HEIGHT) {
    errors.push(`窗户高度不能大于 ${CONSTRAINTS.MAX_WINDOW_HEIGHT}mm`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * 校验中梃放置位置是否合法
 */
export function validateMullionPlacement(
  opening: Opening,
  direction: 'vertical' | 'horizontal',
  position: number,
  mullionWidth: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const halfMullion = mullionWidth / 2;
  const minEdge = CONSTRAINTS.MIN_MULLION_EDGE;
  const minSize = CONSTRAINTS.MIN_OPENING_SIZE;

  if (direction === 'vertical') {
    const leftSpace = position - opening.rect.x - halfMullion;
    const rightSpace = opening.rect.x + opening.rect.width - position - halfMullion;

    if (leftSpace < minEdge) {
      errors.push(`左侧空间不足 (${Math.round(leftSpace)}mm < ${minEdge}mm)`);
    }
    if (rightSpace < minEdge) {
      errors.push(`右侧空间不足 (${Math.round(rightSpace)}mm < ${minEdge}mm)`);
    }
    if (leftSpace < minSize) {
      errors.push(`左侧分格宽度不足 (${Math.round(leftSpace)}mm < ${minSize}mm)`);
    }
    if (rightSpace < minSize) {
      errors.push(`右侧分格宽度不足 (${Math.round(rightSpace)}mm < ${minSize}mm)`);
    }
  } else {
    const topSpace = position - opening.rect.y - halfMullion;
    const bottomSpace = opening.rect.y + opening.rect.height - position - halfMullion;

    if (topSpace < minEdge) {
      errors.push(`上方空间不足 (${Math.round(topSpace)}mm < ${minEdge}mm)`);
    }
    if (bottomSpace < minEdge) {
      errors.push(`下方空间不足 (${Math.round(bottomSpace)}mm < ${minEdge}mm)`);
    }
    if (topSpace < minSize) {
      errors.push(`上方分格高度不足 (${Math.round(topSpace)}mm < ${minSize}mm)`);
    }
    if (bottomSpace < minSize) {
      errors.push(`下方分格高度不足 (${Math.round(bottomSpace)}mm < ${minSize}mm)`);
    }
  }

  // 检查与已有中梃的间距
  for (const existingMullion of opening.mullions) {
    if (existingMullion.type === direction) {
      const dist = Math.abs(existingMullion.position - position);
      if (dist < CONSTRAINTS.MIN_MULLION_SPACING) {
        errors.push(`与已有中梃间距不足 (${Math.round(dist)}mm < ${CONSTRAINTS.MIN_MULLION_SPACING}mm)`);
      }
    }
  }

  // 检查扇互斥
  if (opening.sash) {
    errors.push('该分格已有扇，请先删除扇再添加中梃');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * 校验扇放置是否合法
 */
export function validateSashPlacement(opening: Opening): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (opening.childOpenings.length > 0) {
    errors.push('该分格已被分割，不能添加扇');
  }

  if (opening.sash) {
    warnings.push('该分格已有扇，将替换现有扇');
  }

  // 开启扇尺寸建议
  if (opening.rect.width < CONSTRAINTS.MIN_SASH_WIDTH) {
    warnings.push(`分格宽度 ${Math.round(opening.rect.width)}mm 小于推荐最小值 ${CONSTRAINTS.MIN_SASH_WIDTH}mm`);
  }
  if (opening.rect.height < CONSTRAINTS.MIN_SASH_HEIGHT) {
    warnings.push(`分格高度 ${Math.round(opening.rect.height)}mm 小于推荐最小值 ${CONSTRAINTS.MIN_SASH_HEIGHT}mm`);
  }

  return { valid: errors.length === 0, errors, warnings };
}
