// WindoorDesigner - localStorage 持久化适配器
// 后端就绪后只需替换此文件的实现

import type { DesignData } from '@windoor/shared';
import { STORAGE_KEY } from './constants';

/**
 * 数据持久化适配器
 * 当前使用 localStorage，后续可替换为 API 调用
 */
export const storageAdapter = {
  /** 保存设计数据到 localStorage */
  save(design: DesignData): void {
    try {
      const json = JSON.stringify(design);
      localStorage.setItem(STORAGE_KEY, json);
      localStorage.setItem(`${STORAGE_KEY}-timestamp`, new Date().toISOString());
    } catch (e) {
      console.error('保存设计数据失败:', e);
    }
  },

  /** 从 localStorage 加载设计数据 */
  load(): DesignData | null {
    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (!json) return null;
      return JSON.parse(json) as DesignData;
    } catch {
      console.error('解析保存的设计数据失败');
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
          resolve(data);
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
};
