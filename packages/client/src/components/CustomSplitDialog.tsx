// CustomSplitDialog - 自定义等分窗对话框
// 支持选择等分数、方向、总尺寸和每格尺寸输入

import { useState, useCallback, useEffect, useMemo } from 'react';
import { X, Plus, Minus, ArrowLeftRight, ArrowUpDown } from 'lucide-react';

interface CustomSplitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: SplitConfig) => void;
}

export interface SplitConfig {
  totalWidth: number;
  totalHeight: number;
  direction: 'vertical' | 'horizontal';
  panelCount: number;
  panelSizes: number[];  // 每格尺寸（mm）
  equalSplit: boolean;
}

export default function CustomSplitDialog({ isOpen, onClose, onConfirm }: CustomSplitDialogProps) {
  const [totalWidth, setTotalWidth] = useState(2400);
  const [totalHeight, setTotalHeight] = useState(1500);
  const [direction, setDirection] = useState<'vertical' | 'horizontal'>('vertical');
  const [panelCount, setPanelCount] = useState(3);
  const [equalSplit, setEqualSplit] = useState(true);
  const [panelSizes, setPanelSizes] = useState<number[]>([800, 800, 800]);

  // 当等分模式或参数变化时重新计算
  useEffect(() => {
    if (equalSplit) {
      const totalDim = direction === 'vertical' ? totalWidth : totalHeight;
      // 减去中梃宽度（每个中梃70mm）
      const mullionTotal = (panelCount - 1) * 70;
      const frameTotal = 70 * 2; // 两侧框宽
      const available = totalDim - frameTotal - mullionTotal;
      const eachSize = Math.round(available / panelCount);
      setPanelSizes(Array(panelCount).fill(eachSize));
    }
  }, [equalSplit, panelCount, totalWidth, totalHeight, direction]);

  // 调整面板数量
  const handleCountChange = useCallback((delta: number) => {
    const newCount = Math.max(2, Math.min(8, panelCount + delta));
    setPanelCount(newCount);
    setEqualSplit(true);
  }, [panelCount]);

  // 修改单个面板尺寸
  const handleSizeChange = useCallback((index: number, value: string) => {
    const num = parseInt(value) || 0;
    const newSizes = [...panelSizes];
    newSizes[index] = num;
    setPanelSizes(newSizes);
    setEqualSplit(false);
  }, [panelSizes]);

  // 计算总尺寸和剩余空间
  const sizeInfo = useMemo(() => {
    const totalDim = direction === 'vertical' ? totalWidth : totalHeight;
    const mullionTotal = (panelCount - 1) * 70;
    const frameTotal = 70 * 2;
    const usedByPanels = panelSizes.reduce((a, b) => a + b, 0);
    const available = totalDim - frameTotal - mullionTotal;
    const remaining = available - usedByPanels;
    return { totalDim, available, usedByPanels, remaining };
  }, [direction, totalWidth, totalHeight, panelCount, panelSizes]);

  const handleConfirm = useCallback(() => {
    onConfirm({
      totalWidth,
      totalHeight,
      direction,
      panelCount,
      panelSizes,
      equalSplit,
    });
    onClose();
  }, [totalWidth, totalHeight, direction, panelCount, panelSizes, equalSplit, onConfirm, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[oklch(0.18_0.025_260)] border border-[oklch(0.30_0.04_260)] rounded-xl shadow-2xl w-[480px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[oklch(0.25_0.035_260)]">
          <h2 className="text-sm font-semibold text-slate-200">自定义等分窗</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* 总尺寸 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">总宽度 (mm)</label>
              <input
                type="number"
                value={totalWidth}
                onChange={(e) => { setTotalWidth(parseInt(e.target.value) || 0); setEqualSplit(true); }}
                className="w-full px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">总高度 (mm)</label>
              <input
                type="number"
                value={totalHeight}
                onChange={(e) => { setTotalHeight(parseInt(e.target.value) || 0); setEqualSplit(true); }}
                className="w-full px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200"
              />
            </div>
          </div>

          {/* 分割方向 */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">分割方向</label>
            <div className="flex gap-2">
              <button
                onClick={() => { setDirection('vertical'); setEqualSplit(true); }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
                  direction === 'vertical'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                <ArrowLeftRight size={14} />
                竖向分割
              </button>
              <button
                onClick={() => { setDirection('horizontal'); setEqualSplit(true); }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
                  direction === 'horizontal'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                <ArrowUpDown size={14} />
                横向分割
              </button>
            </div>
          </div>

          {/* 等分数量 */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">等分数量</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleCountChange(-1)}
                disabled={panelCount <= 2}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
              >
                <Minus size={14} />
              </button>
              <span className="text-2xl font-bold text-amber-400 w-12 text-center">{panelCount}</span>
              <button
                onClick={() => handleCountChange(1)}
                disabled={panelCount >= 8}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
              >
                <Plus size={14} />
              </button>
              <label className="flex items-center gap-1.5 ml-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={equalSplit}
                  onChange={(e) => setEqualSplit(e.target.checked)}
                  className="accent-amber-400"
                />
                <span className="text-xs text-slate-400">等分</span>
              </label>
            </div>
          </div>

          {/* 每格尺寸 */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">
              每格{direction === 'vertical' ? '宽度' : '高度'} (mm)
              {!equalSplit && (
                <span className={`ml-2 ${sizeInfo.remaining === 0 ? 'text-green-400' : sizeInfo.remaining > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                  {sizeInfo.remaining > 0 ? `剩余 ${sizeInfo.remaining}` : sizeInfo.remaining < 0 ? `超出 ${-sizeInfo.remaining}` : '尺寸匹配'}
                </span>
              )}
            </label>
            <div className="space-y-1.5">
              {panelSizes.map((size, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-6 text-right">#{i + 1}</span>
                  <input
                    type="number"
                    value={size}
                    onChange={(e) => handleSizeChange(i, e.target.value)}
                    className="flex-1 px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-slate-200 font-mono"
                  />
                  <span className="text-[10px] text-slate-500">mm</span>
                </div>
              ))}
            </div>
          </div>

          {/* 预览示意图 */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">预览</label>
            <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
              <SplitPreview
                direction={direction}
                panelSizes={panelSizes}
                totalWidth={totalWidth}
                totalHeight={totalHeight}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[oklch(0.25_0.035_260)]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!equalSplit && sizeInfo.remaining !== 0}
            className="px-4 py-1.5 text-xs rounded-lg bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            创建窗户
          </button>
        </div>
      </div>
    </div>
  );
}

/** 分割预览示意图 */
function SplitPreview({ direction, panelSizes, totalWidth, totalHeight }: {
  direction: 'vertical' | 'horizontal';
  panelSizes: number[];
  totalWidth: number;
  totalHeight: number;
}) {
  const maxW = 200;
  const maxH = 120;
  const aspect = totalWidth / totalHeight;
  let w: number, h: number;
  if (aspect > maxW / maxH) {
    w = maxW;
    h = maxW / aspect;
  } else {
    h = maxH;
    w = maxH * aspect;
  }

  const totalDim = direction === 'vertical' ? totalWidth : totalHeight;
  const totalSize = panelSizes.reduce((a, b) => a + b, 0) || 1;

  return (
    <svg width={w} height={h} className="mx-auto">
      {/* 外框 */}
      <rect x={0} y={0} width={w} height={h} fill="none" stroke="#718096" strokeWidth={2} rx={1} />

      {/* 分格 */}
      {panelSizes.map((size, i) => {
        const offset = panelSizes.slice(0, i).reduce((a, b) => a + b, 0);
        const ratio = size / totalSize;
        const offsetRatio = offset / totalSize;

        if (direction === 'vertical') {
          const px = offsetRatio * (w - 6) + 3;
          const pw = ratio * (w - 6);
          return (
            <g key={i}>
              <rect x={px} y={3} width={pw} height={h - 6} fill="rgba(173, 216, 230, 0.15)" stroke="#4a5568" strokeWidth={0.5} />
              <text x={px + pw / 2} y={h / 2} textAnchor="middle" dominantBaseline="middle" fill="#94a3b8" fontSize={9}>
                {size}
              </text>
            </g>
          );
        } else {
          const py = offsetRatio * (h - 6) + 3;
          const ph = ratio * (h - 6);
          return (
            <g key={i}>
              <rect x={3} y={py} width={w - 6} height={ph} fill="rgba(173, 216, 230, 0.15)" stroke="#4a5568" strokeWidth={0.5} />
              <text x={w / 2} y={py + ph / 2} textAnchor="middle" dominantBaseline="middle" fill="#94a3b8" fontSize={9}>
                {size}
              </text>
            </g>
          );
        }
      })}
    </svg>
  );
}
