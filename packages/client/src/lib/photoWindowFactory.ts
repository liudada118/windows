// WindoorDesigner - 拍照识别 → 窗户数据模型转换
// 将 PhotoRecognitionResult 转换为 WindowUnit / CompositeWindow
// 支持生成单窗和组合窗（L形/U形/凸窗）

import { nanoid } from 'nanoid';
import type {
  WindowUnit,
  CompositeWindow,
  CompositePanel,
  ProfileSeries,
} from './types';
import { DEFAULT_PROFILE_SERIES } from './types';
import type { PhotoRecognitionResult, RecognizedPanel } from './photoRecognition';
import {
  createWindowUnit,
  createSash,
  splitOpening,
} from './window-factory';

// ===== 从识别结果创建单个 WindowUnit =====

function createPanelWindowUnit(
  panel: RecognizedPanel,
  series: ProfileSeries,
  sashTypes: string[],
  panelIndex: number
): WindowUnit {
  const w = Math.max(panel.width, 200);
  const h = Math.max(panel.height, 200);

  const win = createWindowUnit(w, h, 0, 0, series, panel.label);

  // 根据面板宽度决定分格
  if (w > 1500 && sashTypes.length >= 2) {
    // 宽面板 → 分两格
    const pw = series.frameWidth;
    const mw = series.mullionWidth;
    const innerW = w - pw * 2;
    const midX = pw + innerW / 2;

    const rootOpening = win.frame.openings[0];
    const split = splitOpening(rootOpening, 'vertical', midX, mw);

    // 设置扇类型
    const leftType = mapSashType(sashTypes[0]) || 'sliding-left';
    const rightType = mapSashType(sashTypes[1]) || 'sliding-right';

    split.childOpenings[0].sash = createSash(
      leftType as any,
      split.childOpenings[0].rect,
      series.sashWidth
    );
    split.childOpenings[1].sash = createSash(
      rightType as any,
      split.childOpenings[1].rect,
      series.sashWidth
    );

    win.frame.openings = [split];
  } else if (w > 2200 && sashTypes.length >= 3) {
    // 超宽面板 → 分三格
    const pw = series.frameWidth;
    const mw = series.mullionWidth;
    const innerW = w - pw * 2;
    const pos1 = pw + innerW / 3;

    const rootOpening = win.frame.openings[0];
    const split1 = splitOpening(rootOpening, 'vertical', pos1, mw);
    const rightChild = split1.childOpenings[1];
    const adjustedPos2 = rightChild.rect.x + rightChild.rect.width / 2;
    const split2 = splitOpening(rightChild, 'vertical', adjustedPos2, mw);

    split1.childOpenings[0].sash = createSash(
      (mapSashType(sashTypes[0]) || 'casement-left') as any,
      split1.childOpenings[0].rect,
      series.sashWidth
    );
    split2.childOpenings[0].sash = createSash(
      (mapSashType(sashTypes[1]) || 'fixed') as any,
      split2.childOpenings[0].rect,
      series.sashWidth
    );
    split2.childOpenings[1].sash = createSash(
      (mapSashType(sashTypes[2]) || 'casement-right') as any,
      split2.childOpenings[1].rect,
      series.sashWidth
    );

    split1.childOpenings[1] = split2;
    win.frame.openings = [split1];
  } else {
    // 单格
    const opening = win.frame.openings[0];
    const sashType = sashTypes[panelIndex] || sashTypes[0] || 'fixed';
    opening.sash = createSash(
      (mapSashType(sashType) || 'fixed') as any,
      opening.rect,
      series.sashWidth
    );
  }

  return win;
}

// ===== 扇类型映射 =====

function mapSashType(type: string): string {
  const typeMap: Record<string, string> = {
    'fixed': 'fixed',
    'casement-left': 'casement-left',
    'casement-right': 'casement-right',
    'casement-out-left': 'casement-out-left',
    'casement-out-right': 'casement-out-right',
    'casement-top': 'casement-top',
    'casement-bottom': 'casement-bottom',
    'tilt-turn-left': 'tilt-turn-left',
    'tilt-turn-right': 'tilt-turn-right',
    'sliding-left': 'sliding-left',
    'sliding-right': 'sliding-right',
    'folding-left': 'folding-left',
    'folding-right': 'folding-right',
  };
  return typeMap[type] || 'fixed';
}

// ===== 从识别结果创建 CompositeWindow =====

export function createCompositeFromRecognition(
  result: PhotoRecognitionResult,
  seriesId?: string
): CompositeWindow {
  const series = DEFAULT_PROFILE_SERIES.find(s => s.id === (seriesId || 'series-108'))
    || DEFAULT_PROFILE_SERIES[2];

  const panels: CompositePanel[] = result.panels.map((panel, index) => {
    const windowUnit = createPanelWindowUnit(panel, series, result.sashTypes, index);

    return {
      id: nanoid(8),
      windowUnit,
      angle: panel.angle,
      connectionType: 'corner-post' as const,
      label: panel.label,
    };
  });

  return {
    id: nanoid(8),
    name: result.windowTypeName,
    type: result.compositeType || 'custom-composite',
    panels,
    posX: 0,
    posY: 0,
    selected: false,
    viewMode: 'perspective',
  };
}

// ===== 从识别结果创建单个 WindowUnit（矩形窗） =====

export function createWindowFromRecognition(
  result: PhotoRecognitionResult,
  seriesId?: string
): WindowUnit {
  const series = DEFAULT_PROFILE_SERIES.find(s => s.id === (seriesId || 'series-108'))
    || DEFAULT_PROFILE_SERIES[2];

  const panel = result.panels[0] || {
    label: '窗户',
    width: result.totalWidth,
    height: result.totalHeight,
    angle: 0,
  };

  return createPanelWindowUnit(panel, series, result.sashTypes, 0);
}

// ===== 判断是否为组合窗 =====

export function isCompositeWindow(result: PhotoRecognitionResult): boolean {
  return result.windowType !== 'rectangle' && result.panels.length > 1;
}
