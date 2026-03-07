// WindoorDesigner - 尺寸编辑浮层组件
// 在画布上方叠加 HTML input 进行尺寸修改
// 点击尺寸数值后弹出，支持回车确认、Escape取消、点击外部关闭

import { useState, useRef, useEffect, useCallback } from 'react';
import type { DimensionClickInfo } from './DimensionRenderer';

interface DimensionEditOverlayProps {
  /** 当前编辑信息 */
  editInfo: DimensionClickInfo | null;
  /** 确认修改回调 */
  onConfirm: (info: DimensionClickInfo, newValue: number) => void;
  /** 取消编辑回调 */
  onCancel: () => void;
}

/** 尺寸编辑浮层 */
export default function DimensionEditOverlay({
  editInfo,
  onConfirm,
  onCancel,
}: DimensionEditOverlayProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 打开时初始化输入值并聚焦
  useEffect(() => {
    if (editInfo) {
      setInputValue(String(editInfo.currentValue));
      // 延迟聚焦以确保 DOM 已渲染
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      });
    }
  }, [editInfo]);

  const handleConfirm = useCallback(() => {
    if (!editInfo) return;
    const newValue = parseInt(inputValue, 10);
    if (isNaN(newValue) || newValue <= 0) {
      onCancel();
      return;
    }
    if (newValue === editInfo.currentValue) {
      onCancel();
      return;
    }
    onConfirm(editInfo, newValue);
  }, [editInfo, inputValue, onConfirm, onCancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        handleConfirm();
      } else if (e.key === 'Escape') {
        onCancel();
      }
    },
    [handleConfirm, onCancel]
  );

  if (!editInfo) return null;

  // 获取尺寸类型的中文标签
  const getLabel = () => {
    switch (editInfo.dimensionType) {
      case 'window-width': return '窗宽';
      case 'window-height': return '窗高';
      case 'opening-width': return '分格宽';
      case 'opening-height': return '分格高';
      default: return '尺寸';
    }
  };

  return (
    <>
      {/* 半透明遮罩 - 点击关闭 */}
      <div
        className="fixed inset-0 z-50"
        onClick={onCancel}
        style={{ background: 'transparent' }}
      />

      {/* 编辑弹窗 */}
      <div
        className="fixed z-50 flex flex-col items-center"
        style={{
          left: editInfo.screenX,
          top: editInfo.screenY,
          transform: 'translate(-50%, -50%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[oklch(0.18_0.025_260)] border border-amber-500/40 rounded-lg shadow-2xl shadow-black/50 p-2 flex flex-col gap-1.5 min-w-[140px]">
          {/* 标签 */}
          <div className="text-[10px] text-amber-400/70 font-mono text-center tracking-wider uppercase">
            {getLabel()} (mm)
          </div>

          {/* 输入框 */}
          <input
            ref={inputRef}
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-2 py-1.5 text-center text-sm font-mono font-bold
              bg-[oklch(0.12_0.02_260)] border border-amber-500/30 rounded-md
              text-amber-300 outline-none
              focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            min={100}
            max={10000}
            step={1}
          />

          {/* 操作按钮 */}
          <div className="flex gap-1">
            <button
              onClick={onCancel}
              className="flex-1 px-2 py-1 text-[10px] font-mono text-slate-400 bg-slate-700/50 rounded hover:bg-slate-600/50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-2 py-1 text-[10px] font-mono text-white bg-amber-600/80 rounded hover:bg-amber-500/80 transition-colors"
            >
              确认
            </button>
          </div>

          {/* 提示 */}
          <div className="text-[8px] text-slate-500 text-center">
            Enter 确认 / Esc 取消
          </div>
        </div>
      </div>
    </>
  );
}
