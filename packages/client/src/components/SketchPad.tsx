// SketchPad.tsx - 手绘草图画板组件
// 支持在 Canvas 上手绘窗户草图，然后通过 AI 识别生成窗户模型
// v2.0: 支持识别转角窗(L形/U形)和凸窗

import { useRef, useState, useCallback, useEffect } from 'react';
import { X, Eraser, Undo2, Trash2, Wand2, Loader2, Pen, Download } from 'lucide-react';
import type { SplitConfig } from '@/components/CustomSplitDialog';
import type { CompositeWindowType } from '@/lib/types';

interface SketchPadProps {
  onClose: () => void;
  onGenerate: (result: SketchRecognitionResult) => void;
}

export interface SketchRecognitionResult {
  name: string;
  width: number;
  height: number;
  splitConfig?: SplitConfig;
  description: string;
  // 组合窗识别结果
  compositeType?: CompositeWindowType;
  compositePanels?: {
    width: number;
    height: number;
    angle: number;
    label: string;
  }[];
}

type Tool = 'pen' | 'eraser';

export default function SketchPad({ onClose, onGenerate }: SketchPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>('pen');
  const [lineWidth, setLineWidth] = useState(3);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState<SketchRecognitionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize canvas - use window dimensions to calculate size since flex layout
  // may not have settled when useEffect runs
  const initCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate canvas size based on viewport, not parent (parent may not be laid out yet)
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    // Modal is 95vw max 1300px, canvas area is modal minus header(~50px), toolbar(~45px), tips(~60px), footer(~60px), padding(~32px)
    const modalW = Math.min(viewportW * 0.95, 1300);
    const availableH = viewportH * 0.95 - 250; // subtract header, toolbar, tips, footer, padding
    const canvasW = Math.min(modalW - 48, 1200);
    const canvasH = Math.max(300, Math.min(availableH, 800)); // minimum 300px height

    canvas.width = canvasW;
    canvas.height = canvasH;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    const gridSize = 20;
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Save initial state
    const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([initialState]);
    setRecognitionResult(null);
    setError(null);
  }, []);

  useEffect(() => {
    // Small delay to ensure modal layout is complete
    const timer = setTimeout(initCanvas, 50);
    return () => clearTimeout(timer);
  }, [initCanvas]);

  const getPos = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 4 : lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : '#1a1a2e';
  }, [tool, lineWidth, getPos]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }, [isDrawing, getPos]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev, imageData]);
  }, [isDrawing]);

  const handleUndo = useCallback(() => {
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const newHistory = history.slice(0, -1);
    const lastState = newHistory[newHistory.length - 1];
    ctx.putImageData(lastState, 0, 0);
    setHistory(newHistory);
  }, [history]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Redraw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    const gridSize = 20;
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([imageData]);
    setRecognitionResult(null);
    setError(null);
  }, []);

  const handleRecognize = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsRecognizing(true);
    setError(null);
    setRecognitionResult(null);

    try {
      // Use local pixel analysis to recognize the sketch
      const result = localSketchRecognition(canvas);
      setRecognitionResult(result);
    } catch {
      setError('识别失败，请重新绘制或手动创建窗户');
    } finally {
      setIsRecognizing(false);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[oklch(0.16_0.02_260)] border border-[oklch(0.30_0.04_260)] rounded-xl shadow-2xl w-[95vw] max-w-[1300px] max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[oklch(0.25_0.035_260)]">
          <div>
            <h2 className="text-base font-semibold text-slate-100">手绘草图识别</h2>
            <p className="text-xs text-slate-400 mt-0.5">在画板上绘制窗户草图，AI 将自动识别并生成效果图（支持普通窗、转角窗、凸窗）</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-[oklch(0.22_0.03_260)]">
          <button
            onClick={() => setTool('pen')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tool === 'pen'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Pen size={14} /> 画笔
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tool === 'eraser'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Eraser size={14} /> 橡皮
          </button>

          <div className="w-px h-5 bg-[oklch(0.25_0.035_260)] mx-1" />

          <label className="text-[10px] text-slate-500 mr-1">粗细</label>
          <input
            type="range"
            min={1}
            max={8}
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-20 accent-amber-500"
          />

          <div className="w-px h-5 bg-[oklch(0.25_0.035_260)] mx-1" />

          <button
            onClick={handleUndo}
            disabled={history.length <= 1}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Undo2 size={14} /> 撤销
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
          >
            <Trash2 size={14} /> 清空
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <canvas
            ref={canvasRef}
            className="border border-[oklch(0.30_0.04_260)] rounded-lg cursor-crosshair shadow-inner bg-white"
            style={{ touchAction: 'none' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>

        {/* Tips */}
        <div className="px-5 py-2">
          <div className="p-2.5 rounded-lg bg-[oklch(0.12_0.02_260)] border border-[oklch(0.22_0.03_260)]">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <strong className="text-amber-400/80">绘制提示：</strong>
              <strong>普通窗：</strong>画一个矩形，用竖线/横线表示分割。
              <strong>L形转角窗：</strong>画一个 L 形（两个矩形拼成直角）。
              <strong>U形转角窗：</strong>画一个 U 形（三个矩形拼成凹字）。
              <strong>凸窗/飘窗：</strong>画一个梯形或五边形（上宽下窄或带斜边）。
            </p>
          </div>
        </div>

        {/* Recognition Result */}
        {recognitionResult && (
          <div className="px-5 py-2">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-xs text-emerald-300 font-medium mb-1">识别结果</p>
              <p className="text-[11px] text-slate-300">{recognitionResult.description}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                {recognitionResult.compositeType ? (
                  <>
                    类型: {recognitionResult.name}
                    {recognitionResult.compositePanels && ` | ${recognitionResult.compositePanels.length}个面板`}
                  </>
                ) : (
                  <>
                    尺寸: {recognitionResult.width} x {recognitionResult.height}mm
                    {recognitionResult.splitConfig && ` | ${recognitionResult.splitConfig.panelCount}等分 (${recognitionResult.splitConfig.direction === 'vertical' ? '竖向' : '横向'})`}
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-5 py-2">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-xs text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[oklch(0.25_0.035_260)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
          >
            取消
          </button>
          {recognitionResult ? (
            <button
              onClick={() => { console.log("[SketchPad] Generate button clicked, result:", JSON.stringify(recognitionResult)); onGenerate(recognitionResult); }}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg"
            >
              <Download size={14} /> 生成到画布
            </button>
          ) : (
            <button
              onClick={handleRecognize}
              disabled={isRecognizing || history.length <= 1}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {isRecognizing ? (
                <><Loader2 size={14} className="animate-spin" /> 识别中...</>
              ) : (
                <><Wand2 size={14} /> AI 识别</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Shape detection types =====
interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

interface ConnectedRegion {
  pixels: Set<string>;
  bbox: BoundingBox;
  area: number;
}

// ===== Local sketch recognition (enhanced v2) =====
// Analyzes the canvas pixel data to detect shapes including L-shape, U-shape, bay window
function localSketchRecognition(canvas: HTMLCanvasElement): SketchRecognitionResult {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas context');

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { width, height, data } = imageData;

  // Find dark pixels (drawn lines)
  const isDark = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const i = (y * width + x) * 4;
    return data[i] < 100 && data[i + 1] < 100 && data[i + 2] < 100;
  };

  // Find bounding box of all drawing
  let globalMinX = width, globalMinY = height, globalMaxX = 0, globalMaxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isDark(x, y)) {
        globalMinX = Math.min(globalMinX, x);
        globalMinY = Math.min(globalMinY, y);
        globalMaxX = Math.max(globalMaxX, x);
        globalMaxY = Math.max(globalMaxY, y);
      }
    }
  }

  if (globalMaxX <= globalMinX || globalMaxY <= globalMinY) {
    return {
      name: '固定窗',
      width: 1200,
      height: 1500,
      description: '未检测到有效草图，已生成默认固定窗 (1200x1500mm)',
    };
  }

  const drawWidth = globalMaxX - globalMinX;
  const drawHeight = globalMaxY - globalMinY;

  // ===== Step 1: Analyze shape by scanning fill density in quadrants =====
  // Divide the bounding box into a grid and check which cells have drawing content
  const gridCols = 6;
  const gridRows = 6;
  const cellW = drawWidth / gridCols;
  const cellH = drawHeight / gridRows;
  const densityGrid: number[][] = [];

  for (let row = 0; row < gridRows; row++) {
    densityGrid[row] = [];
    for (let col = 0; col < gridCols; col++) {
      const cellX1 = Math.round(globalMinX + col * cellW);
      const cellY1 = Math.round(globalMinY + row * cellH);
      const cellX2 = Math.round(cellX1 + cellW);
      const cellY2 = Math.round(cellY1 + cellH);

      let darkCount = 0;
      let totalCount = 0;
      for (let py = cellY1; py < cellY2; py += 2) {
        for (let px = cellX1; px < cellX2; px += 2) {
          totalCount++;
          if (isDark(px, py)) darkCount++;
        }
      }
      densityGrid[row][col] = totalCount > 0 ? darkCount / totalCount : 0;
    }
  }

  // Check if a cell has significant content (density > threshold)
  const DENSITY_THRESHOLD = 0.02;
  const hasContent = (row: number, col: number): boolean => {
    if (row < 0 || row >= gridRows || col < 0 || col >= gridCols) return false;
    return densityGrid[row][col] > DENSITY_THRESHOLD;
  };

  // ===== Step 2: Detect shape type =====
  // Analyze the overall shape pattern

  // Check for L-shape: content in bottom-left + top-right OR bottom-right + top-left
  // Check for U-shape: content on left, bottom, right but NOT top-center
  // Check for bay/trapezoid: wider at top/bottom with angled sides

  // Compute row/column fill profiles
  const rowFill: number[] = [];
  for (let row = 0; row < gridRows; row++) {
    let filledCols = 0;
    for (let col = 0; col < gridCols; col++) {
      if (hasContent(row, col)) filledCols++;
    }
    rowFill.push(filledCols);
  }

  const colFill: number[] = [];
  for (let col = 0; col < gridCols; col++) {
    let filledRows = 0;
    for (let row = 0; row < gridRows; row++) {
      if (hasContent(row, col)) filledRows++;
    }
    colFill.push(filledRows);
  }

  // Detect shape characteristics
  const topHalf = rowFill.slice(0, gridRows / 2);
  const bottomHalf = rowFill.slice(gridRows / 2);
  const leftHalf = colFill.slice(0, gridCols / 2);
  const rightHalf = colFill.slice(gridCols / 2);

  const avgTopFill = topHalf.reduce((a, b) => a + b, 0) / topHalf.length;
  const avgBottomFill = bottomHalf.reduce((a, b) => a + b, 0) / bottomHalf.length;
  const avgLeftFill = leftHalf.reduce((a, b) => a + b, 0) / leftHalf.length;
  const avgRightFill = rightHalf.reduce((a, b) => a + b, 0) / rightHalf.length;

  // Check for empty quadrants (characteristic of L/U shapes)
  const quadrants = {
    topLeft: 0,
    topRight: 0,
    bottomLeft: 0,
    bottomRight: 0,
  };

  const halfRow = Math.floor(gridRows / 2);
  const halfCol = Math.floor(gridCols / 2);

  for (let row = 0; row < halfRow; row++) {
    for (let col = 0; col < halfCol; col++) {
      if (hasContent(row, col)) quadrants.topLeft++;
    }
  }
  for (let row = 0; row < halfRow; row++) {
    for (let col = halfCol; col < gridCols; col++) {
      if (hasContent(row, col)) quadrants.topRight++;
    }
  }
  for (let row = halfRow; row < gridRows; row++) {
    for (let col = 0; col < halfCol; col++) {
      if (hasContent(row, col)) quadrants.bottomLeft++;
    }
  }
  for (let row = halfRow; row < gridRows; row++) {
    for (let col = halfCol; col < gridCols; col++) {
      if (hasContent(row, col)) quadrants.bottomRight++;
    }
  }

  const maxQuadrant = Math.max(quadrants.topLeft, quadrants.topRight, quadrants.bottomLeft, quadrants.bottomRight);
  const quadrantThreshold = maxQuadrant * 0.3;

  const qTL = quadrants.topLeft > quadrantThreshold;
  const qTR = quadrants.topRight > quadrantThreshold;
  const qBL = quadrants.bottomLeft > quadrantThreshold;
  const qBR = quadrants.bottomRight > quadrantThreshold;

  const filledQuadrants = [qTL, qTR, qBL, qBR].filter(Boolean).length;

  // ===== Step 3: Classify shape =====

  // --- Enhanced interior emptiness detection ---
  // Instead of just checking if quadrants have ANY content (which catches border lines),
  // check if the INTERIOR of each quadrant is empty (no drawn content inside, only edges)
  const interiorEmptiness = checkInteriorEmptiness(
    isDark, globalMinX, globalMinY, globalMaxX, globalMaxY, drawWidth, drawHeight
  );

  // Bay window / trapezoid detection: check for diagonal lines
  const hasDiagonalLines = detectDiagonalLines(
    isDark, globalMinX, globalMinY, globalMaxX, globalMaxY, drawWidth, drawHeight
  );

  if (hasDiagonalLines) {
    // Bay window (凸窗/飘窗)
    const frontWidth = Math.round(Math.max(800, Math.min(2400, drawWidth * 2.5)));
    const sideWidth = Math.round(frontWidth * 0.35);
    const winHeight = Math.round(Math.max(800, Math.min(2000, drawHeight * 2.5)));

    return {
      name: '凸窗/飘窗',
      width: frontWidth,
      height: winHeight,
      compositeType: 'bay-window',
      compositePanels: [
        { width: sideWidth, height: winHeight, angle: -45, label: '左斜面' },
        { width: frontWidth, height: winHeight, angle: 0, label: '正面' },
        { width: sideWidth, height: winHeight, angle: 45, label: '右斜面' },
      ],
      description: `识别为凸窗/飘窗 (正面 ${frontWidth}mm, 斜面 ${sideWidth}mm, 高 ${winHeight}mm)`,
    };
  }

  // --- L-shape detection (improved): check for one empty interior quadrant ---
  // An L-shape has one quadrant that is mostly empty INSIDE (not just border lines)
  const emptyInteriorQuadrants = [
    interiorEmptiness.topLeft,
    interiorEmptiness.topRight,
    interiorEmptiness.bottomLeft,
    interiorEmptiness.bottomRight,
  ];
  const emptyInteriorCount = emptyInteriorQuadrants.filter(v => v).length;

  if (emptyInteriorCount === 1) {
    // Exactly one quadrant interior is empty => L-shape
    const emptyCorner = interiorEmptiness.topLeft ? 'topLeft'
      : interiorEmptiness.topRight ? 'topRight'
      : interiorEmptiness.bottomLeft ? 'bottomLeft'
      : 'bottomRight';

    const frontWidth = Math.round(Math.max(800, Math.min(2200, drawWidth * 2)));
    const sideWidth = Math.round(Math.max(600, Math.min(1500, drawHeight * 1.5)));
    const winHeight = Math.round(Math.max(800, Math.min(2000, Math.max(drawWidth, drawHeight) * 2)));

    return {
      name: 'L形窗',
      width: frontWidth,
      height: winHeight,
      compositeType: 'l-shape',
      compositePanels: [
        { width: frontWidth, height: winHeight, angle: 0, label: '正面' },
        { width: sideWidth, height: winHeight, angle: 90, label: '侧面' },
      ],
      description: `识别为L形转角窗 (正面 ${frontWidth}mm, 侧面 ${sideWidth}mm, 高 ${winHeight}mm, 空角: ${emptyCorner})`,
    };
  }

  // --- U-shape detection (improved) ---
  // U-shape: two adjacent quadrants on one side are empty, or top-center is empty
  if (emptyInteriorCount === 2) {
    // Check if the two empty quadrants are on the same side (top or bottom)
    const topEmpty = interiorEmptiness.topLeft && interiorEmptiness.topRight;
    const bottomEmpty = interiorEmptiness.bottomLeft && interiorEmptiness.bottomRight;

    if (topEmpty || bottomEmpty) {
      const frontWidth = Math.round(Math.max(1000, Math.min(2500, drawWidth * 2)));
      const sideWidth = Math.round(frontWidth * 0.45);
      const winHeight = Math.round(Math.max(800, Math.min(2000, drawHeight * 2)));

      return {
        name: 'U形窗',
        width: frontWidth,
        height: winHeight,
        compositeType: 'u-shape',
        compositePanels: [
          { width: sideWidth, height: winHeight, angle: -90, label: '左侧面' },
          { width: frontWidth, height: winHeight, angle: 0, label: '正面' },
          { width: sideWidth, height: winHeight, angle: 90, label: '右侧面' },
        ],
        description: `识别为U形转角窗 (正面 ${frontWidth}mm, 侧面 ${sideWidth}mm, 高 ${winHeight}mm)`,
      };
    }
  }

  // Fallback: also try the original quadrant-based detection for U and L shapes
  if (filledQuadrants >= 3) {
    const bottomRowWide = avgBottomFill > gridCols * 0.6;
    const topRowNarrow = avgTopFill < avgBottomFill * 0.7;
    const leftColTall = avgLeftFill > gridRows * 0.5;
    const rightColTall = avgRightFill > gridRows * 0.5;

    if (bottomRowWide && leftColTall && rightColTall && topRowNarrow) {
      const frontWidth = Math.round(Math.max(1000, Math.min(2500, drawWidth * 2)));
      const sideWidth = Math.round(frontWidth * 0.45);
      const winHeight = Math.round(Math.max(800, Math.min(2000, drawHeight * 2)));

      return {
        name: 'U形窗',
        width: frontWidth,
        height: winHeight,
        compositeType: 'u-shape',
        compositePanels: [
          { width: sideWidth, height: winHeight, angle: -90, label: '左侧面' },
          { width: frontWidth, height: winHeight, angle: 0, label: '正面' },
          { width: sideWidth, height: winHeight, angle: 90, label: '右侧面' },
        ],
        description: `识别为U形转角窗 (正面 ${frontWidth}mm, 侧面 ${sideWidth}mm, 高 ${winHeight}mm)`,
      };
    }
  }

  if (filledQuadrants === 3 || (filledQuadrants === 4 && isLShape(densityGrid, gridRows, gridCols, DENSITY_THRESHOLD))) {
    const emptyCorner = !qTL ? 'topLeft' : !qTR ? 'topRight' : !qBL ? 'bottomLeft' : !qBR ? 'bottomRight' : null;

    if (emptyCorner) {
      const frontWidth = Math.round(Math.max(800, Math.min(2200, drawWidth * 2)));
      const sideWidth = Math.round(Math.max(600, Math.min(1500, drawHeight * 1.5)));
      const winHeight = Math.round(Math.max(800, Math.min(2000, Math.max(drawWidth, drawHeight) * 2)));

      return {
        name: 'L形窗',
        width: frontWidth,
        height: winHeight,
        compositeType: 'l-shape',
        compositePanels: [
          { width: frontWidth, height: winHeight, angle: 0, label: '正面' },
          { width: sideWidth, height: winHeight, angle: 90, label: '侧面' },
        ],
        description: `识别为L形转角窗 (正面 ${frontWidth}mm, 侧面 ${sideWidth}mm, 高 ${winHeight}mm)`,
      };
    }
  }

  // ===== Step 4: Fall back to standard rectangle window detection =====
  return detectRectangleWindow(isDark, globalMinX, globalMinY, globalMaxX, globalMaxY, drawWidth, drawHeight);
}

// ===== Check if each quadrant center is INSIDE the drawn shape =====
// Uses ray-casting: from the center of each quadrant, cast a ray to the right
// and count how many times it crosses a dark pixel boundary.
// If the center is inside the shape, it crosses an odd number of times.
// A quadrant is "empty" (outside the shape) if its center is NOT enclosed.
function checkInteriorEmptiness(
  isDark: (x: number, y: number) => boolean,
  minX: number, minY: number, maxX: number, maxY: number,
  drawWidth: number, drawHeight: number
): { topLeft: boolean; topRight: boolean; bottomLeft: boolean; bottomRight: boolean } {
  const midX = minX + drawWidth / 2;
  const midY = minY + drawHeight / 2;

  // Check if a point is inside the drawn shape using horizontal ray casting
  // Cast a ray from (px, py) to the right and count dark-to-light transitions
  const isOutsideShape = (px: number, py: number): boolean => {
    // Sample multiple horizontal rays around the point for robustness
    const offsets = [-8, -4, 0, 4, 8];
    let outsideVotes = 0;

    for (const dy of offsets) {
      const testY = Math.round(py + dy);
      let crossings = 0;
      let wasInDark = false;

      for (let x = Math.round(px); x <= maxX + 10; x++) {
        const dark = isDark(x, testY);
        if (dark && !wasInDark) {
          crossings++;
        }
        wasInDark = dark;
      }

      // Odd crossings = inside, even = outside
      if (crossings % 2 === 0) outsideVotes++;
    }

    // Majority vote
    return outsideVotes > offsets.length / 2;
  };

  // Test the center of each quadrant
  const q1x = minX + drawWidth * 0.25;
  const q1y = minY + drawHeight * 0.25;
  const q2x = minX + drawWidth * 0.75;
  const q2y = minY + drawHeight * 0.25;
  const q3x = minX + drawWidth * 0.25;
  const q3y = minY + drawHeight * 0.75;
  const q4x = minX + drawWidth * 0.75;
  const q4y = minY + drawHeight * 0.75;

  return {
    topLeft: isOutsideShape(q1x, q1y),
    topRight: isOutsideShape(q2x, q2y),
    bottomLeft: isOutsideShape(q3x, q3y),
    bottomRight: isOutsideShape(q4x, q4y),
  };
}

// ===== Detect diagonal lines (for bay window) =====
function detectDiagonalLines(
  isDark: (x: number, y: number) => boolean,
  minX: number, minY: number, maxX: number, maxY: number,
  drawWidth: number, drawHeight: number
): boolean {
  // Check for lines at roughly 45-degree angles in the left and right portions
  const sampleSize = Math.min(drawWidth, drawHeight);
  const checkRadius = sampleSize * 0.3;

  // Check left side for diagonal (top-left to bottom-center-left)
  let leftDiagCount = 0;
  let rightDiagCount = 0;
  const steps = 30;

  for (let i = 0; i < steps; i++) {
    const t = i / steps;

    // Left diagonal: from top-left area going down-right
    const lx = Math.round(minX + drawWidth * 0.1 + t * drawWidth * 0.2);
    const ly = Math.round(minY + t * drawHeight);
    // Check a small area around the expected diagonal line
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        if (isDark(lx + dx, ly + dy)) {
          leftDiagCount++;
          break;
        }
      }
    }

    // Right diagonal: from top-right area going down-left
    const rx = Math.round(maxX - drawWidth * 0.1 - t * drawWidth * 0.2);
    const ry = Math.round(minY + t * drawHeight);
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        if (isDark(rx + dx, ry + dy)) {
          rightDiagCount++;
          break;
        }
      }
    }
  }

  // If both sides have significant diagonal content, it's likely a trapezoid/bay
  const diagThreshold = steps * 0.35;
  return leftDiagCount > diagThreshold && rightDiagCount > diagThreshold;
}

// ===== Check if shape is L-shaped even with 4 quadrants partially filled =====
function isLShape(
  densityGrid: number[][],
  gridRows: number,
  gridCols: number,
  threshold: number
): boolean {
  // An L-shape has one quadrant with significantly less content
  const halfRow = Math.floor(gridRows / 2);
  const halfCol = Math.floor(gridCols / 2);

  const quadrantDensities = [0, 0, 0, 0]; // TL, TR, BL, BR

  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const qi = (row < halfRow ? 0 : 2) + (col < halfCol ? 0 : 1);
      quadrantDensities[qi] += densityGrid[row][col];
    }
  }

  const maxDensity = Math.max(...quadrantDensities);
  const minDensity = Math.min(...quadrantDensities);

  // If the weakest quadrant is less than 30% of the strongest, it's L-shaped
  return minDensity < maxDensity * 0.25;
}

// ===== Standard rectangle window detection (original logic) =====
function detectRectangleWindow(
  isDark: (x: number, y: number) => boolean,
  minX: number, minY: number, maxX: number, maxY: number,
  drawWidth: number, drawHeight: number
): SketchRecognitionResult {
  // Detect vertical dividing lines (mullions)
  const verticalLines: number[] = [];
  const margin = drawWidth * 0.1;
  for (let x = minX + margin; x < maxX - margin; x++) {
    let darkCount = 0;
    for (let y = minY; y <= maxY; y++) {
      if (isDark(Math.round(x), y)) darkCount++;
    }
    if (darkCount > drawHeight * 0.6) {
      if (verticalLines.length === 0 || x - verticalLines[verticalLines.length - 1] > 10) {
        verticalLines.push(x);
      }
    }
  }

  // Detect horizontal dividing lines
  const horizontalLines: number[] = [];
  const marginH = drawHeight * 0.1;
  for (let y = minY + marginH; y < maxY - marginH; y++) {
    let darkCount = 0;
    for (let x = minX; x <= maxX; x++) {
      if (isDark(x, Math.round(y))) darkCount++;
    }
    if (darkCount > drawWidth * 0.6) {
      if (horizontalLines.length === 0 || y - horizontalLines[horizontalLines.length - 1] > 10) {
        horizontalLines.push(y);
      }
    }
  }

  // Determine split direction and count
  const vCount = verticalLines.length;
  const hCount = horizontalLines.length;
  const direction: 'vertical' | 'horizontal' = vCount >= hCount ? 'vertical' : 'horizontal';
  const panelCount = Math.max(1, (direction === 'vertical' ? vCount : hCount) + 1);

  // Calculate window size from drawing aspect ratio
  const aspect = drawWidth / drawHeight;
  let winWidth: number, winHeight: number;
  if (aspect > 1) {
    winWidth = Math.round(Math.max(600, Math.min(3000, drawWidth * 3)));
    winHeight = Math.round(winWidth / aspect);
  } else {
    winHeight = Math.round(Math.max(600, Math.min(3000, drawHeight * 3)));
    winWidth = Math.round(winHeight * aspect);
  }

  // Calculate panel sizes from line positions
  const panelSizes: number[] = [];
  if (direction === 'vertical' && vCount > 0) {
    const positions = [minX, ...verticalLines, maxX];
    const totalDraw = maxX - minX;
    for (let i = 0; i < positions.length - 1; i++) {
      const ratio = (positions[i + 1] - positions[i]) / totalDraw;
      panelSizes.push(Math.round(winWidth * ratio));
    }
  } else if (direction === 'horizontal' && hCount > 0) {
    const positions = [minY, ...horizontalLines, maxY];
    const totalDraw = maxY - minY;
    for (let i = 0; i < positions.length - 1; i++) {
      const ratio = (positions[i + 1] - positions[i]) / totalDraw;
      panelSizes.push(Math.round(winHeight * ratio));
    }
  } else {
    panelSizes.push(direction === 'vertical' ? winWidth : winHeight);
  }

  const directionLabel = direction === 'vertical' ? '竖向' : '横向';

  if (panelCount <= 1) {
    return {
      name: '固定窗',
      width: winWidth,
      height: winHeight,
      description: `识别为固定窗 (${winWidth}x${winHeight}mm)`,
    };
  }

  return {
    name: `${panelCount}等分窗`,
    width: winWidth,
    height: winHeight,
    splitConfig: {
      panelCount,
      direction,
      totalWidth: winWidth,
      totalHeight: winHeight,
      panelSizes,
      equalSplit: false,
    },
    description: `识别为${panelCount}等分窗 (${directionLabel}分割, ${winWidth}x${winHeight}mm, 各格: ${panelSizes.join('/')}mm)`,
  };
}
