// WindoorDesigner - 右键菜单组件
// 提供快捷操作菜单

import { useEffect, useRef, useState, useCallback } from 'react';
import { useDesignStore } from '@/stores/designStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useHistoryStore } from '@/stores/historyStore';
import { toast } from 'sonner';

interface ContextMenuProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface MenuPosition {
  x: number;
  y: number;
}

export default function ContextMenu({ containerRef }: ContextMenuProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedWindowId = useDesignStore((s) => s.selectedWindowId);
  const selectedElementId = useDesignStore((s) => s.selectedElementId);
  const selectedElementType = useDesignStore((s) => s.selectedElementType);
  const deleteWindow = useDesignStore((s) => s.deleteWindow);
  const deleteMullion = useDesignStore((s) => s.deleteMullion);
  const deleteSash = useDesignStore((s) => s.deleteSash);
  const getSnapshot = useDesignStore((s) => s.getSnapshot);
  const pushHistory = useHistoryStore((s) => s.pushHistory);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setPosition({ x: e.clientX, y: e.clientY });
    setVisible(true);
  }, []);

  const handleClick = useCallback(() => {
    setVisible(false);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClick);
    };
  }, [containerRef, handleContextMenu, handleClick]);

  if (!visible) return null;

  const menuItems: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }[] = [];

  if (selectedWindowId) {
    menuItems.push({
      label: '删除窗户',
      danger: true,
      onClick: () => {
        pushHistory(getSnapshot());
        deleteWindow(selectedWindowId);
        toast.success('已删除窗户');
      },
    });

    if (selectedElementId && selectedElementType === 'mullion') {
      menuItems.push({
        label: '删除中梃',
        danger: true,
        onClick: () => {
          pushHistory(getSnapshot());
          deleteMullion(selectedWindowId, selectedElementId);
          toast.success('已删除中梃');
        },
      });
    }

    if (selectedElementId && selectedElementType === 'sash') {
      menuItems.push({
        label: '删除扇',
        danger: true,
        onClick: () => {
          pushHistory(getSnapshot());
          deleteSash(selectedWindowId, selectedElementId);
          toast.success('已删除扇');
        },
      });
    }

    menuItems.push({ label: '---', onClick: () => {} });

    menuItems.push({
      label: '添加竖中梃',
      onClick: () => setActiveTool('add-mullion-v'),
    });
    menuItems.push({
      label: '添加横中梃',
      onClick: () => setActiveTool('add-mullion-h'),
    });
    menuItems.push({
      label: '添加扇',
      onClick: () => setActiveTool('add-sash'),
    });
  } else {
    menuItems.push({
      label: '绘制外框',
      onClick: () => setActiveTool('draw-frame'),
    });
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ left: position.x, top: position.y }}
    >
      {menuItems.map((item, i) => {
        if (item.label === '---') {
          return <div key={i} className="border-t border-gray-700 my-1" />;
        }
        return (
          <button
            key={i}
            className={`w-full text-left px-4 py-1.5 text-sm transition-colors ${
              item.danger
                ? 'text-red-400 hover:bg-red-500/20'
                : item.disabled
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-200 hover:bg-gray-700'
            }`}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                setVisible(false);
              }
            }}
            disabled={item.disabled}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
