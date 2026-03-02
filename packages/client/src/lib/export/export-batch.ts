// WindoorDesigner - 批量导出 ZIP
// 将多种格式打包成 ZIP 文件下载

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import type { WindowUnit } from '@/lib/types';
import { generateSvgString } from './export-svg';

export interface BatchExportOptions {
  windows: WindowUnit[];
  formats: ('png' | 'svg' | 'pdf' | 'dxf' | 'json')[];
  projectName?: string;
  pngDataUrl?: string; // Konva 导出的 PNG
}

/**
 * 批量导出为 ZIP 文件
 */
export async function exportBatchZip(options: BatchExportOptions): Promise<void> {
  const {
    windows,
    formats,
    projectName = 'windoor-design',
    pngDataUrl,
  } = options;

  const zip = new JSZip();
  const folder = zip.folder(projectName);
  if (!folder) return;

  // JSON
  if (formats.includes('json')) {
    const jsonStr = JSON.stringify({ version: '2.0', windows, exportedAt: new Date().toISOString() }, null, 2);
    folder.file(`${projectName}.json`, jsonStr);
  }

  // SVG
  if (formats.includes('svg')) {
    const svgStr = generateSvgString({ windows, showDimensions: true, showSashMarks: true });
    folder.file(`${projectName}.svg`, svgStr);
  }

  // PNG (from Konva DataURL)
  if (formats.includes('png') && pngDataUrl) {
    const pngData = pngDataUrl.split(',')[1];
    if (pngData) {
      folder.file(`${projectName}.png`, pngData, { base64: true });
    }
  }

  // PDF
  if (formats.includes('pdf')) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    doc.setFontSize(16);
    doc.text(`${projectName} - Design Export`, pageW / 2, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Windows: ${windows.length}`, 15, 35);
    doc.text(`Date: ${new Date().toLocaleDateString('zh-CN')}`, 15, 42);

    // 简单窗户列表
    let y = 55;
    for (const win of windows) {
      if (y > pageH - 20) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${win.name}: ${win.width} x ${win.height} mm`, 15, y);
      y += 8;
    }

    const pdfBlob = doc.output('arraybuffer');
    folder.file(`${projectName}.pdf`, pdfBlob);
  }

  // DXF (简化版 - 直接生成 DXF 字符串)
  if (formats.includes('dxf')) {
    try {
      const DxfWriter = (await import('dxf-writer')).default;
      const d = new DxfWriter();
      d.addLayer('FRAME', 7, 'CONTINUOUS');

      let currentX = 0;
      for (const win of windows) {
        d.setActiveLayer('FRAME');
        d.drawLine(currentX, 0, currentX + win.width, 0);
        d.drawLine(currentX + win.width, 0, currentX + win.width, win.height);
        d.drawLine(currentX + win.width, win.height, currentX, win.height);
        d.drawLine(currentX, win.height, currentX, 0);
        currentX += win.width + 200;
      }

      folder.file(`${projectName}.dxf`, d.toDxfString());
    } catch {
      // DXF writer not available, skip
    }
  }

  // 生成 ZIP
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  saveAs(zipBlob, `${projectName}-export.zip`);
}
