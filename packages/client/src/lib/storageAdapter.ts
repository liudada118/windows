// WindoorDesigner - localStorage 持久化适配器
// 后端就绪后只需替换此文件的实现
// BUG-002 修复: 保存前校验数据完整性，加载时过滤损坏数据

import type { DesignData, WindowUnit } from '@windoor/shared';
import { STORAGE_KEY } from './constants';

/** 校验单个窗户数据是否有效 */
function isValidWindow(win: WindowUnit): boolean {
  if (!win || typeof win !== 'object') return false;
  if (!win.id || typeof win.id !== 'string') return false;
  if (typeof win.width !== 'number' || win.width <= 0 || win.width > 10000) return false;
  if (typeof win.height !== 'number' || win.height <= 0 || win.height > 10000) return false;
  if (typeof win.posX !== 'number' || typeof win.posY !== 'number') return false;
  if (isNaN(win.width) || isNaN(win.height) || isNaN(win.posX) || isNaN(win.posY)) return false;
  if (!win.frame || !Array.isArray(win.frame.openings)) return false;
  return true;
}

/** 校验设计数据完整性 */
function validateDesignData(data: DesignData): DesignData {
  if (!data || typeof data !== 'object') {
    throw new Error('无效的设计数据');
  }
  // 过滤掉损坏的窗户数据
  const validWindows = (data.windows || []).filter(isValidWindow);
  const invalidCount = (data.windows || []).length - validWindows.length;
  if (invalidCount > 0) {
    console.warn(`已过滤 ${invalidCount} 个损坏的窗户数据`);
  }
  return {
    ...data,
    windows: validWindows,
  };
}

/**
 * 数据持久化适配器
 * 当前使用 localStorage，后续可替换为 API 调用
 */
export const storageAdapter = {
  /** 保存设计数据到 localStorage（保存前校验） */
  save(design: DesignData): void {
    try {
      const validated = validateDesignData(design);
      const json = JSON.stringify(validated);
      localStorage.setItem(STORAGE_KEY, json);
      localStorage.setItem(`${STORAGE_KEY}-timestamp`, new Date().toISOString());
    } catch (e) {
      console.error('保存设计数据失败:', e);
    }
  },

  /** 从 localStorage 加载设计数据（加载后校验） */
  load(): DesignData | null {
    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (!json) return null;
      const data = JSON.parse(json) as DesignData;
      return validateDesignData(data);
    } catch {
      console.error('解析保存的设计数据失败，已清除损坏数据');
      // 清除损坏的数据，防止反复加载失败
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  },

  /** 导出设计数据为 JSON 文件下载 */
  exportJSON(design: DesignData): void {
    const json = JSON.stringify(design, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${design.name || 'design'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /** 从 JSON 文件导入设计数据 */
  importJSON(file: File): Promise<DesignData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string) as DesignData;
          const validated = validateDesignData(data);
          resolve(validated);
        } catch {
          reject(new Error('无效的 JSON 文件'));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  },

  /** 获取上次保存时间 */
  getLastSaveTime(): string | null {
    return localStorage.getItem(`${STORAGE_KEY}-timestamp`);
  },

  /** 清除保存的数据 */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(`${STORAGE_KEY}-timestamp`);
  },

  /** 重置所有数据（BUG-002: 提供重置功能） */
  resetAll(): void {
    // 清除所有 windoor 相关的 localStorage 数据
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('windoor')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  },
};
