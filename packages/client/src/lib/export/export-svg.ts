// WindoorDesigner - 导出 SVG
// 矢量图，保留图层结构，可在 Illustrator/Inkscape 中编辑

import type { WindowUnit, Opening, ProfileSeries } from '@/lib/types';
import { DEFAULT_PROFILE_SERIES } from '@/lib/types';
import { saveAs } from 'file-saver';

interface SvgExportOptions {
  windows: WindowUnit[];
  showDimensions?: boolean;
  showSashMarks?: boolean;
  scale?: number; // px per mm, default 0.5
  padding?: number; // mm
  fileName?: string;
}

const SASH_SYMBOLS: Record<string, (cx: number, cy: number, w: number, h: number) => string> = {
  'fixed': (cx, cy, w, h) => `<line x1="${cx - w * 0.4}" y1="${cy - h * 0.4}" x2="${cx + w * 0.4}" y2="${cy + h * 0.4}" stroke="#666" stroke-width="0.5"/><line x1="${cx + w * 0.4}" y1="${cy - h * 0.4}" x2="${cx - w * 0.4}" y2="${cy + h * 0.4}" stroke="#666" stroke-width="0.5"/>`,
  'casement-left': (cx, cy, w, h) => {
    const x1 = cx - w / 2, y1 = cy - h / 2, y2 = cy + h / 2;
    return `<polygon points="${x1},${y1} ${cx + w * 0.3},${cy} ${x1},${y2}" fill="none" stroke="#333" stroke-width="0.8"/>`;
  },
  'casement-right': (cx, cy, w, h) => {
    const x2 = cx + w / 2, y1 = cy - h / 2, y2 = cy + h / 2;
    return `<polygon points="${x2},${y1} ${cx - w * 0.3},${cy} ${x2},${y2}" fill="none" stroke="#333" stroke-width="0.8"/>`;
  },
  'casement-top': (cx, cy, w, h) => {
    const x1 = cx - w / 2, x2 = cx + w / 2, y1 = cy - h / 2;
    return `<polygon points="${x1},${y1} ${cx},${cy + h * 0.3} ${x2},${y1}" fill="none" stroke="#333" stroke-width="0.8"/>`;
  },
  'casement-bottom': (cx, cy, w, h) => {
    const x1 = cx - w / 2, x2 = cx + w / 2, y2 = cy + h / 2;
    return `<polygon points="${x1},${y2} ${cx},${cy - h * 0.3} ${x2},${y2}" fill="none" stroke="#333" stroke-width="0.8"/>`;
  },
};

function getDefaultSashSymbol(cx: number, cy: number, w: number, h: number): string {
  return `<line x1="${cx - w * 0.3}" y1="${cy}" x2="${cx + w * 0.3}" y2="${cy}" stroke="#666" stroke-width="0.5" stroke-dasharray="2,2"/>`;
}

function renderOpeningSvg(
  opening: Opening,
  offsetX: number,
  offsetY: number,
  series: ProfileSeries,
  scale: number,
  showSashMarks: boolean
): string {
  let svg = '';
  const s = scale;

  // 中梃
  for (const mullion of opening.mullions) {
    const mw = series.mullionWidth;
    if (mullion.type === 'vertical') {
      const mx = (offsetX + mullion.position) * s;
      const my = (offsetY + opening.rect.y) * s;
      const mh = opening.rect.height * s;
      svg += `<rect x="${mx - mw * s / 2}" y="${my}" width="${mw * s}" height="${mh}" fill="#A0A0A0" stroke="#666" stroke-width="0.5" class="mullion"/>`;
    } else {
      const mx = (offsetX + opening.rect.x) * s;
      const my = (offsetY + mullion.position) * s;
      const mwPx = opening.rect.width * s;
      svg += `<rect x="${mx}" y="${my - mw * s / 2}" width="${mwPx}" height="${mw * s}" fill="#A0A0A0" stroke="#666" stroke-width="0.5" class="mullion"/>`;
    }
  }

  if (opening.isSplit && opening.childOpenings.length > 0) {
    for (const child of opening.childOpenings) {
      svg += renderOpeningSvg(child, offsetX, offsetY, series, scale, showSashMarks);
    }
  } else {
    // 玻璃区域
    const r = opening.rect;
    const gx = (offsetX + r.x) * s;
    const gy = (offsetY + r.y) * s;
    const gw = r.width * s;
    const gh = r.height * s;
    svg += `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" fill="rgba(200,230,240,0.3)" stroke="#999" stroke-width="0.3" class="glass"/>`;

    // 扇标记
    if (showSashMarks && opening.sash) {
      const cx = gx + gw / 2;
      const cy = gy + gh / 2;
      const renderer = SASH_SYMBOLS[opening.sash.type] || getDefaultSashSymbol;
      svg += `<g class="sash-mark">${renderer(cx, cy, gw * 0.8, gh * 0.8)}</g>`;
    }
  }

  return svg;
}

function renderDimensionsSvg(
  win: WindowUnit,
  offsetX: number,
  offsetY: number,
  scale: number
): string {
  let svg = '';
  const s = scale;
  const dimOffset = 15; // px offset for dimension lines

  // 宽度标注（底部）
  const x1 = offsetX * s;
  const x2 = (offsetX + win.width) * s;
  const y = (offsetY + win.height) * s + dimOffset;
  svg += `<g class="dimension">`;
  svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="red" stroke-width="0.8"/>`;
  svg += `<line x1="${x1}" y1="${y - 3}" x2="${x1}" y2="${y + 3}" stroke="red" stroke-width="0.8"/>`;
  svg += `<line x1="${x2}" y1="${y - 3}" x2="${x2}" y2="${y + 3}" stroke="red" stroke-width="0.8"/>`;
  svg += `<text x="${(x1 + x2) / 2}" y="${y + 12}" text-anchor="middle" font-size="10" fill="red" font-family="monospace">${win.width}</text>`;
  svg += `</g>`;

  // 高度标注（右侧）
  const y1 = offsetY * s;
  const y2 = (offsetY + win.height) * s;
  const x = (offsetX + win.width) * s + dimOffset;
  svg += `<g class="dimension">`;
  svg += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="red" stroke-width="0.8"/>`;
  svg += `<line x1="${x - 3}" y1="${y1}" x2="${x + 3}" y2="${y1}" stroke="red" stroke-width="0.8"/>`;
  svg += `<line x1="${x - 3}" y1="${y2}" x2="${x + 3}" y2="${y2}" stroke="red" stroke-width="0.8"/>`;
  svg += `<text x="${x + 12}" y="${(y1 + y2) / 2}" text-anchor="middle" font-size="10" fill="red" font-family="monospace" transform="rotate(90,${x + 12},${(y1 + y2) / 2})">${win.height}</text>`;
  svg += `</g>`;

  return svg;
}

export function generateSvgString(options: SvgExportOptions): string {
  const {
    windows,
    showDimensions = true,
    showSashMarks = true,
    scale = 0.5,
    padding = 50,
  } = options;

  if (windows.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

  // 计算总尺寸
  let maxW = 0, maxH = 0;
  const gap = 100; // mm gap between windows
  let totalW = 0;
  for (const win of windows) {
    totalW += win.width;
    maxH = Math.max(maxH, win.height);
  }
  totalW += (windows.length - 1) * gap;
  maxW = totalW;

  const svgW = (maxW + padding * 2) * scale + 60; // extra for dimensions
  const svgH = (maxH + padding * 2) * scale + 60;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">\n`;
  svg += `<defs><style>.frame{fill:#C0C0C0;stroke:#666;stroke-width:0.5}.mullion{fill:#A0A0A0;stroke:#666;stroke-width:0.5}.glass{fill:rgba(200,230,240,0.3);stroke:#999;stroke-width:0.3}</style></defs>\n`;

  let currentX = padding;

  for (const win of windows) {
    const series = DEFAULT_PROFILE_SERIES.find(s => s.id === win.profileSeriesId) || DEFAULT_PROFILE_SERIES[2];
    const fw = series.frameWidth;
    const ox = currentX;
    const oy = padding;

    // 图层: 外框
    svg += `<g class="window" data-id="${win.id}" data-name="${win.name}">\n`;

    // 外框
    const fx = ox * scale, fy = oy * scale;
    const fwPx = win.width * scale, fhPx = win.height * scale;
    const fpw = fw * scale;
    svg += `<g class="frame-layer">\n`;
    svg += `<rect x="${fx}" y="${fy}" width="${fwPx}" height="${fpw}" class="frame"/>\n`;
    svg += `<rect x="${fx}" y="${fy + fhPx - fpw}" width="${fwPx}" height="${fpw}" class="frame"/>\n`;
    svg += `<rect x="${fx}" y="${fy + fpw}" width="${fpw}" height="${fhPx - fpw * 2}" class="frame"/>\n`;
    svg += `<rect x="${fx + fwPx - fpw}" y="${fy + fpw}" width="${fpw}" height="${fhPx - fpw * 2}" class="frame"/>\n`;
    svg += `</g>\n`;

    // 图层: 分格内容
    svg += `<g class="openings-layer">\n`;
    for (const opening of win.frame.openings) {
      svg += renderOpeningSvg(opening, ox, oy, series, scale, showSashMarks);
    }
    svg += `</g>\n`;

    // 图层: 尺寸标注
    if (showDimensions) {
      svg += `<g class="dimensions-layer">\n`;
      svg += renderDimensionsSvg(win, ox, oy, scale);
      svg += `</g>\n`;
    }

    svg += `</g>\n`;
    currentX += win.width + gap;
  }

  svg += `</svg>`;
  return svg;
}

export function exportSvg(options: SvgExportOptions): void {
  const fileName = options.fileName || `windoor-design-${Date.now()}`;
  const svgString = generateSvgString(options);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  saveAs(blob, `${fileName}.svg`);
}
