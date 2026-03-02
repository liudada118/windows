// WindoorDesigner - 导出 PNG
// 300 DPI，透明背景，使用 Konva Stage.toDataURL

import Konva from 'konva';
import { saveAs } from 'file-saver';

export interface ExportPngOptions {
  stage: Konva.Stage;
  pixelRatio?: number; // 默认 3 (≈300 DPI at screen resolution)
  transparent?: boolean;
  fileName?: string;
  mimeType?: 'image/png' | 'image/jpeg';
  quality?: number; // 0-1, for JPEG
}

/**
 * 导出 Konva Stage 为 PNG 文件
 */
export async function exportPng(options: ExportPngOptions): Promise<void> {
  const {
    stage,
    pixelRatio = 3,
    transparent = true,
    fileName = `windoor-design-${Date.now()}`,
    mimeType = 'image/png',
    quality = 0.95,
  } = options;

  // 临时隐藏网格层和选中高亮层
  const gridLayer = stage.findOne('.grid-layer') as Konva.Layer | undefined;
  const selectionLayer = stage.findOne('.selection-layer') as Konva.Layer | undefined;
  const gridVisible = gridLayer?.visible() ?? false;
  const selectionVisible = selectionLayer?.visible() ?? false;

  if (gridLayer) gridLayer.visible(false);
  if (selectionLayer) selectionLayer.visible(false);

  try {
    const dataUrl = stage.toDataURL({
      pixelRatio,
      mimeType,
      quality,
      ...(transparent ? {} : { backgroundColor: '#FFFFFF' }),
    });

    // 转换 dataURL 为 Blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
    saveAs(blob, `${fileName}.${ext}`);
  } finally {
    // 恢复图层可见性
    if (gridLayer) gridLayer.visible(gridVisible);
    if (selectionLayer) selectionLayer.visible(selectionVisible);
  }
}

/**
 * 获取 PNG DataURL（用于预览或嵌入 PDF）
 */
export function getPngDataUrl(
  stage: Konva.Stage,
  pixelRatio: number = 2
): string {
  const gridLayer = stage.findOne('.grid-layer') as Konva.Layer | undefined;
  const selectionLayer = stage.findOne('.selection-layer') as Konva.Layer | undefined;
  const gridVisible = gridLayer?.visible() ?? false;
  const selectionVisible = selectionLayer?.visible() ?? false;

  if (gridLayer) gridLayer.visible(false);
  if (selectionLayer) selectionLayer.visible(false);

  const dataUrl = stage.toDataURL({ pixelRatio, mimeType: 'image/png' });

  if (gridLayer) gridLayer.visible(gridVisible);
  if (selectionLayer) selectionLayer.visible(selectionVisible);

  return dataUrl;
}
