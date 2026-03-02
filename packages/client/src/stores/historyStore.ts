// WindoorDesigner - 撤销/重做 Zustand Store
// 基于快照的历史栈管理

import { create } from 'zustand';
import type { DesignData } from '@windoor/shared';

const MAX_HISTORY = 50;

interface HistoryStoreState {
  /** 历史快照栈（撤销用） */
  undoStack: DesignData[];
  /** 重做快照栈 */
  redoStack: DesignData[];
}

interface HistoryStoreActions {
  /** 保存当前状态到历史栈（在每次数据变更前调用） */
  pushHistory: (snapshot: DesignData) => void;
  /** 撤销：弹出历史栈顶，当前状态压入重做栈 */
  undo: (currentSnapshot: DesignData) => DesignData | null;
  /** 重做：弹出重做栈顶，当前状态压入历史栈 */
  redo: (currentSnapshot: DesignData) => DesignData | null;
  /** 是否可以撤销 */
  canUndo: () => boolean;
  /** 是否可以重做 */
  canRedo: () => boolean;
  /** 清空历史 */
  clearHistory: () => void;
}

type HistoryStore = HistoryStoreState & HistoryStoreActions;

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  // ===== State =====
  undoStack: [],
  redoStack: [],

  // ===== Actions =====
  pushHistory: (snapshot) => {
    set((state) => {
      const newStack = [...state.undoStack, JSON.parse(JSON.stringify(snapshot))];
      if (newStack.length > MAX_HISTORY) {
        newStack.shift();
      }
      return { undoStack: newStack, redoStack: [] };
    });
  },

  undo: (currentSnapshot) => {
    const state = get();
    if (state.undoStack.length === 0) return null;

    const newUndoStack = [...state.undoStack];
    const prevSnapshot = newUndoStack.pop()!;

    set({
      undoStack: newUndoStack,
      redoStack: [
        ...state.redoStack,
        JSON.parse(JSON.stringify(currentSnapshot)),
      ],
    });

    return prevSnapshot;
  },

  redo: (currentSnapshot) => {
    const state = get();
    if (state.redoStack.length === 0) return null;

    const newRedoStack = [...state.redoStack];
    const nextSnapshot = newRedoStack.pop()!;

    set({
      redoStack: newRedoStack,
      undoStack: [
        ...state.undoStack,
        JSON.parse(JSON.stringify(currentSnapshot)),
      ],
    });

    return nextSnapshot;
  },

  canUndo: () => get().undoStack.length > 0,

  canRedo: () => get().redoStack.length > 0,

  clearHistory: () => {
    set({ undoStack: [], redoStack: [] });
  },
}));
