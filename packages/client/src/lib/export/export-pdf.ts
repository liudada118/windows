// WindoorDesigner - 导出 PDF
// A4 打印模板，包含 2D 图纸 + 窗户信息表 + 尺寸标注

import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import type { WindowUnit, ProfileSeries } from '@/lib/types';
import { DEFAULT_PROFILE_SERIES } from '@/lib/types';
import { generateSvgString } from './export-svg';

export interface ExportPdfOptions {
  windows: WindowUnit[];
  title?: string;
  projectName?: string;
  author?: string;
  showDimensions?: boolean;
  pageSize?: 'a4' | 'a3';
  orientation?: 'portrait' | 'landscape';
  fileName?: string;
  canvasDataUrl?: string; // 可选：Konva 导出的 PNG DataURL
}

/**
 * 导出 PDF 文件
 */
export async function exportPdf(options: ExportPdfOptions): Promise<void> {
  const {
    windows,
    title = '门窗设计图纸',
    projectName = '未命名项目',
    author = 'WindoorDesigner',
    showDimensions = true,
    pageSize = 'a4',
    orientation = 'landscape',
    fileName = `windoor-design-${Date.now()}`,
    canvasDataUrl,
  } = options;

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: pageSize,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;

  // ===== 标题页 =====
  doc.setFontSize(24);
  doc.text(title, pageW / 2, margin + 15, { align: 'center' });

  doc.setFontSize(12);
  doc.text(`Project: ${projectName}`, margin, margin + 30);
  doc.text(`Author: ${author}`, margin, margin + 38);
  doc.text(`Date: ${new Date().toLocaleDateString('zh-CN')}`, margin, margin + 46);
  doc.text(`Windows: ${windows.length}`, margin, margin + 54);

  // 图框边框
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(margin - 5, margin - 5, contentW + 10, contentH + 10);

  // 内框
  doc.setLineWidth(0.2);
  doc.rect(margin, margin, contentW, contentH);

  // ===== 图纸页（每个窗户一页） =====
  for (let i = 0; i < windows.length; i++) {
    const win = windows[i];
    const series = DEFAULT_PROFILE_SERIES.find(s => s.id === win.profileSeriesId) || DEFAULT_PROFILE_SERIES[2];

    doc.addPage(pageSize, orientation);

    // 图框
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.rect(margin - 5, margin - 5, contentW + 10, contentH + 10);
    doc.setLineWidth(0.2);
    doc.rect(margin, margin, contentW, contentH);

    // 标题栏（底部）
    const titleBarH = 20;
    const titleBarY = pageH - margin - titleBarH;
    doc.setLineWidth(0.3);
    doc.rect(margin, titleBarY, contentW, titleBarH);

    doc.setFontSize(10);
    doc.text(`${win.name} (${win.width}x${win.height}mm)`, margin + 5, titleBarY + 8);
    doc.text(`Series: ${series.name}`, margin + 5, titleBarY + 15);
    doc.text(`Page ${i + 2}/${windows.length + 1}`, pageW - margin - 30, titleBarY + 8);
    doc.text(new Date().toLocaleDateString('zh-CN'), pageW - margin - 30, titleBarY + 15);

    // 绘制窗户图
    const drawAreaH = titleBarY - margin - 10;
    const drawAreaW = contentW;

    // 计算缩放比例使窗户适配绘图区域
    const scaleX = (drawAreaW * 0.7) / win.width; // 留 30% 给信息
    const scaleY = (drawAreaH * 0.9) / win.height;
    const drawScale = Math.min(scaleX, scaleY);

    const drawW = win.width * drawScale;
    const drawH = win.height * drawScale;
    const drawX = margin + (drawAreaW * 0.6 - drawW) / 2;
    const drawY = margin + (drawAreaH - drawH) / 2 + 5;

    // 绘制外框
    doc.setDrawColor(80);
    doc.setFillColor(192, 192, 192);
    doc.setLineWidth(0.5);
    const fw = series.frameWidth * drawScale;

    // 上框
    doc.rect(drawX, drawY, drawW, fw, 'FD');
    // 下框
    doc.rect(drawX, drawY + drawH - fw, drawW, fw, 'FD');
    // 左框
    doc.rect(drawX, drawY + fw, fw, drawH - fw * 2, 'FD');
    // 右框
    doc.rect(drawX + drawW - fw, drawY + fw, fw, drawH - fw * 2, 'FD');

    // 递归绘制 openings
    drawOpeningsPdf(doc, win.frame.openings, drawX, drawY, drawScale, series);

    // 尺寸标注
    if (showDimensions) {
      doc.setDrawColor(255, 0, 0);
      doc.setTextColor(255, 0, 0);
      doc.setFontSize(8);
      doc.setLineWidth(0.3);

      // 宽度标注
      const dimY = drawY + drawH + 8;
      doc.line(drawX, dimY, drawX + drawW, dimY);
      doc.line(drawX, dimY - 2, drawX, dimY + 2);
      doc.line(drawX + drawW, dimY - 2, drawX + drawW, dimY + 2);
      doc.text(`${win.width}`, drawX + drawW / 2, dimY + 5, { align: 'center' });

      // 高度标注
      const dimX = drawX + drawW + 8;
      doc.line(dimX, drawY, dimX, drawY + drawH);
      doc.line(dimX - 2, drawY, dimX + 2, drawY);
      doc.line(dimX - 2, drawY + drawH, dimX + 2, drawY + drawH);

      doc.text(`${win.height}`, dimX + 3, drawY + drawH / 2, { angle: 90 });

      doc.setDrawColor(0);
      doc.setTextColor(0);
    }

    // 右侧信息面板
    const infoX = margin + drawAreaW * 0.7;
    const infoY = margin + 10;
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text('Window Info', infoX, infoY);

    doc.setFontSize(9);
    const info = [
      [`Name:`, win.name],
      [`Size:`, `${win.width} x ${win.height} mm`],
      [`Series:`, series.name],
      [`Frame:`, `${series.frameWidth}mm x ${series.frameDepth}mm`],
      [`Mullion:`, `${series.mullionWidth}mm`],
      [`Sash:`, `${series.sashWidth}mm`],
    ];

    info.forEach(([label, value], idx) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, infoX, infoY + 10 + idx * 7);
      doc.setFont('helvetica', 'normal');
      doc.text(value, infoX + 25, infoY + 10 + idx * 7);
    });

    // 统计分格数和扇数
    let mullionCount = 0, sashCount = 0;
    const countParts = (openings: Opening[]) => {
      for (const o of openings) {
        mullionCount += o.mullions.length;
        if (o.sash) sashCount++;
        if (o.childOpenings.length > 0) countParts(o.childOpenings);
      }
    };
    countParts(win.frame.openings);

    doc.text(`Mullions: ${mullionCount}`, infoX, infoY + 60);
    doc.text(`Sashes: ${sashCount}`, infoX, infoY + 67);
  }

  // 保存
  const pdfBlob = doc.output('blob');
  saveAs(pdfBlob, `${fileName}.pdf`);
}

// 递归绘制 openings 到 PDF
function drawOpeningsPdf(
  doc: jsPDF,
  openings: Opening[],
  offsetX: number,
  offsetY: number,
  scale: number,
  series: ProfileSeries
): void {
  for (const opening of openings) {
    // 中梃
    for (const mullion of opening.mullions) {
      const mw = series.mullionWidth * scale;
      doc.setFillColor(160, 160, 160);
      doc.setDrawColor(100);
      doc.setLineWidth(0.3);

      if (mullion.type === 'vertical') {
        const mx = offsetX + mullion.position * scale - mw / 2;
        const my = offsetY + opening.rect.y * scale;
        const mh = opening.rect.height * scale;
        doc.rect(mx, my, mw, mh, 'FD');
      } else {
        const mx = offsetX + opening.rect.x * scale;
        const my = offsetY + mullion.position * scale - mw / 2;
        const mwPx = opening.rect.width * scale;
        doc.rect(mx, my, mwPx, mw, 'FD');
      }
    }

    if (opening.isSplit && opening.childOpenings.length > 0) {
      drawOpeningsPdf(doc, opening.childOpenings, offsetX, offsetY, scale, series);
    } else {
      // 玻璃区域
      const r = opening.rect;
      const gx = offsetX + r.x * scale;
      const gy = offsetY + r.y * scale;
      const gw = r.width * scale;
      const gh = r.height * scale;
      doc.setFillColor(200, 230, 240);
      doc.setDrawColor(150);
      doc.setLineWidth(0.2);
      doc.rect(gx, gy, gw, gh, 'FD');

      // 扇标记（简化）
      if (opening.sash) {
        doc.setDrawColor(60);
        doc.setLineWidth(0.4);
        const cx = gx + gw / 2;
        const cy = gy + gh / 2;

        switch (opening.sash.type) {
          case 'fixed':
            doc.line(gx + 2, gy + 2, gx + gw - 2, gy + gh - 2);
            doc.line(gx + gw - 2, gy + 2, gx + 2, gy + gh - 2);
            break;
          case 'casement-left':
          case 'casement-out-left':
          case 'tilt-turn-left':
            doc.line(gx + 2, gy + 2, cx, cy);
            doc.line(gx + 2, gy + gh - 2, cx, cy);
            break;
          case 'casement-right':
          case 'casement-out-right':
          case 'tilt-turn-right':
            doc.line(gx + gw - 2, gy + 2, cx, cy);
            doc.line(gx + gw - 2, gy + gh - 2, cx, cy);
            break;
          case 'casement-top':
            doc.line(gx + 2, gy + 2, cx, cy);
            doc.line(gx + gw - 2, gy + 2, cx, cy);
            break;
          case 'casement-bottom':
            doc.line(gx + 2, gy + gh - 2, cx, cy);
            doc.line(gx + gw - 2, gy + gh - 2, cx, cy);
            break;
          default:
            doc.line(gx + 2, cy, gx + gw - 2, cy);
            break;
        }
      }
    }
  }
}
