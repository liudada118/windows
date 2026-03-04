// WindoorDesigner - 画布内联尺寸输入组件
// 双击尺寸标注时弹出，支持精确数值输入

import { useState, useRef, useEffect, useCallback } from 'react';

export interface DimensionInputProps {
  /** 输入框在画布容器中的屏幕坐标 */
  x: number;
  y: number;
  /** 当前值 (mm) */
  value: number;
  /** 最小值 */
  min: number;
  /** 最大值 */
  max: number;
  /** 标签 */
  label?: string;
  /** 确认回调 */
  onConfirm: (newValue: number) => void;
  /** 取消回调 */
  onCancel: () => void;
}

export default function DimensionInput({
  x,
  y,
  value,
  min,
  max,
  label,
  onConfirm,
  onCancel,
}: DimensionInputProps) {
  const [inputValue, setInputValue] = useState(String(Math.round(value)));
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 自动聚焦并全选
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const validate = useCallback((val: string): number | null => {
    const num = parseInt(val, 10);
    if (isNaN(num)) {
      setError('请输入数字');
      return null;
    }
    if (num < min) {
      setError(`最小 ${min}mm`);
      return null;
    }
    if (num > max) {
      setError(`最大 ${max}mm`);
      return null;
    }
    setError(null);
    return num;
  }, [min, max]);

  const handleConfirm = useCallback(() => {
    const num = validate(inputValue);
    if (num !== null) {
      onConfirm(num);
    }
  }, [inputValue, validate, onConfirm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation(); // 防止触发画布快捷键
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const newVal = Math.min(max, parseInt(inputValue || '0') + step);
      setInputValue(String(newVal));
      setError(null);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const newVal = Math.max(min, parseInt(inputValue || '0') - step);
      setInputValue(String(newVal));
      setError(null);
    }
  }, [handleConfirm, onCancel, inputValue, min, max]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (val) validate(val);
    else setError(null);
  }, [validate]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.parentElement?.contains(e.target as Node)) {
        handleConfirm();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleConfirm]);

  return (
    <div
      className="absolute z-50 flex flex-col items-center"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 输入框容器 */}
      <div className="flex items-center gap-1 bg-[oklch(0.15_0.025_260)] border border-amber-500/60 rounded-lg shadow-lg shadow-black/40 px-1.5 py-1">
        {label && (
          <span className="text-[9px] text-amber-400/70 font-medium whitespace-nowrap">{label}</span>
        )}
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="w-20 bg-[oklch(0.10_0.02_260)] border border-[oklch(0.30_0.04_260)] rounded px-2 py-0.5 text-xs text-amber-300 font-mono text-center focus:outline-none focus:ring-1 focus:ring-amber-500/60 focus:border-amber-500/60"
          style={{ caretColor: '#f59e0b' }}
        />
        <span className="text-[9px] text-slate-500 font-mono">mm</span>
        <button
          onClick={handleConfirm}
          className="w-5 h-5 flex items-center justify-center rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors text-xs"
          title="确认 (Enter)"
        >
          ✓
        </button>
      </div>
      {/* 错误提示 */}
      {error && (
        <div className="mt-1 px-2 py-0.5 bg-red-900/80 border border-red-500/50 rounded text-[9px] text-red-300 whitespace-nowrap">
          {error}
        </div>
      )}
      {/* 操作提示 */}
      <div className="mt-1 text-[8px] text-slate-600 whitespace-nowrap">
        ↑↓ 微调 · Shift+↑↓ ×10 · Enter 确认 · Esc 取消
      </div>
    </div>
  );
}
