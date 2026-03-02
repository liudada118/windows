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

      const updatedChildren = opening.childOpenings.map((child, i) => {
        const newRect = i === 0 ? child1Rect : child2Rect;
        return resizeOpeningRecursive(child, newRect);
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
}

type DesignStore = DesignStoreState & DesignStoreActions;

/** 创建空的设计数据 */
function createEmptyDesign(): DesignData {
  return {
    id: nanoid(8),
    name: '新设计方案',
    windows: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const useDesignStore = create<DesignStore>((set, get) => ({
  // ===== State =====
  designData: createEmptyDesign(),
  selectedWindowId: null,
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
    set((state) => ({
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
                newPosition,
                series.mullionWidth
              ),
            },
          };
        }),
        updatedAt: new Date().toISOString(),
      },
    }));
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
}));
