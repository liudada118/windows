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

      {/* 编辑弹窗 - 蓝色专业风格 */}
      <div
        className="fixed z-50 flex flex-col items-center"
        style={{
          left: editInfo.screenX,
          top: editInfo.screenY,
          transform: 'translate(-50%, -50%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.97)',
            border: '1.5px solid #4A90D9',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(74, 144, 217, 0.2)',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            minWidth: '150px',
          }}
        >
          {/* 标签 */}
          <div
            style={{
              fontSize: '11px',
              color: '#4A90D9',
              fontWeight: 600,
              textAlign: 'center',
              letterSpacing: '0.5px',
            }}
          >
            {getLabel()} (MM)
          </div>

          {/* 输入框 */}
          <input
            ref={inputRef}
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              padding: '6px 8px',
              textAlign: 'center',
              fontSize: '16px',
              fontWeight: 700,
              fontFamily: 'Arial, sans-serif',
              background: '#f0f6ff',
              border: '1.5px solid #4A90D9',
              borderRadius: '4px',
              color: '#1a1a1a',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            min={100}
            max={10000}
            step={1}
          />

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '5px 8px',
                fontSize: '11px',
                fontWeight: 500,
                color: '#666',
                background: '#f0f0f0',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              style={{
                flex: 1,
                padding: '5px 8px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#fff',
                background: '#4A90D9',
                border: '1px solid #3a7bc8',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              确认
            </button>
          </div>

          {/* 提示 */}
          <div style={{ fontSize: '9px', color: '#999', textAlign: 'center' }}>
            Enter 确认 / Esc 取消
          </div>
        </div>
      </div>
    </>
  );
}
