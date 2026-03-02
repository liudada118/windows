// WindoorDesigner - 算料 Web Worker
// 在后台线程执行算料计算，避免阻塞 UI
// 使用方式: new Worker(new URL('./calc-worker.ts', import.meta.url), { type: 'module' })

import { calculateBOM } from './calc-module';
import type { WindowUnit } from '@/lib/types';

export interface CalcWorkerMessage {
  type: 'calculate';
  payload: {
    windows: WindowUnit[];
  };
}

export interface CalcWorkerResult {
  type: 'result' | 'error' | 'progress';
  payload: unknown;
}

// Worker 消息处理
self.onmessage = (event: MessageEvent<CalcWorkerMessage>) => {
  const { type, payload } = event.data;

  if (type === 'calculate') {
    try {
      // 发送进度
      (self as unknown as Worker).postMessage({
        type: 'progress',
        payload: { stage: 'calculating', progress: 0.1 },
      });

      const result = calculateBOM(payload.windows);

      (self as unknown as Worker).postMessage({
        type: 'progress',
        payload: { stage: 'done', progress: 1.0 },
      });

      (self as unknown as Worker).postMessage({
        type: 'result',
        payload: result,
      });
    } catch (error) {
      (self as unknown as Worker).postMessage({
        type: 'error',
        payload: { message: error instanceof Error ? error.message : String(error) },
      });
    }
  }
};
