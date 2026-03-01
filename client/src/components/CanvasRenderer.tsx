// WindoorDesigner - Canvas 渲染引擎
// 工业蓝图美学: 精确的线条、蓝图风格标注

import { useRef, useEffect, useCallback } from 'react';
import type { WindowUnit, Opening, Sash, Mullion, Rect } from '@/lib/types';

interface CanvasRendererProps {
  windows: WindowUnit[];
  selectedWindowId: string | null;
  selectedElementId: string | null;
  zoom: number;
  panX: number;
  panY: number;
  showDimensions: boolean;
  width: number;
  height: number;
}

// Colors - Industrial Blueprint palette
const COLORS = {
  frame: '#4a5568',
  frameStroke: '#2d3748',
  frameFill: '#a0aec0',
  frameHatch: 'rgba(0,0,0,0.06)',
  mullion: '#718096',
  mullionStroke: '#4a5568',
  glass: 'rgba(173, 216, 230, 0.22)',
  glassBorder: 'rgba(100, 160, 200, 0.35)',
  glassCross: 'rgba(100, 160, 200, 0.12)',
  sashLine: '#e53e3e',
  sashLineSliding: '#3182ce',
  sashFixed: 'rgba(100, 160, 200, 0.08)',
  dimension: '#f59e0b',
  dimensionText: '#f59e0b',
  selected: '#f59e0b',
  selectedGlow: 'rgba(245, 158, 11, 0.25)',
  grid: 'rgba(160, 170, 185, 0.12)',
  gridMajor: 'rgba(160, 170, 185, 0.25)',
  openingHover: 'rgba(245, 158, 11, 0.08)',
};

// Scale factor: 1mm = 0.5px at zoom=1
const MM_TO_PX = 0.5;

export default function CanvasRenderer({
  windows,
  selectedWindowId,
  selectedElementId,
  zoom,
  panX,
  panY,
  showDimensions,
  width,
  height,
}: CanvasRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    const gridSmall = 20 * zoom;
    const gridLarge = 100 * zoom;

    if (gridSmall < 4) {
      // Only draw major grid when zoomed out
      ctx.strokeStyle = COLORS.gridMajor;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const startXL = ((panX % gridLarge) + gridLarge) % gridLarge;
      const startYL = ((panY % gridLarge) + gridLarge) % gridLarge;
      for (let x = startXL; x < width; x += gridLarge) {
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, height);
      }
      for (let y = startYL; y < height; y += gridLarge) {
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(width, Math.round(y) + 0.5);
      }
      ctx.stroke();
      return;
    }

    // Small grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    const startX = ((panX % gridSmall) + gridSmall) % gridSmall;
    const startY = ((panY % gridSmall) + gridSmall) % gridSmall;
    for (let x = startX; x < width; x += gridSmall) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, height);
    }
    for (let y = startY; y < height; y += gridSmall) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(width, Math.round(y) + 0.5);
    }
    ctx.stroke();

    // Large grid
    ctx.strokeStyle = COLORS.gridMajor;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    const startXL = ((panX % gridLarge) + gridLarge) % gridLarge;
    const startYL = ((panY % gridLarge) + gridLarge) % gridLarge;
    for (let x = startXL; x < width; x += gridLarge) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, height);
    }
    for (let y = startYL; y < height; y += gridLarge) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(width, Math.round(y) + 0.5);
    }
    ctx.stroke();
  }, [zoom, panX, panY, width, height]);

  const toScreen = useCallback((winPosX: number, winPosY: number, localX: number, localY: number): [number, number] => {
    return [
      (winPosX + localX) * MM_TO_PX * zoom + panX,
      (winPosY + localY) * MM_TO_PX * zoom + panY,
    ];
  }, [zoom, panX, panY]);

  const drawFrame = useCallback((ctx: CanvasRenderingContext2D, win: WindowUnit, isSelected: boolean) => {
    const scale = MM_TO_PX * zoom;
    const [ox, oy] = toScreen(win.posX, win.posY, 0, 0);
    const w = win.width * scale;
    const h = win.height * scale;
    const pw = win.frame.profileWidth * scale;

    // Shadow for depth
    if (isSelected) {
      ctx.shadowColor = COLORS.selectedGlow;
      ctx.shadowBlur = 16;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
    }

    // Outer frame fill
    ctx.fillStyle = COLORS.frameFill;
    ctx.beginPath();
    ctx.rect(ox, oy, w, h);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Inner cutout (canvas/glass area)
    ctx.fillStyle = '#edf0f4';
    ctx.beginPath();
    ctx.rect(ox + pw, oy + pw, w - pw * 2, h - pw * 2);
    ctx.fill();

    // Frame profile hatching (diagonal lines for engineering look)
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, w, h);
    // Cut out inner
    ctx.rect(ox + pw + w - pw * 2, oy + pw, -(w - pw * 2), h - pw * 2);
    ctx.clip('evenodd');

    ctx.strokeStyle = COLORS.frameHatch;
    ctx.lineWidth = 0.6;
    const hatchSpacing = Math.max(4, 5 * zoom);
    for (let i = -h; i < w + h; i += hatchSpacing) {
      ctx.beginPath();
      ctx.moveTo(ox + i, oy);
      ctx.lineTo(ox + i + h, oy + h);
      ctx.stroke();
    }
    ctx.restore();

    // Frame outer stroke
    ctx.strokeStyle = isSelected ? COLORS.selected : COLORS.frameStroke;
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.strokeRect(ox, oy, w, h);

    // Frame inner stroke
    ctx.strokeStyle = isSelected ? COLORS.selected : '#718096';
    ctx.lineWidth = isSelected ? 1.5 : 1;
    ctx.strokeRect(ox + pw, oy + pw, w - pw * 2, h - pw * 2);
  }, [zoom, toScreen]);

  const drawGlass = useCallback((ctx: CanvasRenderingContext2D, rect: Rect, winPosX: number, winPosY: number) => {
    const scale = MM_TO_PX * zoom;
    const [x, y] = toScreen(winPosX, winPosY, rect.x, rect.y);
    const w = rect.width * scale;
    const h = rect.height * scale;

    // Glass fill
    ctx.fillStyle = COLORS.glass;
    ctx.fillRect(x, y, w, h);

    // Glass cross (engineering convention for glass)
    ctx.strokeStyle = COLORS.glassCross;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + h);
    ctx.moveTo(x + w, y);
    ctx.lineTo(x, y + h);
    ctx.stroke();

    // Glass border
    ctx.strokeStyle = COLORS.glassBorder;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, w, h);
  }, [zoom, toScreen]);

  const drawSash = useCallback((ctx: CanvasRenderingContext2D, sash: Sash, winPosX: number, winPosY: number, isSelected: boolean) => {
    const scale = MM_TO_PX * zoom;
    const [x, y] = toScreen(winPosX, winPosY, sash.rect.x, sash.rect.y);
    const w = sash.rect.width * scale;
    const h = sash.rect.height * scale;

    // Draw glass first
    drawGlass(ctx, sash.rect, winPosX, winPosY);

    // Draw sash opening direction lines
    ctx.lineWidth = isSelected ? 2.5 : 1.8;
    ctx.setLineDash([]);

    switch (sash.type) {
      case 'fixed':
        // Fixed: subtle X pattern already drawn by glass
        break;
      case 'casement-left': {
        ctx.strokeStyle = isSelected ? COLORS.selected : COLORS.sashLine;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h / 2);
        ctx.lineTo(x, y + h);
        ctx.stroke();
        // Hinge dots on left side
        ctx.fillStyle = ctx.strokeStyle;
        const dotR = Math.max(2, 3 * zoom);
        ctx.beginPath();
        ctx.arc(x, y + h * 0.25, dotR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y + h * 0.75, dotR, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'casement-right': {
        ctx.strokeStyle = isSelected ? COLORS.selected : COLORS.sashLine;
        ctx.beginPath();
        ctx.moveTo(x + w, y);
        ctx.lineTo(x, y + h / 2);
        ctx.lineTo(x + w, y + h);
        ctx.stroke();
        // Hinge dots on right side
        ctx.fillStyle = ctx.strokeStyle;
        const dotR2 = Math.max(2, 3 * zoom);
        ctx.beginPath();
        ctx.arc(x + w, y + h * 0.25, dotR2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + w, y + h * 0.75, dotR2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'casement-top': {
        ctx.strokeStyle = isSelected ? COLORS.selected : COLORS.sashLine;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w / 2, y + h);
        ctx.lineTo(x + w, y);
        ctx.stroke();
        // Hinge dots on top
        ctx.fillStyle = ctx.strokeStyle;
        const dotR3 = Math.max(2, 3 * zoom);
        ctx.beginPath();
        ctx.arc(x + w * 0.25, y, dotR3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + w * 0.75, y, dotR3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'sliding-left':
      case 'sliding-right': {
        ctx.strokeStyle = isSelected ? COLORS.selected : COLORS.sashLineSliding;
        ctx.setLineDash([6, 4]);
        const arrowDir = sash.type === 'sliding-left' ? -1 : 1;
        const midY = y + h / 2;
        const arrowLen = w * 0.4;
        const startAX = x + w / 2 - arrowDir * arrowLen / 2;
        const endAX = x + w / 2 + arrowDir * arrowLen / 2;
        ctx.beginPath();
        ctx.moveTo(startAX, midY);
        ctx.lineTo(endAX, midY);
        ctx.stroke();
        // Arrowhead
        ctx.setLineDash([]);
        const aSize = Math.max(5, 7 * zoom);
        ctx.beginPath();
        ctx.moveTo(endAX, midY);
        ctx.lineTo(endAX - arrowDir * aSize, midY - aSize * 0.6);
        ctx.lineTo(endAX - arrowDir * aSize, midY + aSize * 0.6);
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
        break;
      }
    }
    ctx.setLineDash([]);
  }, [zoom, toScreen, drawGlass]);

  const drawMullion = useCallback((ctx: CanvasRenderingContext2D, mullion: Mullion, parentRect: Rect, winPosX: number, winPosY: number, mullionWidth: number, isSelected: boolean) => {
    const scale = MM_TO_PX * zoom;
    const mw = mullionWidth * scale;

    if (mullion.type === 'vertical') {
      const [mx, my] = toScreen(winPosX, winPosY, mullion.position, parentRect.y);
      const x = mx - mw / 2;
      const h = parentRect.height * scale;

      // Fill
      ctx.fillStyle = isSelected ? 'rgba(245, 158, 11, 0.3)' : COLORS.frameFill;
      ctx.fillRect(x, my, mw, h);

      // Hatching
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, my, mw, h);
      ctx.clip();
      ctx.strokeStyle = COLORS.frameHatch;
      ctx.lineWidth = 0.5;
      const hatchSpacing = Math.max(3, 4 * zoom);
      for (let i = -h; i < mw + h; i += hatchSpacing) {
        ctx.beginPath();
        ctx.moveTo(x + i, my);
        ctx.lineTo(x + i + h, my + h);
        ctx.stroke();
      }
      ctx.restore();

      // Stroke
      ctx.strokeStyle = isSelected ? COLORS.selected : COLORS.mullionStroke;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(x, my, mw, h);
    } else {
      const [mx, my] = toScreen(winPosX, winPosY, parentRect.x, mullion.position);
      const y = my - mw / 2;
      const w = parentRect.width * scale;

      ctx.fillStyle = isSelected ? 'rgba(245, 158, 11, 0.3)' : COLORS.frameFill;
      ctx.fillRect(mx, y, w, mw);

      // Hatching
      ctx.save();
      ctx.beginPath();
      ctx.rect(mx, y, w, mw);
      ctx.clip();
      ctx.strokeStyle = COLORS.frameHatch;
      ctx.lineWidth = 0.5;
      const hatchSpacing = Math.max(3, 4 * zoom);
      for (let i = -mw; i < w + mw; i += hatchSpacing) {
        ctx.beginPath();
        ctx.moveTo(mx + i, y);
        ctx.lineTo(mx + i + mw, y + mw);
        ctx.stroke();
      }
      ctx.restore();

      ctx.strokeStyle = isSelected ? COLORS.selected : COLORS.mullionStroke;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(mx, y, w, mw);
    }
  }, [zoom, toScreen]);

  const drawOpenings = useCallback((ctx: CanvasRenderingContext2D, openings: Opening[], winPosX: number, winPosY: number, mullionWidth: number) => {
    for (const opening of openings) {
      if (opening.isSplit) {
        // Draw mullions
        for (const mullion of opening.mullions) {
          const isSelected = mullion.id === selectedElementId;
          drawMullion(ctx, mullion, opening.rect, winPosX, winPosY, mullionWidth, isSelected);
        }
        // Recurse into children
        drawOpenings(ctx, opening.childOpenings, winPosX, winPosY, mullionWidth);
      } else {
        // Draw sash or empty glass
        if (opening.sash) {
          const isSelected = opening.sash.id === selectedElementId;
          drawSash(ctx, opening.sash, winPosX, winPosY, isSelected);
        } else {
          drawGlass(ctx, opening.rect, winPosX, winPosY);
        }
      }
    }
  }, [selectedElementId, drawMullion, drawSash, drawGlass]);

  const drawArrow = (ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, size: number = 6) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - dx * size + dy * 3, y - dy * size + dx * 3);
    ctx.moveTo(x, y);
    ctx.lineTo(x - dx * size - dy * 3, y - dy * size - dx * 3);
    ctx.stroke();
  };

  const drawDimensions = useCallback((ctx: CanvasRenderingContext2D, win: WindowUnit) => {
    if (!showDimensions) return;
    const scale = MM_TO_PX * zoom;
    const [ox, oy] = toScreen(win.posX, win.posY, 0, 0);
    const w = win.width * scale;
    const h = win.height * scale;
    const offset = 28;
    const tickLen = 5;
    const fontSize = Math.max(9, 11 * Math.min(zoom, 2));

    ctx.strokeStyle = COLORS.dimension;
    ctx.fillStyle = COLORS.dimensionText;
    ctx.lineWidth = 1;
    ctx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Width dimension (top)
    const dimY = oy - offset;
    ctx.beginPath();
    // Extension lines
    ctx.setLineDash([2, 2]);
    ctx.moveTo(ox, oy - 3);
    ctx.lineTo(ox, dimY - tickLen);
    ctx.moveTo(ox + w, oy - 3);
    ctx.lineTo(ox + w, dimY - tickLen);
    ctx.stroke();
    ctx.setLineDash([]);
    // Ticks
    ctx.beginPath();
    ctx.moveTo(ox, dimY - tickLen);
    ctx.lineTo(ox, dimY + tickLen);
    ctx.moveTo(ox + w, dimY - tickLen);
    ctx.lineTo(ox + w, dimY + tickLen);
    // Dimension line
    ctx.moveTo(ox, dimY);
    ctx.lineTo(ox + w, dimY);
    ctx.stroke();
    // Arrows
    drawArrow(ctx, ox, dimY, 1, 0);
    drawArrow(ctx, ox + w, dimY, -1, 0);
    // Text with background
    const widthText = `${win.width}`;
    const textMetrics = ctx.measureText(widthText);
    const textW = textMetrics.width + 8;
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(ox + w / 2 - textW / 2, dimY - fontSize / 2 - 2, textW, fontSize + 4);
    ctx.fillStyle = COLORS.dimensionText;
    ctx.fillText(widthText, ox + w / 2, dimY);

    // Height dimension (right)
    const dimX = ox + w + offset;
    ctx.beginPath();
    ctx.setLineDash([2, 2]);
    ctx.moveTo(ox + w + 3, oy);
    ctx.lineTo(dimX + tickLen, oy);
    ctx.moveTo(ox + w + 3, oy + h);
    ctx.lineTo(dimX + tickLen, oy + h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(dimX - tickLen, oy);
    ctx.lineTo(dimX + tickLen, oy);
    ctx.moveTo(dimX - tickLen, oy + h);
    ctx.lineTo(dimX + tickLen, oy + h);
    ctx.moveTo(dimX, oy);
    ctx.lineTo(dimX, oy + h);
    ctx.stroke();
    drawArrow(ctx, dimX, oy, 0, 1);
    drawArrow(ctx, dimX, oy + h, 0, -1);
    // Rotated text with background
    ctx.save();
    ctx.translate(dimX, oy + h / 2);
    ctx.rotate(-Math.PI / 2);
    const heightText = `${win.height}`;
    const hTextMetrics = ctx.measureText(heightText);
    const hTextW = hTextMetrics.width + 8;
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(-hTextW / 2, -fontSize / 2 - 2, hTextW, fontSize + 4);
    ctx.fillStyle = COLORS.dimensionText;
    ctx.fillText(heightText, 0, 0);
    ctx.restore();

    // Sub-dimensions for split openings
    drawOpeningDimensions(ctx, win.frame.openings, win.posX, win.posY, oy + h + 18, ox - 18, scale, fontSize * 0.85);
  }, [zoom, toScreen, showDimensions]);

  const drawOpeningDimensions = useCallback((
    ctx: CanvasRenderingContext2D,
    openings: Opening[],
    winPosX: number,
    winPosY: number,
    bottomY: number,
    leftX: number,
    scale: number,
    fontSize: number
  ) => {
    for (const opening of openings) {
      if (!opening.isSplit) continue;
      for (const mullion of opening.mullions) {
        if (mullion.type === 'vertical' && opening.childOpenings.length >= 2) {
          // Draw width sub-dimensions at bottom
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
          ctx.fillStyle = 'rgba(245, 158, 11, 0.7)';
          ctx.lineWidth = 0.8;
          ctx.font = `500 ${fontSize}px 'JetBrains Mono', monospace`;
          ctx.textAlign = 'center';

          for (const child of opening.childOpenings) {
            const [cx] = toScreen(winPosX, winPosY, child.rect.x, 0);
            const cw = child.rect.width * scale;
            ctx.beginPath();
            ctx.moveTo(cx, bottomY);
            ctx.lineTo(cx + cw, bottomY);
            ctx.stroke();
            ctx.fillText(`${Math.round(child.rect.width)}`, cx + cw / 2, bottomY + 10);
          }
        }
        if (mullion.type === 'horizontal' && opening.childOpenings.length >= 2) {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
          ctx.fillStyle = 'rgba(245, 158, 11, 0.7)';
          ctx.lineWidth = 0.8;
          ctx.font = `500 ${fontSize}px 'JetBrains Mono', monospace`;
          ctx.textAlign = 'right';

          for (const child of opening.childOpenings) {
            const [, cy] = toScreen(winPosX, winPosY, 0, child.rect.y);
            const ch = child.rect.height * scale;
            ctx.beginPath();
            ctx.moveTo(leftX, cy);
            ctx.lineTo(leftX, cy + ch);
            ctx.stroke();
            ctx.save();
            ctx.translate(leftX - 4, cy + ch / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.round(child.rect.height)}`, 0, 0);
            ctx.restore();
          }
        }
      }
      // Recurse
      drawOpeningDimensions(ctx, opening.childOpenings, winPosX, winPosY, bottomY, leftX, scale, fontSize);
    }
  }, [toScreen]);

  const drawWindowLabel = useCallback((ctx: CanvasRenderingContext2D, win: WindowUnit) => {
    const scale = MM_TO_PX * zoom;
    const [ox, oy] = toScreen(win.posX, win.posY, 0, 0);
    const w = win.width * scale;
    const h = win.height * scale;
    const fontSize = Math.max(9, 11 * Math.min(zoom, 2));

    ctx.font = `500 ${fontSize}px 'Inter', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Background pill
    const labelText = win.name;
    const metrics = ctx.measureText(labelText);
    const pillW = metrics.width + 12;
    const pillH = fontSize + 6;
    const pillX = ox + w / 2 - pillW / 2;
    const pillY = oy + h + 8;

    ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
    ctx.beginPath();
    const r = 3;
    ctx.moveTo(pillX + r, pillY);
    ctx.lineTo(pillX + pillW - r, pillY);
    ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + r);
    ctx.lineTo(pillX + pillW, pillY + pillH - r);
    ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - r, pillY + pillH);
    ctx.lineTo(pillX + r, pillY + pillH);
    ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - r);
    ctx.lineTo(pillX, pillY + r);
    ctx.quadraticCurveTo(pillX, pillY, pillX + r, pillY);
    ctx.fill();

    ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
    ctx.fillText(labelText, ox + w / 2, pillY + 3);
  }, [zoom, toScreen]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear with canvas background
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    drawGrid(ctx);

    // Draw origin crosshair
    const [originX, originY] = [panX, panY];
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw all windows
    for (const win of windows) {
      const isSelected = win.id === selectedWindowId;
      drawFrame(ctx, win, isSelected);

      const mullionWidth = 70; // TODO: get from profile series
      drawOpenings(ctx, win.frame.openings, win.posX, win.posY, mullionWidth);
      drawDimensions(ctx, win);
      drawWindowLabel(ctx, win);
    }
  }, [windows, selectedWindowId, selectedElementId, zoom, panX, panY, showDimensions, width, height, drawGrid, drawFrame, drawOpenings, drawDimensions, drawWindowLabel]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="block"
    />
  );
}
