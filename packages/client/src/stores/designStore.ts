// WindoorDesigner - 设计数据 Zustand Store
// 管理所有窗户设计数据，提供增删改查操作

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type {
  WindowUnit,
  Opening,
  Frame,
  Sash,
  Mullion,
  ProfileSeries,
  SashType,
  DesignData,
  Rect,
  MaterialConfig,
  CompositeWindow,
} from '@windoor/shared';
import { DEFAULT_PROFILE_SERIES } from '@windoor/shared';
import { DEFAULT_COLOR_CONFIG, DEFAULT_GLASS } from '@/lib/constants';

/** 创建矩形 */
function createRect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

/** 创建默认 Opening */
function createOpening(rect: Rect): Opening {
  return {
    id: nanoid(8),
    rect,
    mullions: [],
    sash: null,
    glass: null,
    glassPane: null,
    childOpenings: [],
    isSplit: false,
  };
}

/** 创建扇 */
function createSash(type: SashType, rect: Rect, sashWidth: number): Sash {
  return {
    id: nanoid(8),
    type,
    rect,
    profileWidth: sashWidth,
    glassPane: null,
    hardware: [],
    hasFlyScreen: false,
  };
}

/** 创建中梃 */
function createMullion(
  type: 'vertical' | 'horizontal',
  position: number,
  profileWidth: number
): Mullion {
  return {
    id: nanoid(8),
    type,
    position,
    profileWidth,
    isArc: false,
  };
}

/** 创建框架 */
function createFrame(width: number, height: number, profileWidth: number): Frame {
  const pw = profileWidth;
  const innerRect = createRect(pw, pw, width - pw * 2, height - pw * 2);
  return {
    id: nanoid(8),
    shape: 'rectangle',
    points: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    profileWidth: pw,
    openings: [createOpening(innerRect)],
  };
}

/** 分割 Opening */
function splitOpening(
  opening: Opening,
  type: 'vertical' | 'horizontal',
  position: number,
  mullionWidth: number
): Opening {
  const mullion = createMullion(type, position, mullionWidth);
  const halfMullion = mullionWidth / 2;

  let child1Rect: Rect;
  let child2Rect: Rect;

  if (type === 'vertical') {
    child1Rect = createRect(
      opening.rect.x,
      opening.rect.y,
      position - opening.rect.x - halfMullion,
      opening.rect.height
    );
    child2Rect = createRect(
      position + halfMullion,
      opening.rect.y,
      opening.rect.x + opening.rect.width - position - halfMullion,
      opening.rect.height
    );
  } else {
    child1Rect = createRect(
      opening.rect.x,
      opening.rect.y,
      opening.rect.width,
      position - opening.rect.y - halfMullion
    );
    child2Rect = createRect(
      opening.rect.x,
      position + halfMullion,
      opening.rect.width,
      opening.rect.y + opening.rect.height - position - halfMullion
    );
  }

  return {
    ...opening,
    isSplit: true,
    sash: null,
    glass: null,
    glassPane: null,
    mullions: [...opening.mullions, mullion],
    childOpenings: [createOpening(child1Rect), createOpening(child2Rect)],
  };
}

/** 递归按比例缩放 Opening */
function resizeOpeningRecursive(opening: Opening, newRect: Rect): Opening {
  const oldRect = opening.rect;
  const scaleX = oldRect.width > 0 ? newRect.width / oldRect.width : 1;
  const scaleY = oldRect.height > 0 ? newRect.height / oldRect.height : 1;

  let updatedSash: Sash | null = null;
  if (opening.sash) {
    updatedSash = { ...opening.sash, rect: newRect };
  }

  if (!opening.isSplit || opening.childOpenings.length === 0) {
    return { ...opening, rect: newRect, sash: updatedSash };
  }

  const updatedMullions = opening.mullions.map((m) => {
    if (m.type === 'vertical') {
      const relativePos = m.position - oldRect.x;
      return { ...m, position: newRect.x + relativePos * scaleX };
    } else {
      const relativePos = m.position - oldRect.y;
      return { ...m, position: newRect.y + relativePos * scaleY };
    }
  });

  const updatedChildren = opening.childOpenings.map((child) => {
    const childNewRect = createRect(
      newRect.x + (child.rect.x - oldRect.x) * scaleX,
      newRect.y + (child.rect.y - oldRect.y) * scaleY,
      child.rect.width * scaleX,
      child.rect.height * scaleY
    );
    return resizeOpeningRecursive(child, childNewRect);
  });

  return {
    ...opening,
    rect: newRect,
    sash: updatedSash,
    mullions: updatedMullions,
    childOpenings: updatedChildren,
  };
}

/** 递归在 Opening 树中添加中梃 */
function addMullionInTree(
  openings: Opening[],
  openingId: string,
  type: 'vertical' | 'horizontal',
  position: number,
  mullionWidth: number
): Opening[] {
  return openings.map((opening) => {
    if (opening.id === openingId && !opening.isSplit) {
      return splitOpening(opening, type, position, mullionWidth);
    }
    if (opening.childOpenings.length > 0) {
      return {
        ...opening,
        childOpenings: addMullionInTree(
          opening.childOpenings,
          openingId,
          type,
          position,
          mullionWidth
        ),
      };
    }
    return opening;
  });
}

/** 递归在 Opening 树中添加扇 */
function addSashInTree(
  openings: Opening[],
  openingId: string,
  sashType: SashType,
  sashWidth: number
): Opening[] {
  return openings.map((opening) => {
    if (opening.id === openingId && !opening.isSplit) {
      return {
        ...opening,
        sash: createSash(sashType, opening.rect, sashWidth),
      };
    }
    if (opening.childOpenings.length > 0) {
      return {
        ...opening,
        childOpenings: addSashInTree(
          opening.childOpenings,
          openingId,
          sashType,
          sashWidth
        ),
      };
    }
    return opening;
  });
}

/** 递归删除中梃（合并子分格） */
function deleteMullionInTree(
  openings: Opening[],
  mullionId: string
): Opening[] {
  return openings.map((opening) => {
    const mullionIndex = opening.mullions.findIndex((m) => m.id === mullionId);
    if (mullionIndex !== -1) {
      return {
        ...opening,
        isSplit: false,
        mullions: opening.mullions.filter((m) => m.id !== mullionId),
        childOpenings: [],
        sash: null,
        glass: null,
        glassPane: null,
      };
    }
    if (opening.childOpenings.length > 0) {
      return {
        ...opening,
        childOpenings: deleteMullionInTree(opening.childOpenings, mullionId),
      };
    }
    return opening;
  });
}

/** 递归删除扇 */
function deleteSashInTree(
  openings: Opening[],
  sashId: string
): Opening[] {
  return openings.map((opening) => {
    if (opening.sash && opening.sash.id === sashId) {
      return { ...opening, sash: null };
    }
    if (opening.childOpenings.length > 0) {
      return {
        ...opening,
        childOpenings: deleteSashInTree(opening.childOpenings, sashId),
      };
    }
    return opening;
  });
}

/**
 * 查找中梃在 Opening 树中的有效移动范围，防止越过子 Opening 中的嵌套中梃。
 */
function getMinMullionPosition(opening: Opening, type: 'vertical' | 'horizontal'): number {
  if (!opening.isSplit || opening.childOpenings.length === 0) {
    return type === 'vertical' ? opening.rect.x : opening.rect.y;
  }
  const m = opening.mullions[0];
  if (m.type === type) {
    return m.position;
  }
  // 如果中梃方向不同，递归查找
  let minPos = type === 'vertical' ? opening.rect.x : opening.rect.y;
  for (const child of opening.childOpenings) {
    minPos = Math.min(minPos, getMinMullionPosition(child, type));
  }
  return minPos;
}

function getMaxMullionPosition(opening: Opening, type: 'vertical' | 'horizontal'): number {
  if (!opening.isSplit || opening.childOpenings.length === 0) {
    return type === 'vertical' ? opening.rect.x + opening.rect.width : opening.rect.y + opening.rect.height;
  }
  const m = opening.mullions[0];
  if (m.type === type) {
    return m.position;
  }
  let maxPos = type === 'vertical' ? opening.rect.x + opening.rect.width : opening.rect.y + opening.rect.height;
  for (const child of opening.childOpenings) {
    maxPos = Math.max(maxPos, getMaxMullionPosition(child, type));
  }
  return maxPos;
}

/**
 * 限制中梃位置，确保不会越过子 Opening 中的嵌套中梃。
 */
function clampMullionPosition(
  openings: Opening[],
  mullionId: string,
  newPosition: number,
  mullionWidth: number
): number {
  const result = findAndClampMullion(openings, mullionId, newPosition, mullionWidth);
  return result !== null ? result : newPosition;
}

function findAndClampMullion(
  openings: Opening[],
  mullionId: string,
  newPosition: number,
  mullionWidth: number
): number | null {
  for (const opening of openings) {
    const mullionIndex = opening.mullions.findIndex((m) => m.id === mullionId);
    if (mullionIndex !== -1) {
      const mullion = opening.mullions[mullionIndex];
      const halfMullion = mullionWidth / 2;
      const minGap = mullionWidth + 20; // 最小间距：中梃宽 + 20mm

      // 基本范围：父 Opening 的边界
      let minPos: number, maxPos: number;
      if (mullion.type === 'vertical') {
        minPos = opening.rect.x + halfMullion + 20;
        maxPos = opening.rect.x + opening.rect.width - halfMullion - 20;
      } else {
        minPos = opening.rect.y + halfMullion + 20;
        maxPos = opening.rect.y + opening.rect.height - halfMullion - 20;
      }

      // 检查子 Opening 中的嵌套中梃，限制不能越过它们
      if (opening.childOpenings.length >= 2) {
        const child0 = opening.childOpenings[0]; // 左/上子 Opening
        const child1 = opening.childOpenings[1]; // 右/下子 Opening

        // child0 中的最大中梃位置（不能左移超过它）
        if (child0.isSplit) {
          const child0Max = getMaxMullionPosition(child0, mullion.type);
          minPos = Math.max(minPos, child0Max + minGap);
        }

        // child1 中的最小中梃位置（不能右移超过它）
        if (child1.isSplit) {
          const child1Min = getMinMullionPosition(child1, mullion.type);
          maxPos = Math.min(maxPos, child1Min - minGap);
        }
      }

      return Math.max(minPos, Math.min(maxPos, newPosition));
    }

    // 递归查找
    if (opening.childOpenings.length > 0) {
      const found = findAndClampMullion(opening.childOpenings, mullionId, newPosition, mullionWidth);
      if (found !== null) return found;
    }
  }
  return null;
}

/**
 * 重建 Opening 的 rect，保持内部中梃的绝对位置不变。
 * 只调整 Opening 自身的 rect 和叶子 Opening 的 rect，
 * 不按比例缩放子中梃的位置。
 */
function rebuildOpeningWithFixedMullions(opening: Opening, newRect: Rect): Opening {
  let updatedSash: Sash | null = null;
  if (opening.sash) {
    updatedSash = { ...opening.sash, rect: newRect };
  }

  // 叶子节点：直接更新 rect
  if (!opening.isSplit || opening.childOpenings.length === 0) {
    return { ...opening, rect: newRect, sash: updatedSash };
  }

  // 有子分格：保持中梃绝对位置不变，重新计算子 Opening 的 rect
  const mullion = opening.mullions[0]; // 每个 split Opening 只有一个中梃
  const halfMullion = mullion.profileWidth / 2;

  let child0Rect: Rect;
  let child1Rect: Rect;

  if (mullion.type === 'vertical') {
    child0Rect = createRect(
      newRect.x,
      newRect.y,
      mullion.position - newRect.x - halfMullion,
      newRect.height
    );
    child1Rect = createRect(
      mullion.position + halfMullion,
      newRect.y,
      newRect.x + newRect.width - mullion.position - halfMullion,
      newRect.height
    );
  } else {
    child0Rect = createRect(
      newRect.x,
      newRect.y,
      newRect.width,
      mullion.position - newRect.y - halfMullion
    );
    child1Rect = createRect(
      newRect.x,
      mullion.position + halfMullion,
      newRect.width,
      newRect.y + newRect.height - mullion.position - halfMullion
    );
  }

  const updatedChildren = opening.childOpenings.map((child, i) => {
    const childNewRect = i === 0 ? child0Rect : child1Rect;
    return rebuildOpeningWithFixedMullions(child, childNewRect);
  });

  return {
    ...opening,
    rect: newRect,
    sash: updatedSash,
    childOpenings: updatedChildren,
  };
}

/** 递归更新中梃位置（拖拽） */
function updateMullionPositionInTree(
  openings: Opening[],
  mullionId: string,
  newPosition: number,
  mullionWidth: number
): Opening[] {
  return openings.map((opening) => {
    const mullionIndex = opening.mullions.findIndex((m) => m.id === mullionId);
    if (mullionIndex !== -1) {
      const mullion = opening.mullions[mullionIndex];
      const halfMullion = mullionWidth / 2;
      const updatedMullions = [...opening.mullions];
      updatedMullions[mullionIndex] = { ...mullion, position: newPosition };

      let child1Rect: Rect;
      let child2Rect: Rect;

      if (mullion.type === 'vertical') {
        child1Rect = createRect(
          opening.rect.x,
          opening.rect.y,
          newPosition - opening.rect.x - halfMullion,
          opening.rect.height
        );
        child2Rect = createRect(
          newPosition + halfMullion,
          opening.rect.y,
          opening.rect.x + opening.rect.width - newPosition - halfMullion,
          opening.rect.height
        );
      } else {
        child1Rect = createRect(
          opening.rect.x,
          opening.rect.y,
          opening.rect.width,
          newPosition - opening.rect.y - halfMullion
        );
        child2Rect = createRect(
          opening.rect.x,
          newPosition + halfMullion,
          opening.rect.width,
          opening.rect.y + opening.rect.height - newPosition - halfMullion
        );
      }

      // 使用 rebuildOpeningWithFixedMullions 保持子中梃绝对位置不变
      const updatedChildren = opening.childOpenings.map((child, i) => {
        const newRect = i === 0 ? child1Rect : child2Rect;
        return rebuildOpeningWithFixedMullions(child, newRect);
      });

      return {
        ...opening,
        mullions: updatedMullions,
        childOpenings: updatedChildren,
      };
    }

    if (opening.childOpenings.length > 0) {
      return {
        ...opening,
        childOpenings: updateMullionPositionInTree(
          opening.childOpenings,
          mullionId,
          newPosition,
          mullionWidth
        ),
      };
    }
    return opening;
  });
}

// ===== Store 接口定义 =====

interface DesignStoreState {
  /** 设计方案数据 */
  designData: DesignData;
  /** 当前选中的窗户 ID */
  selectedWindowId: string | null;
  /** 当前选中的组合窗 ID */
  selectedCompositeWindowId: string | null;
  /** 当前选中的元素 ID */
  selectedElementId: string | null;
  /** 当前选中的元素类型 */
  selectedElementType: 'frame' | 'mullion' | 'sash' | 'opening' | null;
  /** 当前激活的扇类型 */
  activeSashType: SashType;
  /** 当前使用的型材系列 */
  activeProfileSeries: ProfileSeries;
}

interface DesignStoreActions {
  /** 添加窗户 */
  addWindow: (width: number, height: number, posX: number, posY: number, name?: string) => string;
  /** 从模板添加窗户（直接传入 WindowUnit） */
  addWindowUnit: (win: WindowUnit) => void;
  /** 删除窗户 */
  deleteWindow: (windowId: string) => void;
  /** 选中窗户 */
  selectWindow: (windowId: string | null) => void;
  /** 选中元素 */
  selectElement: (elementId: string | null, elementType: DesignStoreState['selectedElementType']) => void;
  /** 更新窗户位置 */
  updateWindowPosition: (windowId: string, posX: number, posY: number) => void;
  /** 更新窗户尺寸（递归缩放内部结构） */
  updateWindowSize: (windowId: string, newWidth: number, newHeight: number) => void;
  /** 添加中梃 */
  addMullion: (windowId: string, openingId: string, direction: 'vertical' | 'horizontal', position: number) => void;
  /** 删除中梃 */
  deleteMullion: (windowId: string, mullionId: string) => void;
  /** 移动中梃 */
  moveMullion: (windowId: string, mullionId: string, newPosition: number) => void;
  /** 设置扇 */
  setSash: (windowId: string, openingId: string, sashType: SashType) => void;
  /** 删除扇 */
  deleteSash: (windowId: string, sashId: string) => void;
  /** 设置激活的扇类型 */
  setActiveSashType: (type: SashType) => void;
  /** 设置型材系列 */
  setActiveProfileSeries: (series: ProfileSeries) => void;
  /** 加载设计数据 */
  loadDesign: (data: DesignData) => void;
  /** 获取当前设计数据快照 */
  getSnapshot: () => DesignData;
  /** 从快照恢复 */
  restoreSnapshot: (snapshot: DesignData) => void;
  /** 获取选中的窗户 */
  getSelectedWindow: () => WindowUnit | null;
  /** 更新窗户属性 */
  updateWindow: (windowId: string, updates: Partial<WindowUnit>) => void;
  /** 更新材料配置 */
  updateMaterialConfig: (config: MaterialConfig) => void;
  /** 添加组合窗 */
  addCompositeWindow: (compositeWindow: CompositeWindow) => void;
  /** 删除组合窗 */
  deleteCompositeWindow: (compositeWindowId: string) => void;
  /** 选中组合窗 */
  selectCompositeWindow: (compositeWindowId: string | null) => void;
  /** 更新组合窗位置 */
  updateCompositeWindowPosition: (compositeWindowId: string, posX: number, posY: number) => void;
  /** 切换组合窗视图模式 */
  toggleCompositeViewMode: (compositeWindowId: string) => void;
  /** 获取选中的组合窗 */
  getSelectedCompositeWindow: () => CompositeWindow | null;
  /** 更新组合窗某个面板的尺寸 */
  updateCompositePanel: (compositeWindowId: string, panelId: string, width: number, height: number) => void;
}

type DesignStore = DesignStoreState & DesignStoreActions;

/** 创建空的设计数据 */
function createEmptyDesign(): DesignData {
  return {
    id: nanoid(8),
    name: '新设计方案',
    windows: [],
    materialConfig: {
      name: '断桥铝',
      colorPreset: 'dark-gray',
      colors: { frameColor: '#4A4A4A', sashColor: '#4A4A4A', mullionColor: '#555555', glassColor: '#ADD8E6', glassTint: 0.2 },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const useDesignStore = create<DesignStore>((set, get) => ({
  // ===== State =====
  designData: createEmptyDesign(),
  selectedWindowId: null,
  selectedCompositeWindowId: null,
  selectedElementId: null,
  selectedElementType: null,
  activeSashType: 'casement-left',
  activeProfileSeries: DEFAULT_PROFILE_SERIES[2], // 70系列

  // ===== Actions =====
  addWindow: (width, height, posX, posY, name) => {
    const series = get().activeProfileSeries;
    const newWindow: WindowUnit = {
      id: nanoid(8),
      name: name || `窗户-${get().designData.windows.length + 1}`,
      width,
      height,
      profileSeriesId: series.id,
      frame: createFrame(width, height, series.frameWidth),
      posX,
      posY,
      selected: false,
    };
    set((state) => ({
      designData: {
        ...state.designData,
        windows: [...state.designData.windows, newWindow],
        updatedAt: new Date().toISOString(),
      },
      selectedWindowId: newWindow.id,
    }));
    return newWindow.id;
  },

  addWindowUnit: (win) => {
    set((state) => ({
      designData: {
        ...state.designData,
        windows: [...state.designData.windows, win],
        updatedAt: new Date().toISOString(),
      },
      selectedWindowId: win.id,
    }));
  },

  deleteWindow: (windowId) => {
    set((state) => ({
      designData: {
        ...state.designData,
        windows: state.designData.windows.filter((w) => w.id !== windowId),
        updatedAt: new Date().toISOString(),
      },
      selectedWindowId:
        state.selectedWindowId === windowId ? null : state.selectedWindowId,
    }));
  },

  selectWindow: (windowId) => {
    set({
      selectedWindowId: windowId,
      selectedElementId: null,
      selectedElementType: null,
    });
  },

  selectElement: (elementId, elementType) => {
    set({ selectedElementId: elementId, selectedElementType: elementType });
  },

  updateWindowPosition: (windowId, posX, posY) => {
    set((state) => ({
      designData: {
        ...state.designData,
        windows: state.designData.windows.map((w) =>
          w.id === windowId ? { ...w, posX, posY } : w
        ),
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  updateWindowSize: (windowId, newWidth, newHeight) => {
    set((state) => ({
      designData: {
        ...state.designData,
        windows: state.designData.windows.map((w) => {
          if (w.id !== windowId) return w;
          const pw = w.frame.profileWidth;
          const newInnerRect = createRect(
            pw,
            pw,
            newWidth - pw * 2,
            newHeight - pw * 2
          );
          const updatedOpenings = w.frame.openings.map((opening) =>
            resizeOpeningRecursive(opening, newInnerRect)
          );
          return {
            ...w,
            width: newWidth,
            height: newHeight,
            frame: {
              ...w.frame,
              points: [
                { x: 0, y: 0 },
                { x: newWidth, y: 0 },
                { x: newWidth, y: newHeight },
                { x: 0, y: newHeight },
              ],
              openings: updatedOpenings,
            },
          };
        }),
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  addMullion: (windowId, openingId, direction, position) => {
    const series = get().activeProfileSeries;
    set((state) => ({
      designData: {
        ...state.designData,
        windows: state.designData.windows.map((w) => {
          if (w.id !== windowId) return w;
          return {
            ...w,
            frame: {
              ...w.frame,
              openings: addMullionInTree(
                w.frame.openings,
                openingId,
                direction,
                position,
                series.mullionWidth
              ),
            },
          };
        }),
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  deleteMullion: (windowId, mullionId) => {
    set((state) => ({
      designData: {
        ...state.designData,
        windows: state.designData.windows.map((w) => {
          if (w.id !== windowId) return w;
          return {
            ...w,
            frame: {
              ...w.frame,
              openings: deleteMullionInTree(w.frame.openings, mullionId),
            },
          };
        }),
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  moveMullion: (windowId, mullionId, newPosition) => {
    const series = get().activeProfileSeries;
    set((state) => {
      const win = state.designData.windows.find((w) => w.id === windowId);
      if (!win) return state;

      // 查找中梃所在的父 Opening，并计算有效移动范围
      const clampedPosition = clampMullionPosition(
        win.frame.openings,
        mullionId,
        newPosition,
        series.mullionWidth
      );

      return {
        designData: {
          ...state.designData,
          windows: state.designData.windows.map((w) => {
            if (w.id !== windowId) return w;
            return {
              ...w,
              frame: {
                ...w.frame,
                openings: updateMullionPositionInTree(
                  w.frame.openings,
                  mullionId,
                  clampedPosition,
                  series.mullionWidth
                ),
              },
            };
          }),
          updatedAt: new Date().toISOString(),
        },
      };
    });
  },

  setSash: (windowId, openingId, sashType) => {
    const series = get().activeProfileSeries;
    set((state) => ({
      designData: {
        ...state.designData,
        windows: state.designData.windows.map((w) => {
          if (w.id !== windowId) return w;
          return {
            ...w,
            frame: {
              ...w.frame,
              openings: addSashInTree(
                w.frame.openings,
                openingId,
                sashType,
                series.sashWidth
              ),
            },
          };
        }),
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  deleteSash: (windowId, sashId) => {
    set((state) => ({
      designData: {
        ...state.designData,
        windows: state.designData.windows.map((w) => {
          if (w.id !== windowId) return w;
          return {
            ...w,
            frame: {
              ...w.frame,
              openings: deleteSashInTree(w.frame.openings, sashId),
            },
          };
        }),
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  setActiveSashType: (type) => {
    set({ activeSashType: type });
  },

  setActiveProfileSeries: (series) => {
    set((state) => ({
      activeProfileSeries: series,
      designData: {
        ...state.designData,
        windows: state.designData.windows.map((w) => ({
          ...w,
          profileSeriesId: series.id,
        })),
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  loadDesign: (data) => {
    set({
      designData: data,
      selectedWindowId: null,
      selectedElementId: null,
      selectedElementType: null,
    });
  },

  getSnapshot: () => {
    return JSON.parse(JSON.stringify(get().designData));
  },

  restoreSnapshot: (snapshot) => {
    set({ designData: snapshot });
  },

  getSelectedWindow: () => {
    const { designData, selectedWindowId } = get();
    return designData.windows.find((w) => w.id === selectedWindowId) || null;
  },

  updateWindow: (windowId, updates) => {
    set((state) => ({
      designData: {
        ...state.designData,
        windows: state.designData.windows.map((w) =>
          w.id === windowId ? { ...w, ...updates } : w
        ),
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  updateMaterialConfig: (config) => {
    set((state) => ({
      designData: {
        ...state.designData,
        materialConfig: config,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  // ===== 组合窗 Actions =====

  addCompositeWindow: (compositeWindow) => {
    set((state) => ({
      designData: {
        ...state.designData,
        compositeWindows: [...(state.designData.compositeWindows || []), compositeWindow],
        updatedAt: new Date().toISOString(),
      },
      selectedCompositeWindowId: compositeWindow.id,
      selectedWindowId: null,
    }));
  },

  deleteCompositeWindow: (compositeWindowId) => {
    set((state) => ({
      designData: {
        ...state.designData,
        compositeWindows: (state.designData.compositeWindows || []).filter(cw => cw.id !== compositeWindowId),
        updatedAt: new Date().toISOString(),
      },
      selectedCompositeWindowId: state.selectedCompositeWindowId === compositeWindowId ? null : state.selectedCompositeWindowId,
    }));
  },

  selectCompositeWindow: (compositeWindowId) => {
    set({
      selectedCompositeWindowId: compositeWindowId,
      selectedWindowId: compositeWindowId ? null : undefined as any,
      selectedElementId: null,
      selectedElementType: null,
    });
  },

  updateCompositeWindowPosition: (compositeWindowId, posX, posY) => {
    set((state) => ({
      designData: {
        ...state.designData,
        compositeWindows: (state.designData.compositeWindows || []).map(cw =>
          cw.id === compositeWindowId ? { ...cw, posX, posY } : cw
        ),
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  toggleCompositeViewMode: (compositeWindowId) => {
    set((state) => ({
      designData: {
        ...state.designData,
        compositeWindows: (state.designData.compositeWindows || []).map(cw =>
          cw.id === compositeWindowId
            ? { ...cw, viewMode: cw.viewMode === 'unfold' ? 'perspective' as const : 'unfold' as const }
            : cw
        ),
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  getSelectedCompositeWindow: () => {
    const state = get();
    if (!state.selectedCompositeWindowId) return null;
    return (state.designData.compositeWindows || []).find(cw => cw.id === state.selectedCompositeWindowId) || null;
  },

  updateCompositePanel: (compositeWindowId, panelId, width, height) => {
    set((state) => ({
      designData: {
        ...state.designData,
        compositeWindows: (state.designData.compositeWindows || []).map(cw => {
          if (cw.id !== compositeWindowId) return cw;
          return {
            ...cw,
            panels: cw.panels.map(panel => {
              if (panel.id !== panelId) return panel;
              const newWin = { ...panel.windowUnit, width, height };
              // 更新 frame 和 root opening 的 rect
              const newFrame = {
                ...newWin.frame,
                rect: { x: 0, y: 0, width, height },
                openings: newWin.frame.openings.map((op, idx) =>
                  idx === 0 ? {
                    ...op,
                    rect: {
                      x: newWin.frame.profileWidth,
                      y: newWin.frame.profileWidth,
                      width: width - newWin.frame.profileWidth * 2,
                      height: height - newWin.frame.profileWidth * 2,
                    },
                  } : op
                ),
              };
              return { ...panel, windowUnit: { ...newWin, frame: newFrame } };
            }),
          };
        }),
        updatedAt: new Date().toISOString(),
      },
    }));
  },
}));
