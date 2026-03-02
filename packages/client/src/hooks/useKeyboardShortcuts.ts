// WindoorDesigner - 键盘快捷键 Hook
// 全局快捷键绑定

import { useEffect } from 'react';
import { useDesignStore } from '@/stores/designStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useHistoryStore } from '@/stores/historyStore';
import { storageAdapter } from '@/lib/storageAdapter';
import { toast } from 'sonner';

export function useKeyboardShortcuts() {
  const getSnapshot = useDesignStore((s) => s.getSnapshot);
  const restoreSnapshot = useDesignStore((s) => s.restoreSnapshot);
  const designData = useDesignStore((s) => s.designData);
  const selectedWindowId = useDesignStore((s) => s.selectedWindowId);
  const deleteWindow = useDesignStore((s) => s.deleteWindow);

  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const zoom = useCanvasStore((s) => s.zoom);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const resetView = useCanvasStore((s) => s.resetView);
  const toggleSnapToGrid = useCanvasStore((s) => s.toggleSnapToGrid);
  const toggleDimensions = useCanvasStore((s) => s.toggleDimensions);

  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const pushHistory = useHistoryStore((s) => s.pushHistory);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框内的快捷键
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+Z 撤销
      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const snapshot = undo(getSnapshot());
        if (snapshot) {
          restoreSnapshot(snapshot);
          toast.info('已撤销');
        }
        return;
      }

      // Ctrl+Y / Ctrl+Shift+Z 重做
      if ((ctrl && e.key === 'y') || (ctrl && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        const snapshot = redo(getSnapshot());
        if (snapshot) {
          restoreSnapshot(snapshot);
          toast.info('已重做');
        }
        return;
      }

      // Ctrl+S 保存
      if (ctrl && e.key === 's') {
        e.preventDefault();
        storageAdapter.save(designData);
        toast.success('已保存');
        return;
      }

      // Delete / Backspace 删除选中
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWindowId) {
        e.preventDefault();
        pushHistory(getSnapshot());
        deleteWindow(selectedWindowId);
        toast.success('已删除窗户');
        return;
      }

      // Escape 回到选择工具
      if (e.key === 'Escape') {
        setActiveTool('select');
        return;
      }

      // V 选择工具
      if (e.key === 'v' || e.key === 'V') {
        setActiveTool('select');
        return;
      }

      // R 绘制外框
      if (e.key === 'r' || e.key === 'R') {
        setActiveTool('draw-frame');
        return;
      }

      // M 竖中梃
      if (e.key === 'm' || e.key === 'M') {
        setActiveTool('add-mullion-v');
        return;
      }

      // H 横中梃
      if (e.key === 'h' || e.key === 'H') {
        setActiveTool('add-mullion-h');
        return;
      }

      // S 添加扇
      if (e.key === 's' && !ctrl) {
        setActiveTool('add-sash');
        return;
      }

      // G 切换网格吸附
      if (e.key === 'g' || e.key === 'G') {
        toggleSnapToGrid();
        return;
      }

      // D 切换尺寸标注
      if (e.key === 'd' || e.key === 'D') {
        toggleDimensions();
        return;
      }

      // + / = 放大
      if (e.key === '+' || e.key === '=') {
        setZoom(zoom * 1.1);
        return;
      }

      // - 缩小
      if (e.key === '-') {
        setZoom(zoom * 0.9);
        return;
      }

      // 0 重置视图
      if (e.key === '0' && ctrl) {
        e.preventDefault();
        resetView();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    getSnapshot, restoreSnapshot, designData, selectedWindowId,
    deleteWindow, setActiveTool, zoom, setZoom, resetView,
    toggleSnapToGrid, toggleDimensions, undo, redo, pushHistory,
  ]);
}
