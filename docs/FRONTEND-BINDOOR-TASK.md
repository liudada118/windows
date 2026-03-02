# 前端画图渲染模块 — 开发任务书

> **文档版本：** V1.0 | **日期：** 2026-03-02 | **作者：** 技术负责人（Manus AI）
>
> **目标读者：** 前端开发工程师（1 人）
>
> **核心约束：** 本模块完全不依赖后端 API，所有数据使用 localStorage 持久化，后续通过 API 适配层无缝对接后端。

---

## 0. 任务总览

你将独立完成画门窗设计器的 **2D 画图渲染模块**，这是整个产品的灵魂模块。用户通过这个模块完成门窗的设计、分格、添加扇、调整尺寸等所有核心操作。

**交付目标：** 一个基于 Konva.js 的专业级 2D 门窗设计器，支持拖拽绘制外框、点击添加中梃/扇、拖拽调整分格、实时尺寸标注、撤销/重做、JSON 导入导出，以及 localStorage 自动保存。

**技术栈：**

| 分类 | 技术 | 说明 |
| :--- | :--- | :--- |
| 框架 | React 19 + TypeScript | 已有项目基础 |
| 画布引擎 | **Konva.js + react-konva** | 替换现有 SVG 方案 [1] |
| 状态管理 | **Zustand** | 替换现有 useReducer [2] |
| UI 组件 | shadcn/ui + Tailwind CSS 4 | 已有项目基础 |
| 数据持久化 | localStorage | 不依赖后端 |

**不需要你做的事情（后续由其他人完成）：**

- 后端 API、数据库、用户认证
- 3D 预览（Three.js 部分保留现有实现即可）
- 算料引擎（Web Worker 沙箱）
- 报价/订单/客户管理等业务模块

---

## 1. 技术架构

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                     App.tsx (路由)                        │
├─────────────────────────────────────────────────────────┤
│                  DesignerPage.tsx (主页面)                │
│  ┌──────────┬────────────────────────┬───────────────┐  │
│  │ Toolbox  │     KonvaCanvas        │ PropertyPanel │  │
│  │ (左侧)   │     (中央画布)          │ (右侧)        │  │
│  │          │                        │               │  │
│  │ 绘图工具  │  Stage                 │ 尺寸编辑      │  │
│  │ 扇类型   │  ├─ Layer: 网格        │ 颜色选择      │  │
│  │ 模板库   │  ├─ Layer: 外框/中梃    │ 扇类型选择    │  │
│  │          │  ├─ Layer: 玻璃填充     │ 型材系列      │  │
│  │          │  ├─ Layer: 扇标记       │ 玻璃配置      │  │
│  │          │  ├─ Layer: 尺寸标注     │               │  │
│  │          │  └─ Layer: 选中/控制点  │               │  │
│  └──────────┴────────────────────────┴───────────────┘  │
│  ┌──────────────────────────────────────────────────┐   │
│  │              TopToolbar (顶部工具栏)               │   │
│  │  模板选择 | 2D/3D切换 | 缩放 | 撤销/重做 | 导出   │   │
│  └──────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                   Zustand Stores                         │
│  ┌──────────────┬──────────────┬──────────────────┐     │
│  │ designStore  │ canvasStore  │ historyStore     │     │
│  │ (设计数据)    │ (画布状态)    │ (撤销/重做栈)    │     │
│  └──────────────┴──────────────┴──────────────────┘     │
├─────────────────────────────────────────────────────────┤
│                  持久化层 (localStorage)                  │
│  ┌──────────────────────────────────────────────────┐   │
│  │ storageAdapter.ts                                 │   │
│  │ save(designData) → localStorage                   │   │
│  │ load() → designData                               │   │
│  │ exportJSON() → 下载文件                            │   │
│  │ importJSON(file) → designData                     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Konva.js 分层策略

画布使用 6 个 Layer，从底到顶依次渲染。静态层（网格、标注）缓存为位图以提升性能，动态层（选中高亮、拖拽预览）独立更新。

| Layer | 内容 | 更新频率 | 缓存策略 |
| :--- | :--- | :--- | :--- |
| **L0 — 网格背景** | 10mm 网格线 + 100mm 粗线 | 仅缩放时 | `listening: false`, 缓存位图 |
| **L1 — 外框与中梃** | 框架矩形、中梃矩形、型材填充 | 数据变更时 | 按 Group 缓存 |
| **L2 — 玻璃区域** | 半透明填充 + 对角线标记 | 数据变更时 | 无 |
| **L3 — 扇标记** | 开启方向线（三角形/箭头）、把手图标 | 数据变更时 | 无 |
| **L4 — 尺寸标注** | 红色标注线 + 数值文字 | 数据变更时 | 无 |
| **L5 — 交互层** | 选中高亮框、控制点、拖拽预览、吸附线 | 每帧 | 禁止缓存 |

### 1.3 文件结构

```
client/src/
├── pages/
│   └── DesignerPage.tsx          # 主设计器页面（替换现有 Home.tsx）
├── components/
│   ├── canvas/                   # 画布相关组件
│   │   ├── KonvaCanvas.tsx       # Konva Stage 容器
│   │   ├── GridLayer.tsx         # L0 网格背景
│   │   ├── FrameRenderer.tsx     # L1 外框渲染
│   │   ├── MullionRenderer.tsx   # L1 中梃渲染
│   │   ├── GlassRenderer.tsx     # L2 玻璃区域渲染
│   │   ├── SashRenderer.tsx      # L3 扇标记渲染
│   │   ├── DimensionRenderer.tsx # L4 尺寸标注渲染
│   │   ├── SelectionOverlay.tsx  # L5 选中高亮和控制点
│   │   └── OpeningRenderer.tsx   # 递归渲染 Opening 及其子节点
│   ├── panels/
│   │   ├── Toolbox.tsx           # 左侧工具箱
│   │   ├── PropertyPanel.tsx     # 右侧属性面板
│   │   └── TopToolbar.tsx        # 顶部工具栏
│   └── ui/                       # shadcn/ui 组件（已有）
├── stores/
│   ├── designStore.ts            # 设计数据 Store
│   ├── canvasStore.ts            # 画布状态 Store
│   └── historyStore.ts           # 撤销/重做 Store
├── lib/
│   ├── types.ts                  # 核心类型定义
│   ├── constants.ts              # 常量定义
│   ├── geometry.ts               # 几何计算工具函数
│   ├── validators.ts             # 边界条件校验
│   ├── storageAdapter.ts         # localStorage 持久化适配器
│   └── templates.ts              # 预设窗型模板
└── hooks/
    ├── useKeyboardShortcuts.ts   # 键盘快捷键
    ├── useCanvasInteraction.ts   # 画布交互逻辑（缩放/平移/点击）
    └── useAutoSave.ts            # 自动保存 Hook
```

---

## 2. 数据模型

这是整个模块的基础，所有渲染和交互都由数据驱动。**严禁在渲染层出现任何独立的计算逻辑。** 改变数据模型是改变渲染结果的唯一途径。

### 2.1 核心类型定义

将以下类型写入 `client/src/lib/types.ts`：

```typescript
// ============================================================
// 基础类型
// ============================================================

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================
// 型材系列（参数化设计的核心）
// ============================================================

export interface ProfileSeries {
  id: string;
  name: string;                    // 如 "断桥铝70系列"
  frameProfileWidth: number;       // 框型材面宽 (mm)，如 70
  sashProfileWidth: number;        // 扇型材面宽 (mm)，如 65
  mullionProfileWidth: number;     // 中梃型材面宽 (mm)，如 70
  frameProfileHeight: number;      // 框型材截面高 (mm)，如 60
  sashProfileHeight: number;       // 扇型材截面高 (mm)
  mullionProfileHeight: number;    // 中梃型材截面高 (mm)
  defaultColor: string;            // 默认颜色，如 '#333333'
}

// ============================================================
// 扇开启方式（15 种）
// ============================================================

export type SashOpeningType =
  | 'fixed'                        // 固定扇
  | 'casement_inward_left'         // 左内开
  | 'casement_inward_right'        // 右内开
  | 'casement_outward_left'        // 左外开
  | 'casement_outward_right'       // 右外开
  | 'tilt_inward'                  // 内倒
  | 'tilt_and_turn_inward_left'    // 左内开内倒
  | 'tilt_and_turn_inward_right'   // 右内开内倒
  | 'awning_outward'               // 外开上悬
  | 'hopper_inward'                // 内开下悬
  | 'sliding_left'                 // 左推拉
  | 'sliding_right'                // 右推拉
  | 'folding_left'                 // 左折叠
  | 'folding_right';               // 右折叠

// ============================================================
// 玻璃
// ============================================================

export interface GlassPane {
  id: string;
  type: 'single' | 'double_glazed' | 'triple_glazed' | 'laminated';
  spec: string;                    // 如 "5+12A+5"
  thickness: number;               // 总厚度 (mm)，如 22
  fillGas: 'air' | 'argon';
}

// ============================================================
// 五金件
// ============================================================

export interface Hardware {
  id: string;
  type: 'handle' | 'hinge' | 'lock_point' | 'friction_stay';
  model: string;                   // 型号，如 "Hopo-053"
  position: Point;                 // 在扇上的安装位置
}

// ============================================================
// 扇（Sash）
// ============================================================

export interface Sash {
  id: string;
  openingType: SashOpeningType;
  profileWidth: number;            // 扇型材面宽（从系列继承）
  glassPane: GlassPane;
  hardware: Hardware[];
  hasFlyScreen: boolean;           // 是否带纱窗
}

// ============================================================
// 中梃（Mullion）
// ============================================================

export interface Mullion {
  id: string;
  direction: 'vertical' | 'horizontal';
  position: number;                // 相对于父 Opening 的位置 (mm)
  profileWidth: number;            // 中梃型材面宽
}

// ============================================================
// 分格/洞口（Opening）— 核心递归结构
// ============================================================

export interface Opening {
  id: string;
  rect: Rect;                      // 相对于父级的位置和尺寸 (mm)
  mullions: Mullion[];             // 分割此 Opening 的中梃列表
  children: Opening[];             // 被中梃分割后产生的子 Opening
  sash: Sash | null;               // 扇（与 children 互斥）
  glassPane: GlassPane | null;     // 直接填充玻璃（无扇时）
}

// ============================================================
// 框架（Frame）
// ============================================================

export interface Frame {
  id: string;
  shape: 'rectangle' | 'arc_top' | 'triangle' | 'polygon';
  profileWidth: number;            // 框型材面宽
  rootOpening: Opening;            // 根分格（框内的可用区域）
}

// ============================================================
// 窗户单元（顶层对象）
// ============================================================

export interface WindowUnit {
  id: string;
  name: string;                    // 如 "客厅大窗"
  width: number;                   // 外框总宽 (mm)
  height: number;                  // 外框总高 (mm)
  profileSeriesId: string;         // 使用的型材系列 ID
  frame: Frame;
  colorConfig: ColorConfig;
  posX: number;                    // 画布上的位置 X
  posY: number;                    // 画布上的位置 Y
}

// ============================================================
// 颜色配置
// ============================================================

export interface ColorConfig {
  frameColor: string;              // 外框颜色
  sashColor: string;               // 扇框颜色
  mullionColor: string;            // 中梃颜色
  handleColor: string;             // 把手颜色
}

// ============================================================
// 设计数据（最顶层）
// ============================================================

export interface DesignData {
  id: string;
  name: string;                    // 设计方案名称
  createdAt: string;               // ISO 时间戳
  updatedAt: string;
  windows: WindowUnit[];           // 画布上的所有窗户
  profileSeries: ProfileSeries[];  // 可用的型材系列列表
}

// ============================================================
// 画布状态
// ============================================================

export type ToolType =
  | 'select'                       // 选择工具
  | 'draw_frame'                   // 绘制外框
  | 'add_vertical_mullion'         // 添加垂直中梃
  | 'add_horizontal_mullion'       // 添加水平中梃（横档）
  | 'add_sash'                     // 添加扇
  | 'pan';                         // 平移工具

export interface CanvasState {
  activeTool: ToolType;
  zoom: number;                    // 缩放比例，1 = 100%
  panX: number;                    // 平移偏移 X
  panY: number;                    // 平移偏移 Y
  gridSize: number;                // 网格大小 (mm)，默认 10
  snapToGrid: boolean;             // 是否吸附网格
  showDimensions: boolean;         // 是否显示尺寸标注
  selectedElementId: string | null;
  selectedElementType: 'window' | 'opening' | 'mullion' | 'sash' | null;
  pendingSashType: SashOpeningType | null; // 待放置的扇类型
}
```

### 2.2 数据模型关系图

```
DesignData
├── profileSeries: ProfileSeries[]     ← 型材系列库（本地预置）
└── windows: WindowUnit[]              ← 画布上的所有窗户
    ├── id, name, width, height
    ├── colorConfig: ColorConfig
    └── frame: Frame
        ├── shape, profileWidth
        └── rootOpening: Opening       ← 递归树的根节点
            ├── rect: Rect
            ├── mullions: Mullion[]    ← 分割此区域的中梃
            ├── children: Opening[]    ← 被中梃分割后的子区域（递归）
            ├── sash: Sash | null      ← 扇（与 children 互斥）
            │   ├── openingType
            │   ├── glassPane
            │   └── hardware[]
            └── glassPane: GlassPane | null ← 直接填充玻璃
```

**关键约束：** `children` 和 `sash` 是互斥的。一个 Opening 要么被中梃分割产生 children，要么填充一个 sash，不能同时存在。

### 2.3 预置型材系列数据

在 `client/src/lib/constants.ts` 中预置以下型材系列，供用户选择：

```typescript
export const DEFAULT_PROFILE_SERIES: ProfileSeries[] = [
  {
    id: 'series-50',
    name: '50系列（经济型）',
    frameProfileWidth: 50,
    sashProfileWidth: 45,
    mullionProfileWidth: 50,
    frameProfileHeight: 50,
    sashProfileHeight: 45,
    mullionProfileHeight: 50,
    defaultColor: '#8B8B8B',
  },
  {
    id: 'series-60',
    name: '60系列（标准型）',
    frameProfileWidth: 60,
    sashProfileWidth: 55,
    mullionProfileWidth: 60,
    frameProfileHeight: 55,
    sashProfileHeight: 50,
    mullionProfileHeight: 55,
    defaultColor: '#666666',
  },
  {
    id: 'series-70',
    name: '断桥铝70系列',
    frameProfileWidth: 70,
    sashProfileWidth: 65,
    mullionProfileWidth: 70,
    frameProfileHeight: 60,
    sashProfileHeight: 55,
    mullionProfileHeight: 60,
    defaultColor: '#4A4A4A',
  },
  {
    id: 'series-85',
    name: '断桥铝85系列（高端）',
    frameProfileWidth: 85,
    sashProfileWidth: 75,
    mullionProfileWidth: 85,
    frameProfileHeight: 70,
    sashProfileHeight: 65,
    mullionProfileHeight: 70,
    defaultColor: '#333333',
  },
];

export const DEFAULT_GLASS: GlassPane = {
  id: 'default-glass',
  type: 'double_glazed',
  spec: '5+12A+5',
  thickness: 22,
  fillGas: 'air',
};
```

---

## 3. Zustand Store 设计

### 3.1 designStore（设计数据）

```typescript
// client/src/stores/designStore.ts
import { create } from 'zustand';
import type { DesignData, WindowUnit, Opening, Mullion, Sash } from '@/lib/types';

interface DesignStore {
  // 状态
  design: DesignData;

  // 窗户操作
  addWindow: (window: WindowUnit) => void;
  removeWindow: (windowId: string) => void;
  updateWindowSize: (windowId: string, width: number, height: number) => void;
  updateWindowPosition: (windowId: string, posX: number, posY: number) => void;

  // 中梃操作
  addMullion: (windowId: string, openingId: string, mullion: Mullion) => void;
  removeMullion: (windowId: string, openingId: string, mullionId: string) => void;
  moveMullion: (windowId: string, openingId: string, mullionId: string, newPosition: number) => void;

  // 扇操作
  setSash: (windowId: string, openingId: string, sash: Sash) => void;
  removeSash: (windowId: string, openingId: string) => void;

  // 颜色操作
  updateColor: (windowId: string, colorConfig: Partial<ColorConfig>) => void;

  // 型材系列
  changeProfileSeries: (windowId: string, seriesId: string) => void;

  // 持久化
  loadFromStorage: () => void;
  saveToStorage: () => void;
  exportJSON: () => string;
  importJSON: (json: string) => void;
}
```

### 3.2 canvasStore（画布状态）

```typescript
// client/src/stores/canvasStore.ts
import { create } from 'zustand';
import type { CanvasState, ToolType, SashOpeningType } from '@/lib/types';

interface CanvasStore extends CanvasState {
  setActiveTool: (tool: ToolType) => void;
  setZoom: (zoom: number) => void;
  setPan: (panX: number, panY: number) => void;
  setSelectedElement: (id: string | null, type: CanvasState['selectedElementType']) => void;
  setPendingSashType: (type: SashOpeningType | null) => void;
  toggleGrid: () => void;
  toggleDimensions: () => void;
  resetView: () => void;
}
```

### 3.3 historyStore（撤销/重做）

```typescript
// client/src/stores/historyStore.ts
import { create } from 'zustand';
import type { DesignData } from '@/lib/types';

interface HistoryStore {
  past: DesignData[];       // 撤销栈
  future: DesignData[];     // 重做栈
  maxSize: number;          // 最大历史记录数，默认 50

  pushState: (state: DesignData) => void;
  undo: () => DesignData | null;
  redo: () => DesignData | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}
```

**关键实现要点：** 每次 designStore 中的数据发生变更时，必须在变更前将当前状态 push 到 historyStore 的 past 栈中，并清空 future 栈。undo 时从 past 弹出最近的状态，将当前状态 push 到 future。redo 反之。

---

## 4. 核心交互逻辑

### 4.1 工具模式与交互映射

| 工具 | 快捷键 | 鼠标行为 | 光标样式 |
| :--- | :--- | :--- | :--- |
| **选择 (select)** | `V` | 点击选中元素；拖拽移动中梃；拖拽控制点调整尺寸 | `default` / `pointer`（悬停元素时） |
| **绘制外框 (draw_frame)** | `R` | 按下拖拽绘制矩形；释放创建窗户 | `crosshair` |
| **添加垂直中梃** | `M` | 悬停显示预览线；点击添加中梃 | `col-resize` |
| **添加水平中梃** | `Shift+M` | 悬停显示预览线；点击添加中梃 | `row-resize` |
| **添加扇 (add_sash)** | `S` | 悬停高亮可填充区域；点击放置扇 | `cell` |
| **平移 (pan)** | `H` / 空格+拖拽 | 拖拽平移画布 | `grab` / `grabbing` |

### 4.2 交互流程详细定义

#### 4.2.1 绘制外框（P0 — 第一优先级）

**触发条件：** `activeTool === 'draw_frame'`

**交互流程：**

1. 用户在画布空白区域按下鼠标左键，记录起始点 `(startX, startY)`
2. 拖拽过程中，在 L5 交互层实时绘制一个**蓝色虚线矩形**，并在矩形右下角动态显示宽高标注（如 `1200 × 1500`）
3. 如果 `snapToGrid === true`，矩形的四个角吸附到最近的网格点
4. 鼠标释放时：
   - 计算矩形的宽高（单位 mm，基于画布缩放比例换算）
   - 执行边界校验：`width >= 200 && width <= 6000 && height >= 200 && height <= 4000`
   - 校验通过：调用 `designStore.addWindow()` 创建一个新的 `WindowUnit`，自动生成 Frame 和一个充满 Frame 的根 Opening
   - 校验失败：显示 toast 提示（如"窗户宽度不能小于 200mm"），不创建窗户
5. 创建完成后，自动切换到 `select` 工具，并选中新创建的窗户

**数据变更：**

```typescript
// 创建新窗户时的数据结构
const newWindow: WindowUnit = {
  id: nanoid(),
  name: `窗户-${windows.length + 1}`,
  width: calculatedWidth,
  height: calculatedHeight,
  profileSeriesId: 'series-70', // 默认使用 70 系列
  frame: {
    id: nanoid(),
    shape: 'rectangle',
    profileWidth: 70, // 从系列继承
    rootOpening: {
      id: nanoid(),
      rect: {
        x: 70,           // frameProfileWidth
        y: 70,
        width: calculatedWidth - 70 * 2,
        height: calculatedHeight - 70 * 2,
      },
      mullions: [],
      children: [],
      sash: null,
      glassPane: DEFAULT_GLASS, // 默认填充玻璃
    },
  },
  colorConfig: {
    frameColor: '#4A4A4A',
    sashColor: '#4A4A4A',
    mullionColor: '#4A4A4A',
    handleColor: '#C0C0C0',
  },
  posX: startX,
  posY: startY,
};
```

#### 4.2.2 添加中梃（P0）

**触发条件：** `activeTool === 'add_vertical_mullion'` 或 `'add_horizontal_mullion'`

**交互流程：**

1. 鼠标在画布上移动时，检测鼠标是否位于某个**叶子 Opening**（没有 children 且没有 sash 的 Opening）内
2. 如果在叶子 Opening 内：
   - 在 L5 交互层绘制一条**绿色虚线**（垂直或水平），跟随鼠标位置
   - 在虚线两侧显示距离标注（到 Opening 两边的距离）
   - Opening 区域高亮显示（浅蓝色半透明覆盖）
3. 点击鼠标左键时：
   - 计算中梃位置（相对于 Opening 的 x 或 y 坐标）
   - 执行边界校验：
     - 中梃到 Opening 边缘的净距 >= 100mm
     - 中梃到最近平行中梃的净距 >= 100mm
     - 分割后的两个子 Opening 的宽/高 >= 100mm
   - 校验通过：调用 `designStore.addMullion()` 添加中梃，同时自动创建两个子 Opening
   - 校验失败：显示 toast 提示

**数据变更（以垂直中梃为例）：**

```typescript
// 添加垂直中梃后的数据变更
function addVerticalMullion(opening: Opening, positionX: number, mullionWidth: number): void {
  const mullion: Mullion = {
    id: nanoid(),
    direction: 'vertical',
    position: positionX,     // 相对于 opening.rect.x 的偏移
    profileWidth: mullionWidth,
  };

  // 创建左侧子 Opening
  const leftChild: Opening = {
    id: nanoid(),
    rect: {
      x: opening.rect.x,
      y: opening.rect.y,
      width: positionX - mullionWidth / 2,
      height: opening.rect.height,
    },
    mullions: [],
    children: [],
    sash: null,
    glassPane: { ...DEFAULT_GLASS, id: nanoid() },
  };

  // 创建右侧子 Opening
  const rightChild: Opening = {
    id: nanoid(),
    rect: {
      x: opening.rect.x + positionX + mullionWidth / 2,
      y: opening.rect.y,
      width: opening.rect.width - positionX - mullionWidth / 2,
      height: opening.rect.height,
    },
    mullions: [],
    children: [],
    sash: null,
    glassPane: { ...DEFAULT_GLASS, id: nanoid() },
  };

  // 更新父 Opening
  opening.mullions.push(mullion);
  opening.children = [leftChild, rightChild];
  opening.glassPane = null; // 清除父级的玻璃填充
}
```

#### 4.2.3 添加扇（P0）

**触发条件：** `activeTool === 'add_sash'` 且 `pendingSashType !== null`

**交互流程：**

1. 用户先在左侧 Toolbox 选择扇类型（如"左内开"），此时 `pendingSashType` 被设置
2. 鼠标在画布上移动时，检测鼠标是否位于某个**叶子 Opening**内
3. 如果在叶子 Opening 内：
   - Opening 区域高亮显示（浅绿色半透明覆盖）
   - 显示扇类型的预览图例
4. 点击鼠标左键时：
   - 校验：该 Opening 没有 children（未被分割）
   - 校验通过：调用 `designStore.setSash()` 设置扇
   - 清除 `pendingSashType`，切换回 `select` 工具

**数据变更：**

```typescript
const newSash: Sash = {
  id: nanoid(),
  openingType: pendingSashType,
  profileWidth: currentSeries.sashProfileWidth,
  glassPane: {
    id: nanoid(),
    type: 'double_glazed',
    spec: '5+12A+5',
    thickness: 22,
    fillGas: 'air',
  },
  hardware: [],
  hasFlyScreen: false,
};

// 更新 Opening
opening.sash = newSash;
opening.glassPane = null; // 扇内已有玻璃，清除 Opening 级别的玻璃
```

#### 4.2.4 拖拽移动中梃（P0）

**触发条件：** `activeTool === 'select'`，鼠标按下在中梃上

**交互流程：**

1. 用户在 `select` 模式下，鼠标悬停在中梃上时，光标变为 `col-resize`（垂直中梃）或 `row-resize`（水平中梃）
2. 按下鼠标左键并拖拽：
   - 中梃跟随鼠标移动（仅在其方向上移动）
   - 两侧子 Opening 的尺寸实时变化
   - 实时显示两侧距离标注
3. 拖拽过程中持续执行边界校验（最小分格尺寸 100mm）
4. 如果拖拽到非法位置，中梃显示为红色，释放时回弹到最近的合法位置
5. 释放鼠标时：调用 `designStore.moveMullion()` 更新中梃位置和两侧子 Opening 的 rect

#### 4.2.5 修改整体尺寸（P0）

**触发条件：** 在右侧 PropertyPanel 中修改宽度或高度输入框

**交互流程：**

1. 用户在属性面板输入新的宽度或高度值（支持数学表达式，如 `2400/2+50`）
2. 按回车或输入框失焦时触发更新
3. 执行边界校验（200 ≤ width ≤ 6000，200 ≤ height ≤ 4000）
4. 校验通过后，调用 `designStore.updateWindowSize()`
5. **关键：** 内部所有 Opening、Mullion 的位置和尺寸必须**按比例递归缩放**

**递归缩放算法：**

```typescript
function scaleOpening(opening: Opening, scaleX: number, scaleY: number): void {
  // 缩放自身 rect
  opening.rect.x *= scaleX;
  opening.rect.y *= scaleY;
  opening.rect.width *= scaleX;
  opening.rect.height *= scaleY;

  // 缩放中梃位置
  for (const mullion of opening.mullions) {
    if (mullion.direction === 'vertical') {
      mullion.position *= scaleX;
    } else {
      mullion.position *= scaleY;
    }
  }

  // 递归缩放子 Opening
  for (const child of opening.children) {
    scaleOpening(child, scaleX, scaleY);
  }
}
```

#### 4.2.6 删除组件（P0）

**触发条件：** 选中元素后按 `Delete` 或 `Backspace`

**删除中梃的逻辑：**

1. 找到中梃所在的父 Opening
2. 移除该 Mullion
3. 将该中梃分割的两个子 Opening **合并**为一个 Opening
4. 合并后的 Opening 的 rect 为两个子 Opening 的并集
5. 合并后的 Opening 的 sash 和 glassPane 清空（用户需要重新设置）

**删除扇的逻辑：**

1. 找到扇所在的 Opening
2. 将 `opening.sash` 设为 `null`
3. 恢复 `opening.glassPane` 为默认玻璃

### 4.3 视图操作

| 操作 | 触发方式 | 实现 |
| :--- | :--- | :--- |
| **缩放** | `Ctrl` + 滚轮 / 触摸板双指捏合 | 修改 `canvasStore.zoom`，范围 `[0.1, 5.0]`，以鼠标位置为中心缩放 |
| **平移** | 中键拖拽 / 空格+左键拖拽 / `H` 工具 | 修改 `canvasStore.panX/panY` |
| **恢复默认** | `Ctrl+0` / 双击中键 | `zoom=1, panX=0, panY=0` |
| **适应画布** | `Ctrl+1` | 计算所有窗户的包围盒，自动调整 zoom 和 pan 使所有内容可见 |

### 4.4 键盘快捷键

| 快捷键 | 功能 |
| :--- | :--- |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Shift+Z` / `Ctrl+Y` | 重做 |
| `Ctrl+S` | 保存到 localStorage |
| `Ctrl+E` | 导出 JSON |
| `Delete` / `Backspace` | 删除选中元素 |
| `Escape` | 取消当前操作 / 切换到选择工具 |
| `V` | 选择工具 |
| `R` | 绘制外框工具 |
| `M` | 添加垂直中梃 |
| `Shift+M` | 添加水平中梃 |
| `S` | 添加扇工具 |
| `H` | 平移工具 |
| `Ctrl+` `+` | 放大 |
| `Ctrl+` `-` | 缩小 |
| `Ctrl+0` | 恢复默认视图 |

---

## 5. 2D 渲染规范

### 5.1 渲染风格

采用**工业蓝图**美学风格，确保专业性和一致性。

| 元素 | 颜色 | 线宽 | 样式 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| **外框型材** | `#4a5568` | 1.5px | 实线矩形，内部 45° 斜线填充 | 四条型材矩形 |
| **中梃型材** | `#4a5568` | 1.5px | 实线矩形，内部 45° 斜线填充 | 同外框风格 |
| **玻璃区域** | `rgba(173,216,230,0.22)` | 0.5px | 半透明填充 + 对角交叉线（X） | 表示玻璃 |
| **平开扇标记** | `#e53e3e` | 1.8px | 实线三角形（内开）/ 虚线三角形（外开） | 三角形底边在铰链侧 |
| **内开内倒标记** | `#e53e3e` | 1.8px | 实线三角形 + 虚线三角形叠加 | 两组图例叠加 |
| **推拉扇标记** | `#3182ce` | 1.8px | 虚线箭头 | 箭头指向推拉方向 |
| **上悬/下悬标记** | `#e53e3e` | 1.8px | 实线三角形（底边在铰链侧） | 上悬底边在上，下悬底边在下 |
| **固定扇标记** | `#718096` | 1.0px | 对角交叉线（X） | 表示不可开启 |
| **尺寸标注** | `#f59e0b` | 0.8px | 橙色标注线 + 数值文字 | 使用 JetBrains Mono 字体 |
| **选中高亮** | `#f59e0b` | 2.5px | 橙色边框 + 辉光效果 | 选中时显示 |
| **控制点** | `#ffffff` 填充 + `#f59e0b` 边框 | — | 8×8px 方块 | 选中时在四角和四边中点显示 |
| **吸附对齐线** | `#FF3B30` | 1px | 虚线 | 拖拽时显示 |
| **中梃预览线** | `#38A169` | 1px | 虚线 | 添加中梃工具悬停时 |

### 5.2 扇类型 2D 图例渲染规则

每种扇类型的 2D 图例必须严格按照以下规则渲染：

**平开扇（casement_inward_left / casement_inward_right）：**

```
┌─────────────────┐      ┌─────────────────┐
│╲               │      │               ╱│
│  ╲             │      │             ╱  │
│    ╲           │      │           ╱    │
│      ╲         │      │         ╱      │
│        ╲       │      │       ╱        │
│          ╲     │      │     ╱          │
│            ╲   │      │   ╱            │
│              ╲ │      │ ╱              │
│              ╱ │      │ ╲              │
│            ╱   │      │   ╲            │
│          ╱     │      │     ╲          │
│        ╱       │      │       ╲        │
│      ╱         │      │         ╲      │
│    ╱           │      │           ╲    │
│  ╱             │      │             ╲  │
│╱               │      │               ╲│
└─────────────────┘      └─────────────────┘
  左内开 (铰链在左)        右内开 (铰链在右)
  实线三角形               实线三角形
```

- 三角形的底边在铰链侧，顶点在对侧中心
- 内开用**实线**，外开用**虚线**
- 铰链侧绘制两个小圆点（高度 25% 和 75% 处）

**内开内倒扇（tilt_and_turn_inward_left / right）：**

- 叠加两组图例：一组平开方向的实线三角形 + 一组内倒方向的虚线三角形
- 内倒三角形：底边在下方，顶点指向上方中心

**推拉扇（sliding_left / sliding_right）：**

- 水平中心线上绘制虚线箭头，长度为扇宽 40%
- 使用蓝色 `#3182ce`

**固定扇（fixed）：**

- 仅绘制对角交叉线（X），无方向标记

---

## 6. 边界条件与校验规则

以下规则在用户进行任何交互操作时必须被**实时检查和执行**。违反规则时阻止操作并给出视觉反馈。

### 6.1 校验规则表

| 约束 | 规则 | 触发场景 | 违反时行为 |
| :--- | :--- | :--- | :--- |
| 窗户最小尺寸 | `width >= 200mm && height >= 200mm` | 绘制外框、修改尺寸 | 阻止操作 + toast |
| 窗户最大尺寸 | `width <= 6000mm && height <= 4000mm` | 绘制外框、修改尺寸 | 阻止操作 + toast |
| 最小分格尺寸 | Opening 的 `width >= 100mm && height >= 100mm` | 添加中梃、拖拽中梃、修改尺寸 | 阻止操作 + 红色高亮 |
| 中梃边距 | 中梃到父 Opening 边缘净距 >= 100mm | 添加中梃、拖拽中梃 | 阻止操作 + 红色高亮 |
| 中梃间距 | 两根平行中梃净距 >= 100mm | 添加中梃、拖拽中梃 | 阻止操作 + 红色高亮 |
| 扇填充互斥 | Opening 不能同时有 `sash` 和 `children` | 添加扇、添加中梃 | 阻止操作 + toast |
| 开启扇最小宽度 | 非固定扇的 Opening `width >= 500mm` | 添加扇 | 警告 toast（不阻止） |
| 开启扇推荐尺寸 | `500 <= width <= 700mm`, `900 <= height <= 1400mm` | 添加扇 | 黄色警告标记 |

### 6.2 校验工具函数

在 `client/src/lib/validators.ts` 中实现：

```typescript
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateWindowSize(width: number, height: number): ValidationResult;
export function validateMullionPlacement(
  opening: Opening,
  direction: 'vertical' | 'horizontal',
  position: number,
  mullionWidth: number
): ValidationResult;
export function validateSashPlacement(opening: Opening): ValidationResult;
export function validateDesign(design: DesignData): ValidationResult;
```

---

## 7. 持久化适配器

### 7.1 localStorage 适配器

在 `client/src/lib/storageAdapter.ts` 中实现：

```typescript
const STORAGE_KEY = 'windoor-designer-data';
const AUTO_SAVE_INTERVAL = 30_000; // 30 秒自动保存

export const storageAdapter = {
  save(design: DesignData): void {
    const json = JSON.stringify(design);
    localStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(`${STORAGE_KEY}-timestamp`, new Date().toISOString());
  },

  load(): DesignData | null {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    try {
      return JSON.parse(json) as DesignData;
    } catch {
      console.error('Failed to parse saved design data');
      return null;
    }
  },

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

  importJSON(file: File): Promise<DesignData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string) as DesignData;
          // TODO: 数据格式校验
          resolve(data);
        } catch (e) {
          reject(new Error('无效的 JSON 文件'));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  },

  getLastSaveTime(): string | null {
    return localStorage.getItem(`${STORAGE_KEY}-timestamp`);
  },
};
```

### 7.2 后续 API 对接预留

当后端就绪后，只需要替换 `storageAdapter` 的实现为 API 调用，其他代码无需修改：

```typescript
// 未来替换为：
export const storageAdapter = {
  save: (design) => fetch('/api/v1/designs', { method: 'PUT', body: JSON.stringify(design) }),
  load: () => fetch('/api/v1/designs/current').then(r => r.json()),
  // ...
};
```

---

## 8. 预设模板

在 `client/src/lib/templates.ts` 中实现以下预设模板，用户可以一键创建常见窗型：

| 模板名称 | 描述 | 默认尺寸 | 结构 |
| :--- | :--- | :--- | :--- |
| 单扇固定窗 | 一个固定玻璃 | 800×1200 | 1 个 Opening + fixed 扇 |
| 两等分（左右） | 垂直中梃分为左右两格 | 1500×1500 | 1 个垂直中梃 → 2 个子 Opening |
| 两等分（上下） | 水平中梃分为上下两格 | 1200×1800 | 1 个水平中梃 → 2 个子 Opening |
| 三等分 | 两根垂直中梃分为三格 | 2400×1500 | 2 个垂直中梃 → 3 个子 Opening |
| 田字格 | 一横一竖分为四格 | 2000×2000 | 1 垂直 + 2 水平中梃 → 4 个子 Opening |
| 左固右开 | 左侧固定 + 右侧内开 | 1500×1500 | 1 垂直中梃 → 左 fixed + 右 casement_inward_right |
| 三扇推拉 | 三等分 + 推拉扇 | 2400×1500 | 2 垂直中梃 → 左 sliding_right + 中 fixed + 右 sliding_left |
| 内开内倒 | 单扇内开内倒 | 800×1400 | 1 个 Opening + tilt_and_turn_inward_left |

每个模板是一个函数，接收可选的宽高参数，返回一个完整的 `WindowUnit` 对象。

---

## 9. 任务拆分与排期

### 9.1 Sprint 1（第 1-2 周）：基础框架搭建

| 任务 ID | 任务 | 预估工时 | 验收标准 |
| :--- | :--- | :--- | :--- |
| **T-01** | 安装 Konva.js + react-konva + Zustand + nanoid 依赖 | 0.5h | 依赖安装成功，项目可编译 |
| **T-02** | 定义完整的 TypeScript 类型（`types.ts`） | 2h | 所有类型定义完成，无 `any` |
| **T-03** | 实现 designStore（所有 action） | 4h | 单元测试覆盖所有 action |
| **T-04** | 实现 canvasStore 和 historyStore | 2h | 撤销/重做功能可用 |
| **T-05** | 实现 storageAdapter（localStorage + JSON 导入导出） | 2h | 保存/加载/导出/导入均可用 |
| **T-06** | 实现 KonvaCanvas 容器 + GridLayer | 3h | 画布可渲染网格，支持缩放/平移 |
| **T-07** | 实现 FrameRenderer + MullionRenderer | 4h | 外框和中梃可正确渲染 |
| **T-08** | 实现 GlassRenderer | 2h | 玻璃区域可正确渲染 |
| **T-09** | 实现 OpeningRenderer（递归渲染） | 4h | 递归树可正确渲染为嵌套图形 |
| **T-10** | 实现预设模板（8 个） | 3h | 所有模板可一键创建 |

**Sprint 1 交付物：** 静态渲染可用——可以通过模板创建窗户并在画布上正确显示，支持缩放/平移。

### 9.2 Sprint 2（第 3-4 周）：核心交互

| 任务 ID | 任务 | 预估工时 | 验收标准 |
| :--- | :--- | :--- | :--- |
| **T-11** | 实现绘制外框交互（draw_frame 工具） | 6h | 拖拽绘制矩形，释放创建窗户 |
| **T-12** | 实现添加中梃交互（垂直 + 水平） | 6h | 悬停预览 + 点击添加 + 自动分割 |
| **T-13** | 实现 SashRenderer（15 种扇类型图例） | 6h | 所有扇类型的 2D 图例正确渲染 |
| **T-14** | 实现添加扇交互 | 4h | 选择扇类型 + 点击放置 |
| **T-15** | 实现拖拽移动中梃 | 6h | 拖拽中梃，两侧 Opening 实时变化 |
| **T-16** | 实现删除功能（中梃合并 + 扇移除） | 4h | Delete 键删除，中梃删除时子 Opening 合并 |
| **T-17** | 实现边界校验（validators.ts） | 4h | 所有校验规则生效 |
| **T-18** | 实现 DimensionRenderer（尺寸标注） | 4h | 外框和分格尺寸标注正确显示 |

**Sprint 2 交付物：** 核心交互可用——可以拖拽绘制、添加中梃/扇、拖拽调整、删除，所有操作有边界校验。

### 9.3 Sprint 3（第 5-6 周）：属性面板与完善

| 任务 ID | 任务 | 预估工时 | 验收标准 |
| :--- | :--- | :--- | :--- |
| **T-19** | 实现 Toolbox（左侧工具箱） | 4h | 工具切换、扇类型选择、模板库 |
| **T-20** | 实现 PropertyPanel（右侧属性面板） | 8h | 尺寸编辑（含数学表达式）、颜色选择、扇类型切换、型材系列切换 |
| **T-21** | 实现 TopToolbar | 3h | 模板选择、2D/3D 切换、缩放控件、撤销/重做按钮、导出按钮 |
| **T-22** | 实现修改尺寸的递归缩放 | 4h | 修改宽高后内部结构按比例缩放 |
| **T-23** | 实现键盘快捷键（useKeyboardShortcuts） | 2h | 所有快捷键可用 |
| **T-24** | 实现自动保存（useAutoSave） | 1h | 30 秒自动保存 + 页面关闭前保存 |
| **T-25** | 实现选中高亮和控制点（SelectionOverlay） | 4h | 选中元素显示橙色边框和控制点 |
| **T-26** | 整体 UI 布局和响应式适配 | 4h | 桌面端和平板端布局正常 |
| **T-27** | 集成测试和 Bug 修复 | 8h | 所有 P0 功能通过测试 |

**Sprint 3 交付物：** 完整可用的 2D 画图设计器——所有 P0 功能就绪，可以独立使用。

### 9.4 总工时估算

| Sprint | 工时 | 周期 |
| :--- | :--- | :--- |
| Sprint 1 | 26.5h | 2 周 |
| Sprint 2 | 40h | 2 周 |
| Sprint 3 | 38h | 2 周 |
| **合计** | **104.5h** | **6 周** |

---

## 10. 验收标准

### 10.1 功能验收

| ID | 验收项 | 通过标准 |
| :--- | :--- | :--- |
| **AC-01** | 绘制外框 | 拖拽绘制矩形窗户，宽高标注实时显示 |
| **AC-02** | 添加垂直中梃 | 点击在 Opening 内添加垂直中梃，自动分割为左右两个子 Opening |
| **AC-03** | 添加水平中梃 | 同上，分割为上下两个子 Opening |
| **AC-04** | 添加扇 | 选择扇类型后点击 Opening 放置，2D 图例正确显示 |
| **AC-05** | 拖拽中梃 | 拖拽中梃移动，两侧 Opening 实时调整 |
| **AC-06** | 删除中梃 | 删除中梃后两侧 Opening 合并 |
| **AC-07** | 删除扇 | 删除扇后 Opening 恢复为默认玻璃 |
| **AC-08** | 修改尺寸 | 属性面板修改宽高，内部结构按比例缩放 |
| **AC-09** | 撤销/重做 | Ctrl+Z/Ctrl+Shift+Z 正常工作，至少支持 50 步 |
| **AC-10** | 缩放/平移 | Ctrl+滚轮缩放，中键/空格拖拽平移 |
| **AC-11** | 预设模板 | 8 个模板均可一键创建 |
| **AC-12** | JSON 导入导出 | 导出的 JSON 可以重新导入并完全还原设计 |
| **AC-13** | localStorage 持久化 | 刷新页面后设计数据不丢失 |
| **AC-14** | 边界校验 | 所有校验规则生效，违规操作被阻止 |
| **AC-15** | 15 种扇类型图例 | 所有扇类型的 2D 图例正确渲染 |

### 10.2 性能验收

| 场景 | 指标 | 目标值 |
| :--- | :--- | :--- |
| 画布加载（50 组件） | FCP | < 1.5s |
| 拖拽交互（200 组件） | FPS | > 45 |
| 缩放/平移 | FPS | > 50 |
| 撤销/重做响应 | 延迟 | < 100ms |

### 10.3 代码质量要求

- TypeScript 严格模式，**零 `any`**
- 所有导出函数必须有 JSDoc 注释
- 组件拆分粒度合理，单文件不超过 300 行
- Zustand Store 的 action 必须是纯函数（不产生副作用）
- 使用 `nanoid()` 生成所有 ID，禁止使用自增数字

---

## 11. 开发注意事项

### 11.1 Konva.js 关键 API

```typescript
import { Stage, Layer, Group, Rect, Line, Text, Circle, Arrow } from 'react-konva';

// Stage 对应整个画布
<Stage width={containerWidth} height={containerHeight} scaleX={zoom} scaleY={zoom} x={panX} y={panY}>
  <Layer listening={false}>{/* 网格 */}</Layer>
  <Layer>{/* 外框和中梃 */}</Layer>
  {/* ... */}
</Stage>

// Group 对应一个 WindowUnit 或 Opening
<Group x={window.posX} y={window.posY}>
  {/* 子元素自动继承父 Group 的坐标变换 */}
</Group>

// 事件处理
<Rect
  onMouseEnter={() => { /* 高亮 */ }}
  onMouseLeave={() => { /* 取消高亮 */ }}
  onClick={() => { /* 选中 */ }}
  onDragMove={(e) => { /* 拖拽 */ }}
  draggable={isDraggable}
/>
```

### 11.2 递归渲染模式

```tsx
// OpeningRenderer.tsx — 递归渲染 Opening 树
function OpeningRenderer({ opening, windowId }: Props) {
  // 如果有子 Opening，递归渲染
  if (opening.children.length > 0) {
    return (
      <Group>
        {/* 渲染中梃 */}
        {opening.mullions.map(m => <MullionRenderer key={m.id} mullion={m} />)}
        {/* 递归渲染子 Opening */}
        {opening.children.map(child => (
          <OpeningRenderer key={child.id} opening={child} windowId={windowId} />
        ))}
      </Group>
    );
  }

  // 叶子节点：渲染玻璃或扇
  return (
    <Group>
      <GlassRenderer opening={opening} />
      {opening.sash && <SashRenderer sash={opening.sash} rect={opening.rect} />}
    </Group>
  );
}
```

### 11.3 不要做的事情

1. **不要在渲染层计算尺寸** — 所有尺寸必须从数据模型中读取，渲染层只负责"画"
2. **不要硬编码型材宽度** — 必须从 ProfileSeries 获取
3. **不要直接操作 Konva 节点** — 通过修改 Zustand Store 驱动渲染
4. **不要使用 `useState` 管理设计数据** — 统一使用 Zustand
5. **不要在 Store action 中调用 API** — 持久化通过 storageAdapter 在组件层调用
6. **不要忘记 push history** — 每次数据变更前必须保存当前状态到 historyStore

---

## 12. 参考资料

[1] Konva.js 官方文档. https://konvajs.org/docs/

[2] Zustand 官方文档. https://docs.pmnd.rs/zustand/getting-started/introduction

[3] react-konva 官方文档. https://github.com/konvajs/react-konva

[4] Konva.js Window Frame Designer 示例. https://konvajs.org/docs/sandbox/Window_Frame_Designer.html

[5] 画门窗设计器 — 画布引擎技术选型报告. `docs/CANVAS-ENGINE-SELECTION.md`

[6] 画门窗设计器 — 画图模块可执行规格书 V2.0. `docs/画图模块_可执行规格书.md`

[7] 画门窗设计器 — PRD V5.5 Complete. `docs/PRD_V5_Complete.md`

[8] 画门窗设计器 — 技术架构文档 V2.0. `ARCHITECTURE.md`
