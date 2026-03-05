// SketchPad.tsx - 手绘草图画板组件
// 支持在 Canvas 上手绘窗户草图，然后通过 AI 识别生成窗户模型

import { useRef, useState, useCallback, useEffect } from 'react';
import { X, Eraser, Undo2, Trash2, Wand2, Loader2, Pen, Download } from 'lucide-react';
import type { SplitConfig } from '@/components/CustomSplitDialog';

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

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      canvas.width = Math.min(rect.width - 32, 800);
      canvas.height = Math.min(rect.height - 200, 600);
    } else {
      canvas.width = 600;
      canvas.height = 450;
    }

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
      <div className="bg-[oklch(0.16_0.02_260)] border border-[oklch(0.30_0.04_260)] rounded-xl shadow-2xl w-[90vw] max-w-[900px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[oklch(0.25_0.035_260)]">
          <div>
            <h2 className="text-base font-semibold text-slate-100">手绘草图识别</h2>
            <p className="text-xs text-slate-400 mt-0.5">在画板上绘制窗户草图，AI 将自动识别并生成效果图</p>
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
              画一个矩形作为窗框，用竖线或横线表示中梃分割。例如：画一个矩形中间加一条竖线表示两等分窗。
              系统会自动分析线条位置来识别窗户结构。
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
                尺寸: {recognitionResult.width} x {recognitionResult.height}mm
                {recognitionResult.splitConfig && ` | ${recognitionResult.splitConfig.panelCount}等分 (${recognitionResult.splitConfig.direction === 'vertical' ? '竖向' : '横向'})`}
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
              onClick={() => onGenerate(recognitionResult)}
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

// ===== Local sketch recognition =====
// Analyzes the canvas pixel data to detect lines and rectangles
function localSketchRecognition(canvas: HTMLCanvasElement): SketchRecognitionResult {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas context');

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { width, height, data } = imageData;

  // Find dark pixels (drawn lines)
  const isDark = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return data[i] < 100 && data[i + 1] < 100 && data[i + 2] < 100;
  };

  // Find bounding box of drawing
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isDark(x, y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    return {
      name: '固定窗',
      width: 1200,
      height: 1500,
      description: '未检测到有效草图，已生成默认固定窗 (1200x1500mm)',
    };
  }

  const drawWidth = maxX - minX;
  const drawHeight = maxY - minY;

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
    },
    description: `识别为${panelCount}等分窗 (${directionLabel}分割, ${winWidth}x${winHeight}mm, 各格: ${panelSizes.join('/')}mm)`,
  };
}
