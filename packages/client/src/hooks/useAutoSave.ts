// WindoorDesigner - 自动保存 Hook
// 定时自动保存到 localStorage

import { useEffect, useRef } from 'react';
import { useDesignStore } from '@/stores/designStore';
import { storageAdapter } from '@/lib/storageAdapter';
import { AUTO_SAVE_INTERVAL } from '@/lib/constants';

export function useAutoSave() {
  const designData = useDesignStore((s) => s.designData);
  const loadDesign = useDesignStore((s) => s.loadDesign);
  const isInitialized = useRef(false);

  // 启动时从 localStorage 恢复
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const saved = storageAdapter.load();
    if (saved) {
      loadDesign(saved);
      console.log('[AutoSave] 已从 localStorage 恢复设计数据');
    }
  }, [loadDesign]);

  // 定时自动保存
  useEffect(() => {
    const timer = setInterval(() => {
      storageAdapter.save(designData);
      console.log('[AutoSave] 已自动保存');
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(timer);
  }, [designData]);

  // 页面关闭前保存
  useEffect(() => {
    const handleBeforeUnload = () => {
      storageAdapter.save(designData);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [designData]);
}
