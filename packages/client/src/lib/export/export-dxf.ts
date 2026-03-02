// WindoorDesigner - 导出 DXF
// AutoCAD 兼容，图层分离（FRAME/MULLION/GLASS/SASH/DIMENSION）
// 使用 dxf-writer 库

import DxfWriter from 'dxf-writer';
import { saveAs } from 'file-saver';
import type { WindowUnit, Opening, ProfileSeries } from '@/lib/types';
import { DEFAULT_PROFILE_SERIES } from '@/lib/types';

export interface ExportDxfOptions {
  windows: WindowUnit[];
  showDimensions?: boolean;
  fileName?: string;
}

// DXF 图层颜色 (AutoCAD Color Index)
const LAYER_COLORS = {
  FRAME: 7,      // 白色
  MULLION: 8,    // 灰色
  GLASS: 4,      // 青色
  SASH: 3,       // 绿色
  DIMENSION: 1,  // 红色
  TEXT: 7,        // 白色
};

function drawRect(d: DxfWriter, x: number, y: number, w: number, h: number): void {
  d.drawLine(x, y, x + w, y);
  d.drawLine(x + w, y, x + w, y + h);
  d.drawLine(x + w, y + h, x, y + h);
  d.drawLine(x, y + h, x, y);
}

function drawOpeningsDxf(
  d: DxfWriter,
  openings: Opening[],
  offsetX: number,
  offsetY: number,
  series: ProfileSeries,
  showDimensions: boolean
): void {
  for (const opening of openings) {
    // 中梃
    d.setActiveLayer('MULLION');
    for (const mullion of opening.mullions) {
      const mw = series.mullionWidth;
      if (mullion.type === 'vertical') {
        const mx = offsetX + mullion.position - mw / 2;
        const my = offsetY + opening.rect.y;
        drawRect(d, mx, my, mw, opening.rect.height);
      } else {
        const mx = offsetX + opening.rect.x;
        const my = offsetY + mullion.position - mw / 2;
        drawRect(d, mx, my, opening.rect.width, mw);
      }
    }

    if (opening.isSplit && opening.childOpenings.length > 0) {
      drawOpeningsDxf(d, opening.childOpenings, offsetX, offsetY, series, showDimensions);
    } else {
      // 玻璃区域
      d.setActiveLayer('GLASS');
      const r = opening.rect;
      drawRect(d, offsetX + r.x, offsetY + r.y, r.width, r.height);

      // 扇标记
      if (opening.sash) {
        d.setActiveLayer('SASH');
        const sx = offsetX + r.x;
        const sy = offsetY + r.y;
        const cx = sx + r.width / 2;
        const cy = sy + r.height / 2;

        switch (opening.sash.type) {
          case 'fixed':
            d.drawLine(sx, sy, sx + r.width, sy + r.height);
            d.drawLine(sx + r.width, sy, sx, sy + r.height);
            break;
          case 'casement-left':
          case 'casement-out-left':
          case 'tilt-turn-left':
            d.drawLine(sx, sy, cx, cy);
            d.drawLine(sx, sy + r.height, cx, cy);
            break;
          case 'casement-right':
          case 'casement-out-right':
          case 'tilt-turn-right':
            d.drawLine(sx + r.width, sy, cx, cy);
            d.drawLine(sx + r.width, sy + r.height, cx, cy);
            break;
          case 'casement-top':
            d.drawLine(sx, sy, cx, cy);
            d.drawLine(sx + r.width, sy, cx, cy);
            break;
          case 'casement-bottom':
            d.drawLine(sx, sy + r.height, cx, cy);
            d.drawLine(sx + r.width, sy + r.height, cx, cy);
            break;
          default:
            d.drawLine(sx, cy, sx + r.width, cy);
            break;
        }
      }
    }
  }
}

export function exportDxf(options: ExportDxfOptions): void {
  const {
    windows,
    showDimensions = true,
    fileName = `windoor-design-${Date.now()}`,
  } = options;

  const d = new DxfWriter();

  // 创建图层
  d.addLayer('FRAME', LAYER_COLORS.FRAME, 'CONTINUOUS');
  d.addLayer('MULLION', LAYER_COLORS.MULLION, 'CONTINUOUS');
  d.addLayer('GLASS', LAYER_COLORS.GLASS, 'CONTINUOUS');
  d.addLayer('SASH', LAYER_COLORS.SASH, 'CONTINUOUS');
  d.addLayer('DIMENSION', LAYER_COLORS.DIMENSION, 'CONTINUOUS');
  d.addLayer('TEXT', LAYER_COLORS.TEXT, 'CONTINUOUS');

  let currentX = 0;
  const gap = 200; // mm gap between windows

  for (const win of windows) {
    const series = DEFAULT_PROFILE_SERIES.find(s => s.id === win.profileSeriesId) || DEFAULT_PROFILE_SERIES[2];
    const fw = series.frameWidth;

    // 外框
    d.setActiveLayer('FRAME');
    // 外轮廓
    drawRect(d, currentX, 0, win.width, win.height);
    // 内轮廓
    drawRect(d, currentX + fw, fw, win.width - fw * 2, win.height - fw * 2);

    // 四条型材
    // 上框
    drawRect(d, currentX, win.height - fw, win.width, fw);
    // 下框
    drawRect(d, currentX, 0, win.width, fw);
    // 左框
    drawRect(d, currentX, fw, fw, win.height - fw * 2);
    // 右框
    drawRect(d, currentX + win.width - fw, fw, fw, win.height - fw * 2);

    // 分格内容
    drawOpeningsDxf(d, win.frame.openings, currentX, 0, series, showDimensions);

    // 尺寸标注
    if (showDimensions) {
      d.setActiveLayer('DIMENSION');
      const dimOffset = 30;

      // 宽度标注线
      const dy = -dimOffset;
      d.drawLine(currentX, dy, currentX + win.width, dy);
      d.drawLine(currentX, dy - 5, currentX, dy + 5);
      d.drawLine(currentX + win.width, dy - 5, currentX + win.width, dy + 5);

      // 高度标注线
      const dx = currentX + win.width + dimOffset;
      d.drawLine(dx, 0, dx, win.height);
      d.drawLine(dx - 5, 0, dx + 5, 0);
      d.drawLine(dx - 5, win.height, dx + 5, win.height);

      // 标注文字
      d.setActiveLayer('TEXT');
      d.drawText(currentX + win.width / 2, dy - 10, 5, 0, `${win.width}`);
      d.drawText(dx + 10, win.height / 2, 5, 90, `${win.height}`);

      // 窗户名称
      d.drawText(currentX + win.width / 2, win.height + 15, 4, 0, win.name);
    }

    currentX += win.width + gap;
  }

  const dxfString = d.toDxfString();
  const blob = new Blob([dxfString], { type: 'application/dxf' });
  saveAs(blob, `${fileName}.dxf`);
}
