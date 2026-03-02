// WindoorDesigner - 门窗算料模块
// 根据窗户结构递归计算所有材料用量
// 输出 BOM（Bill of Materials）清单

import type { WindowUnit, Opening, ProfileSeries, SashType } from '@/lib/types';
import { DEFAULT_PROFILE_SERIES } from '@/lib/types';
import { Tokenizer } from './tokenizer';
import { Parser } from './parser';
import { Evaluator } from './evaluator';

// ===== 材料清单类型 =====
export interface BOMItem {
  id: string;
  category: 'frame' | 'mullion' | 'sash' | 'glass' | 'hardware' | 'seal' | 'accessory';
  name: string;
  spec: string;       // 规格描述
  unit: string;       // 单位 (mm, m², 套, 根, 米)
  quantity: number;    // 数量
  length?: number;     // 长度 (mm)
  width?: number;      // 宽度 (mm)
  height?: number;     // 高度 (mm)
  area?: number;       // 面积 (m²)
  weight?: number;     // 重量 (kg)
  unitPrice?: number;  // 单价
  totalPrice?: number; // 总价
  windowId: string;
  windowName: string;
  remark?: string;
}

export interface BOMResult {
  items: BOMItem[];
  summary: {
    totalFrameLength: number;   // mm
    totalMullionLength: number; // mm
    totalSashLength: number;    // mm
    totalGlassArea: number;     // m²
    totalSealLength: number;    // mm
    hardwareCount: number;
    totalWeight: number;        // kg
    totalPrice: number;
  };
}

// ===== 型材线密度 (kg/m) =====
const PROFILE_DENSITY: Record<string, number> = {
  '60': 0.85,
  '65': 0.92,
  '70': 1.05,
  '80': 1.25,
  '85': 1.35,
};

// ===== 五金件配置 =====
const HARDWARE_CONFIG: Record<string, { name: string; unitPrice: number }> = {
  'casement-left': { name: '内开合页(左)', unitPrice: 35 },
  'casement-right': { name: '内开合页(右)', unitPrice: 35 },
  'casement-out-left': { name: '外开合页(左)', unitPrice: 40 },
  'casement-out-right': { name: '外开合页(右)', unitPrice: 40 },
  'casement-top': { name: '上悬滑撑', unitPrice: 45 },
  'casement-bottom': { name: '下悬滑撑', unitPrice: 45 },
  'tilt-turn-left': { name: '内开内倒五金(左)', unitPrice: 120 },
  'tilt-turn-right': { name: '内开内倒五金(右)', unitPrice: 120 },
  'sliding-left': { name: '推拉滑轮(左)', unitPrice: 25 },
  'sliding-right': { name: '推拉滑轮(右)', unitPrice: 25 },
  'folding-left': { name: '折叠五金(左)', unitPrice: 80 },
  'folding-right': { name: '折叠五金(右)', unitPrice: 80 },
  'fixed': { name: '固定件', unitPrice: 5 },
};

// ===== 公式求值辅助 =====
function evalFormula(formula: string, vars: Record<string, number>): number {
  try {
    const tokenizer = new Tokenizer(formula);
    const tokens = tokenizer.tokenize();
    const parser = new Parser();
    const ast = parser.parse(tokens);
    const evaluator = new Evaluator();
    evaluator.setVariables(vars as Record<string, number>);
    const result = evaluator.evaluate(ast);
    return Number(result) || 0;
  } catch {
    return 0;
  }
}

// ===== 切割余量 =====
const CUT_MARGIN = 3; // mm, 型材切割余量

// ===== 主算料函数 =====
export function calculateBOM(windows: WindowUnit[]): BOMResult {
  const items: BOMItem[] = [];
  let idCounter = 0;
  const nextId = () => `bom-${++idCounter}`;

  for (const win of windows) {
    const series = DEFAULT_PROFILE_SERIES.find(s => s.id === win.profileSeriesId) || DEFAULT_PROFILE_SERIES[2];
    const seriesNum = series.name.replace(/[^0-9]/g, '') || '70';
    const density = PROFILE_DENSITY[seriesNum] || 1.05;

    // ===== 1. 框料 =====
    const fw = series.frameWidth;
    const fd = series.frameDepth;

    // 上框
    const topLength = win.width;
    items.push({
      id: nextId(), category: 'frame', name: '上框型材',
      spec: `${series.name} ${fw}×${fd}mm`, unit: 'mm',
      quantity: 1, length: topLength,
      weight: topLength * density / 1000,
      windowId: win.id, windowName: win.name,
    });
    // 下框
    items.push({
      id: nextId(), category: 'frame', name: '下框型材',
      spec: `${series.name} ${fw}×${fd}mm`, unit: 'mm',
      quantity: 1, length: win.width,
      weight: win.width * density / 1000,
      windowId: win.id, windowName: win.name,
    });
    // 左框
    const sideLength = win.height - 2 * fw; // 减去上下框
    items.push({
      id: nextId(), category: 'frame', name: '左框型材',
      spec: `${series.name} ${fw}×${fd}mm`, unit: 'mm',
      quantity: 1, length: sideLength,
      weight: sideLength * density / 1000,
      windowId: win.id, windowName: win.name,
    });
    // 右框
    items.push({
      id: nextId(), category: 'frame', name: '右框型材',
      spec: `${series.name} ${fw}×${fd}mm`, unit: 'mm',
      quantity: 1, length: sideLength,
      weight: sideLength * density / 1000,
      windowId: win.id, windowName: win.name,
    });

    // ===== 2. 递归计算分格内容 =====
    calcOpeningBOM(win.frame.openings, win, series, density, items, nextId);
  }

  // ===== 汇总 =====
  const summary = {
    totalFrameLength: items.filter(i => i.category === 'frame').reduce((s, i) => s + (i.length || 0), 0),
    totalMullionLength: items.filter(i => i.category === 'mullion').reduce((s, i) => s + (i.length || 0), 0),
    totalSashLength: items.filter(i => i.category === 'sash').reduce((s, i) => s + (i.length || 0), 0),
    totalGlassArea: items.filter(i => i.category === 'glass').reduce((s, i) => s + (i.area || 0), 0),
    totalSealLength: items.filter(i => i.category === 'seal').reduce((s, i) => s + (i.length || 0), 0),
    hardwareCount: items.filter(i => i.category === 'hardware').reduce((s, i) => s + i.quantity, 0),
    totalWeight: items.reduce((s, i) => s + (i.weight || 0), 0),
    totalPrice: items.reduce((s, i) => s + (i.totalPrice || 0), 0),
  };

  return { items, summary };
}

function calcOpeningBOM(
  openings: Opening[],
  win: WindowUnit,
  series: ProfileSeries,
  density: number,
  items: BOMItem[],
  nextId: () => string
): void {
  for (const opening of openings) {
    const mw = series.mullionWidth;

    // 中梃
    for (const mullion of opening.mullions) {
      const mullionLength = mullion.type === 'vertical'
        ? opening.rect.height
        : opening.rect.width;

      items.push({
        id: nextId(), category: 'mullion', name: `${mullion.type === 'vertical' ? '竖' : '横'}中梃`,
        spec: `${series.name} ${mw}mm`, unit: 'mm',
        quantity: 1, length: mullionLength,
        weight: mullionLength * density * 0.8 / 1000, // 中梃比框略轻
        windowId: win.id, windowName: win.name,
      });
    }

    if (opening.isSplit && opening.childOpenings.length > 0) {
      calcOpeningBOM(opening.childOpenings, win, series, density, items, nextId);
    } else {
      const r = opening.rect;
      const glassGap = 3; // mm, 玻璃与型材间隙

      // ===== 3. 玻璃 =====
      const glassW = r.width - 2 * glassGap;
      const glassH = r.height - 2 * glassGap;
      const glassArea = glassW * glassH / 1000000; // m²

      items.push({
        id: nextId(), category: 'glass', name: '中空玻璃',
        spec: `5+12A+5mm ${Math.round(glassW)}×${Math.round(glassH)}`,
        unit: 'm²', quantity: 1,
        width: glassW, height: glassH, area: glassArea,
        weight: glassArea * 25, // ~25 kg/m² for double glazing
        windowId: win.id, windowName: win.name,
      });

      // ===== 4. 扇料 =====
      if (opening.sash) {
        const sw = series.sashWidth;
        const sashType = opening.sash.type;

        // 扇框四边
        const sashTopBottom = r.width;
        const sashLeftRight = r.height - 2 * sw;

        items.push({
          id: nextId(), category: 'sash', name: '扇上横',
          spec: `${series.name} 扇料 ${sw}mm`, unit: 'mm',
          quantity: 1, length: sashTopBottom,
          weight: sashTopBottom * density * 0.6 / 1000,
          windowId: win.id, windowName: win.name,
        });
        items.push({
          id: nextId(), category: 'sash', name: '扇下横',
          spec: `${series.name} 扇料 ${sw}mm`, unit: 'mm',
          quantity: 1, length: sashTopBottom,
          weight: sashTopBottom * density * 0.6 / 1000,
          windowId: win.id, windowName: win.name,
        });
        items.push({
          id: nextId(), category: 'sash', name: '扇左竖',
          spec: `${series.name} 扇料 ${sw}mm`, unit: 'mm',
          quantity: 1, length: sashLeftRight,
          weight: sashLeftRight * density * 0.6 / 1000,
          windowId: win.id, windowName: win.name,
        });
        items.push({
          id: nextId(), category: 'sash', name: '扇右竖',
          spec: `${series.name} 扇料 ${sw}mm`, unit: 'mm',
          quantity: 1, length: sashLeftRight,
          weight: sashLeftRight * density * 0.6 / 1000,
          windowId: win.id, windowName: win.name,
        });

        // ===== 5. 五金件 =====
        const hw = HARDWARE_CONFIG[sashType] || HARDWARE_CONFIG['fixed'];
        const hwCount = (sashType.includes('casement') || sashType.includes('tilt')) ? 2 : 1;
        items.push({
          id: nextId(), category: 'hardware', name: hw.name,
          spec: sashType, unit: '套',
          quantity: hwCount,
          unitPrice: hw.unitPrice,
          totalPrice: hwCount * hw.unitPrice,
          windowId: win.id, windowName: win.name,
        });

        // 执手
        if (sashType !== 'fixed' && !sashType.includes('sliding')) {
          items.push({
            id: nextId(), category: 'hardware', name: '执手',
            spec: '标准执手', unit: '个',
            quantity: 1,
            unitPrice: 25,
            totalPrice: 25,
            windowId: win.id, windowName: win.name,
          });
        }

        // 锁点
        if (sashType !== 'fixed') {
          const lockCount = Math.max(2, Math.ceil((r.width + r.height) / 500));
          items.push({
            id: nextId(), category: 'hardware', name: '锁点',
            spec: '蘑菇头锁点', unit: '个',
            quantity: lockCount,
            unitPrice: 8,
            totalPrice: lockCount * 8,
            windowId: win.id, windowName: win.name,
          });
        }
      }

      // ===== 6. 密封条 =====
      const sealLength = 2 * (r.width + r.height);
      items.push({
        id: nextId(), category: 'seal', name: '玻璃密封胶条',
        spec: 'EPDM', unit: 'mm',
        quantity: 1, length: sealLength,
        windowId: win.id, windowName: win.name,
      });

      if (opening.sash && opening.sash.type !== 'fixed') {
        items.push({
          id: nextId(), category: 'seal', name: '扇密封胶条',
          spec: 'EPDM', unit: 'mm',
          quantity: 1, length: sealLength,
          windowId: win.id, windowName: win.name,
        });
      }
    }
  }
}

// ===== 按窗户分组 =====
export function groupBOMByWindow(result: BOMResult): Record<string, BOMItem[]> {
  const groups: Record<string, BOMItem[]> = {};
  for (const item of result.items) {
    const key = `${item.windowId}|${item.windowName}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

// ===== 按类别分组 =====
export function groupBOMByCategory(result: BOMResult): Record<string, BOMItem[]> {
  const groups: Record<string, BOMItem[]> = {};
  for (const item of result.items) {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  }
  return groups;
}
