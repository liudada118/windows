// WindoorDesigner - 编辑器主页面
// 三栏布局: 左侧工具面板 | 中间画布 | 右侧属性面板

import { useRef, useEffect, useState, useCallback } from 'react';
import KonvaCanvas from '@/components/canvas/KonvaCanvas';
import Toolbox from '@/components/Toolbox';
import PropertyPanel from '@/components/PropertyPanel';
import TopToolbar from '@/components/TopToolbar';
import ContextMenu from '@/components/ContextMenu';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useCanvasStore } from '@/stores/canvasStore';

export default function EditorPage() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const activeTool = useCanvasStore((s) => s.activeTool);

  // 注册快捷键和自动保存
  useKeyboardShortcuts();
  useAutoSave();

  // 监听画布容器尺寸变化
  const updateCanvasSize = useCallback(() => {
    if (canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: rect.height });
    }
  }, []);

  useEffect(() => {
    updateCanvasSize();
    const observer = new ResizeObserver(updateCanvasSize);
    if (canvasContainerRef.current) {
      observer.observe(canvasContainerRef.current);
    }
    return () => observer.disconnect();
  }, [updateCanvasSize]);

  // 工具名称映射
  const toolNames: Record<string, string> = {
    select: '选择工具 (V)',
    'draw-frame': '绘制外框 (R)',
    'add-mullion-v': '竖中梃 (M)',
    'add-mullion-h': '横中梃 (H)',
    'add-sash': '添加扇 (S)',
    pan: '平移 (空格)',
  };

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      {/* 顶部工具栏 */}
      <TopToolbar />

      {/* 主体区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧工具面板 */}
        <Toolbox />

        {/* 中间画布区域 */}
        <div className="flex-1 flex flex-col relative">
          {/* 当前工具提示 */}
          <div className="absolute top-2 left-2 z-10 bg-gray-900/80 backdrop-blur-sm rounded px-3 py-1 text-xs text-gray-400 border border-gray-700/50">
            {toolNames[activeTool] || activeTool}
          </div>

          {/* 画布容器 */}
          <div
            ref={canvasContainerRef}
            className="flex-1 overflow-hidden bg-gray-950"
          >
            <KonvaCanvas
              width={canvasSize.width}
              height={canvasSize.height}
            />
          </div>

          {/* 右键菜单 */}
          <ContextMenu containerRef={canvasContainerRef} />
        </div>

        {/* 右侧属性面板 */}
        <PropertyPanel />
      </div>

      {/* 底部状态栏 */}
      <div className="h-6 bg-gray-900 border-t border-gray-700 flex items-center px-4 text-xs text-gray-500">
        <span>画门窗设计器 v2.0 (Konva.js)</span>
        <div className="flex-1" />
        <span>
          快捷键: V=选择 R=绘制 M=竖中梃 H=横中梃 S=扇 G=网格 D=标注 Ctrl+Z=撤销
        </span>
      </div>
    </div>
  );
}
