/**
 * 算料引擎 - 核心计算模块
 * 
 * 将公式库中的公式应用到窗户设计数据上，计算出完整的材料清单。
 * 
 * 变量说明 (与画门窗软件一致):
 *   cc = 当前构件的计算尺寸 (由上下文决定: 框宽/框高/扇宽/扇高等)
 *   frame_width = 窗户总宽
 *   frame_height = 窗户总高
 *   sash_width = 扇宽
 *   sash_height = 扇高
 *   glass_perimeter = 玻璃周长
 *   sash_perimeter = 扇周长
 *   overlap = 搭接数量
 *   sashCount = 扇数量
 */

import type { Formula, ProfileFormula, GlassFormula, AddonFormula, PricingRule } from '../types/formula';

// ===== 算料结果类型 =====

export interface MaterialItem {
  name: string;
  type: string;
  length?: number;   // mm
  width?: number;    // mm (玻璃)
  height?: number;   // mm (玻璃)
  count: number;
  unit: string;      // mm, 支, 块, 个, 米, 瓶
  note?: string;
}

export interface QuoteItem {
  name: string;
  price: number;
  quantity: number;
  unit: string;
  amount: number;
}

export interface CalculationResult {
  profiles: MaterialItem[];
  glass: MaterialItem[];
  addons: MaterialItem[];
  quote: QuoteItem[];
  totalPrice: number;
  totalArea: number;
}

// ===== 公式求值器 =====

function evaluateFormula(formula: string, variables: Record<string, number>): number {
  if (!formula || formula.trim() === '') return 0;

  let expr = formula;

  // 替换变量 (按变量名长度降序排列，避免短名覆盖长名)
  const sortedVars = Object.entries(variables).sort((a, b) => b[0].length - a[0].length);
  for (const [key, value] of sortedVars) {
    expr = expr.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value));
  }

  // 处理中文括号
  expr = expr.replace(/（/g, '(').replace(/）/g, ')');

  // 安全求值 (仅允许数字和算术运算符)
  const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, '');
  if (sanitized !== expr.replace(/\s/g, '')) {
    console.warn(`[算料引擎] 公式包含非法字符: "${formula}" -> "${expr}"`);
    return 0;
  }

  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${sanitized})`)();
    return typeof result === 'number' && !isNaN(result) ? Math.round(result) : 0;
  } catch (e) {
    console.warn(`[算料引擎] 公式计算失败: "${formula}" -> "${sanitized}"`, e);
    return 0;
  }
}

// ===== 从窗户数据提取计算变量 =====

interface WindowInput {
  width: number;       // 窗户总宽 mm
  height: number;      // 窗户总高 mm
  sashCount: number;   // 开启扇数量
  sashRects: Array<{ width: number; height: number }>; // 每个扇的尺寸
  mullionCount: number; // 中梃数量
  hasScreen: boolean;  // 是否有纱扇
  isDouble: boolean;   // 是否对开
}

function buildVariables(input: WindowInput, params: Record<string, number>): Record<string, number> {
  const { width, height, sashCount, sashRects, mullionCount } = input;
  const avgSashWidth = sashRects.length > 0 ? sashRects.reduce((s, r) => s + r.width, 0) / sashRects.length : 0;
  const avgSashHeight = sashRects.length > 0 ? sashRects.reduce((s, r) => s + r.height, 0) / sashRects.length : 0;

  return {
    ...params,
    frame_width: width,
    frame_height: height,
    sash_width: avgSashWidth,
    sash_height: avgSashHeight,
    sashCount,
    mullionCount,
    glass_perimeter: (avgSashWidth + avgSashHeight) * 2,
    sash_perimeter: (avgSashWidth + avgSashHeight) * 2,
    perimeter: (width + height) * 2,
    area: (width * height) / 1000000,
  };
}

// ===== 计算型材 =====

function calculateProfiles(
  formulas: ProfileFormula[],
  variables: Record<string, number>,
  frameWidth: number,
  frameHeight: number,
  sashRects: Array<{ width: number; height: number }>,
): MaterialItem[] {
  const results: MaterialItem[] = [];

  for (const f of formulas) {
    // 根据型材类型确定 cc 的值
    let ccValues: number[] = [];

    switch (f.type) {
      case 'frame':
      case 'upTrack':
      case 'downTrack':
        // 框: 横向用宽度, 纵向用高度
        if (f.position?.includes('left') || f.position?.includes('right')) {
          ccValues = [frameHeight];
        } else if (f.position?.includes('up') || f.position?.includes('down')) {
          ccValues = [frameWidth];
        } else {
          // 默认: 上下横用宽度, 左右竖用高度, 各2根
          ccValues = [frameWidth, frameWidth, frameHeight, frameHeight];
        }
        break;

      case 'mullion':
        // 中梃: 竖中梃用高度, 横中梃用宽度
        ccValues = [frameHeight]; // 默认竖中梃
        break;

      case 'sash':
      case 'screen':
      case 'antiTheft':
        // 扇: 每个扇的上下横用扇宽, 左右竖用扇高
        for (const rect of sashRects) {
          ccValues.push(rect.width, rect.width, rect.height, rect.height);
        }
        break;

      case 'sashBead':
        // 扇压线
        if (f.position?.includes('up') || f.position?.includes('down')) {
          for (const rect of sashRects) ccValues.push(rect.width);
        } else {
          for (const rect of sashRects) ccValues.push(rect.height);
        }
        break;

      case 'fixedBead':
        // 固定压线
        if (f.position?.includes('up') || f.position?.includes('down')) {
          ccValues = [frameWidth];
        } else {
          ccValues = [frameHeight];
        }
        if (ccValues.length === 0) {
          ccValues = [frameWidth, frameWidth, frameHeight, frameHeight];
        }
        break;

      case 'cornerJoiner':
        ccValues = [variables.cornerJoiner || 100];
        break;

      default:
        ccValues = [frameWidth];
    }

    for (const cc of ccValues) {
      const vars = { ...variables, cc };
      const length = evaluateFormula(f.length, vars);
      const count = evaluateFormula(f.count, vars);

      if (length > 0 && count > 0) {
        results.push({
          name: f.name,
          type: f.type,
          length,
          count,
          unit: 'mm',
          note: f.note,
        });
      }
    }
  }

  return results;
}

// ===== 计算玻璃 =====

function calculateGlass(
  formulas: GlassFormula[],
  variables: Record<string, number>,
  frameWidth: number,
  frameHeight: number,
  sashRects: Array<{ width: number; height: number }>,
): MaterialItem[] {
  const results: MaterialItem[] = [];

  for (const f of formulas) {
    if (f.type === 'fixedGlass') {
      // 固玻: 用框的宽高
      const wVars = { ...variables, cc: frameWidth };
      const hVars = { ...variables, cc: frameHeight };
      const w = evaluateFormula(f.width, wVars);
      const h = evaluateFormula(f.height, hVars);
      if (w > 0 && h > 0) {
        results.push({ name: f.name, type: f.type, width: w, height: h, count: 1, unit: '块', note: f.note });
      }
    } else if (f.type === 'sashGlass') {
      // 扇玻: 用每个扇的宽高
      for (const rect of sashRects) {
        const wVars = { ...variables, cc: rect.width };
        const hVars = { ...variables, cc: rect.height };
        const w = evaluateFormula(f.width, wVars);
        const h = evaluateFormula(f.height, hVars);
        if (w > 0 && h > 0) {
          results.push({ name: f.name, type: f.type, width: w, height: h, count: 1, unit: '块', note: f.note });
        }
      }
    }
  }

  return results;
}

// ===== 计算辅材 =====

function calculateAddons(
  formulas: AddonFormula[],
  variables: Record<string, number>,
): MaterialItem[] {
  const results: MaterialItem[] = [];

  for (const f of formulas) {
    const count = evaluateFormula(f.count, variables);
    if (count > 0) {
      results.push({
        name: f.name,
        type: 'addon',
        count: Math.ceil(count),
        unit: '个',
        note: f.note,
      });
    }
  }

  return results;
}

// ===== 计算报价 =====

function calculateQuote(
  pricing: PricingRule[],
  area: number,
  sashCount: number,
): QuoteItem[] {
  const results: QuoteItem[] = [];

  for (const rule of pricing) {
    let quantity = 0;
    let price = typeof rule.price === 'number' ? rule.price : 0;
    let unit = '';

    switch (rule.type) {
      case 'area':
        quantity = Math.max(area, rule.minArea || 0);
        unit = 'm²';
        break;
      case 'sash':
        quantity = sashCount;
        unit = '个';
        break;
      case 'corner':
        quantity = 0; // 需要从设计数据中获取转角数
        unit = '个';
        break;
      case 'track':
        quantity = 0; // 需要从设计数据中获取轨道长度
        unit = '米';
        break;
      default:
        continue;
    }

    if (quantity > 0 && price > 0) {
      results.push({
        name: rule.name,
        price,
        quantity: parseFloat(quantity.toFixed(2)),
        unit,
        amount: parseFloat((quantity * price).toFixed(2)),
      });
    }
  }

  return results;
}

// ===== 主计算函数 =====

export function calculateMaterials(
  formula: Formula,
  input: WindowInput,
): CalculationResult {
  const variables = buildVariables(input, formula.parameters);
  const area = (input.width * input.height) / 1000000;

  const profiles = calculateProfiles(
    formula.profiles,
    variables,
    input.width,
    input.height,
    input.sashRects,
  );

  const glass = calculateGlass(
    formula.glass,
    variables,
    input.width,
    input.height,
    input.sashRects,
  );

  const addons = calculateAddons(formula.addons, variables);

  const quote = calculateQuote(formula.pricing, area, input.sashCount);

  const totalPrice = quote.reduce((sum, q) => sum + q.amount, 0);

  return {
    profiles,
    glass,
    addons,
    quote,
    totalPrice,
    totalArea: parseFloat(area.toFixed(2)),
  };
}

// ===== 从 WindowUnit 提取 WindowInput =====

export function extractWindowInput(window: {
  width: number;
  height: number;
  frame: {
    profileWidth: number;
    openings: Array<{
      sash: { type: string; rect: { width: number; height: number } } | null;
      mullions: Array<{ type: string }>;
      childOpenings: Array<{
        sash: { type: string; rect: { width: number; height: number } } | null;
      }>;
    }>;
  };
}): WindowInput {
  const sashRects: Array<{ width: number; height: number }> = [];
  let mullionCount = 0;
  let hasScreen = false;

  function collectSashes(openings: typeof window.frame.openings) {
    for (const opening of openings) {
      mullionCount += opening.mullions.length;

      if (opening.sash && opening.sash.type !== 'fixed') {
        sashRects.push({
          width: opening.sash.rect.width,
          height: opening.sash.rect.height,
        });
      }

      if (opening.childOpenings) {
        for (const child of opening.childOpenings) {
          if (child.sash && child.sash.type !== 'fixed') {
            sashRects.push({
              width: child.sash.rect.width,
              height: child.sash.rect.height,
            });
          }
        }
      }
    }
  }

  collectSashes(window.frame.openings);

  return {
    width: window.width,
    height: window.height,
    sashCount: sashRects.length,
    sashRects,
    mullionCount,
    hasScreen,
    isDouble: sashRects.length === 2,
  };
}
