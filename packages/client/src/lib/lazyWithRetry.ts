import { lazy, ComponentType } from 'react';

/**
 * 带重试机制的 React.lazy 包装器
 * 解决部署后旧 chunk 文件名变更导致动态导入失败的问题
 * 
 * 策略：
 * 1. 首次导入失败后，等待一小段时间再重试（最多3次）
 * 2. 如果所有重试都失败，强制刷新页面（清除缓存的旧模块映射）
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries = 3,
  interval = 1000,
): React.LazyExoticComponent<T> {
  return lazy(() => retryImport(importFn, retries, interval));
}

async function retryImport<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries: number,
  interval: number,
): Promise<{ default: T }> {
  for (let i = 0; i < retries; i++) {
    try {
      return await importFn();
    } catch (error) {
      // 最后一次重试也失败了
      if (i === retries - 1) {
        // 检查是否是 chunk 加载失败（部署更新导致）
        const isChunkError =
          error instanceof TypeError &&
          (error.message.includes('Failed to fetch dynamically imported module') ||
            error.message.includes('Importing a module script failed') ||
            error.message.includes('error loading dynamically imported module'));

        if (isChunkError) {
          // 检查是否已经尝试过刷新（防止无限刷新循环）
          const lastReload = sessionStorage.getItem('__chunk_reload_ts');
          const now = Date.now();
          if (!lastReload || now - parseInt(lastReload) > 10000) {
            sessionStorage.setItem('__chunk_reload_ts', String(now));
            window.location.reload();
            // 返回一个永远不会 resolve 的 promise，等待页面刷新
            return new Promise(() => {});
          }
        }
        throw error;
      }
      // 等待一段时间后重试
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
  // 不应该到达这里，但 TypeScript 需要
  throw new Error('Failed to load module after retries');
}
