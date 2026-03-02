# 画门窗设计器 — 前端开发交接文档

> **版本:** 1.0  
> **日期:** 2026-03-02  
> **作者:** 技术负责人  
> **适用对象:** 前端开发工程师

---

## 1. 项目概述

画门窗设计器是一款面向门窗行业的在线 CAD 工具，核心功能是让用户在浏览器中完成门窗的设计、算料和报价。本文档帮助你快速上手项目，了解代码结构、开发规范和任务安排。

### 1.1 技术栈

| 层级 | 技术 | 说明 |
| :--- | :--- | :--- |
| 框架 | React 19 + TypeScript 5.6 | 函数组件 + Hooks |
| 构建 | Vite 6 | 开发服务器 + 生产构建 |
| 样式 | Tailwind CSS 4 + shadcn/ui | 原子化 CSS + 组件库 |
| 状态管理 | Zustand（待迁移） | 当前用 useEditorStore 自定义 Hook |
| 2D 渲染 | SVG（当前）→ **Konva.js**（目标） | 画布引擎迁移是核心任务 |
| 3D 渲染 | Three.js | 3D 预览和实景融合 |
| 路由 | Wouter | 轻量级客户端路由 |
| 包管理 | pnpm workspace | Monorepo 管理 |

### 1.2 Monorepo 结构

```
windows/                          ← 仓库根目录
├── packages/
│   ├── client/                   ← 前端应用 (你的主战场)
│   │   ├── src/
│   │   │   ├── pages/            ← 页面组件
│   │   │   │   ├── Editor.tsx    ← ★ 核心编辑器页面 (969行)
│   │   │   │   ├── Home.tsx      ← 首页
│   │   │   │   └── NotFound.tsx
│   │   │   ├── components/       ← 业务组件
│   │   │   │   ├── CanvasRenderer.tsx  ← ★ 2D画布渲染 (待迁移到Konva.js)
│   │   │   │   ├── ThreePreview.tsx    ← ★ 3D预览
│   │   │   │   ├── ScenePreview.tsx    ← 实景融合预览
│   │   │   │   ├── Toolbar.tsx         ← 左侧工具箱
│   │   │   │   ├── TopBar.tsx          ← 顶部工具栏
│   │   │   │   ├── PropertiesPanel.tsx ← 右侧属性面板
│   │   │   │   ├── StatusBar.tsx       ← 底部状态栏
│   │   │   │   ├── MobileToolbar.tsx   ← 移动端工具栏
│   │   │   │   ├── MobilePropertiesDrawer.tsx ← 移动端属性抽屉
│   │   │   │   ├── QuoteDialog.tsx     ← 报价弹窗
│   │   │   │   └── ui/                ← shadcn/ui 组件 (勿修改)
│   │   │   ├── hooks/
│   │   │   │   ├── useEditorStore.ts   ← ★ 核心状态管理
│   │   │   │   ├── useComposition.ts
│   │   │   │   ├── useTouch.ts
│   │   │   │   └── usePersistFn.ts
│   │   │   ├── lib/
│   │   │   │   ├── types.ts            ← 类型定义 (从 @windoor/shared 重导出)
│   │   │   │   ├── window-factory.ts   ← 窗型工厂函数
│   │   │   │   ├── window3d.ts         ← ★ Three.js 3D建模工具
│   │   │   │   └── utils.ts
│   │   │   ├── contexts/
│   │   │   │   └── ThemeContext.tsx
│   │   │   ├── App.tsx                 ← 路由配置
│   │   │   ├── main.tsx                ← 入口
│   │   │   └── index.css               ← 全局样式 + 设计Token
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── shared/                   ← 前后端共享类型和常量
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── design.ts     ← ★ 核心数据模型 (Opening/Frame/WindowUnit)
│   │   │   │   ├── editor.ts     ← 编辑器状态类型
│   │   │   │   ├── material.ts   ← 型材/五金/玻璃类型
│   │   │   │   ├── order.ts      ← 订单/报价类型
│   │   │   │   ├── user.ts       ← 用户/租户类型
│   │   │   │   ├── api.ts        ← API请求/响应类型
│   │   │   │   └── index.ts
│   │   │   ├── constants/
│   │   │   │   ├── profiles.ts   ← 预置型材系列数据
│   │   │   │   ├── constraints.ts ← 边界约束常量
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── server/                   ← 后端服务 (骨架, 后端工程师负责)
│       ├── src/
│       │   ├── routes/
│       │   │   ├── auth.ts
│       │   │   └── design.ts
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
│
├── docs/                         ← 产品和技术文档
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json                  ← 根 package.json (workspace scripts)
```

---

## 2. 环境搭建

### 2.1 前置要求

| 工具 | 版本要求 | 安装方式 |
| :--- | :--- | :--- |
| Node.js | >= 22.x | `nvm install 22` |
| pnpm | >= 10.x | `npm install -g pnpm` |
| Git | >= 2.x | 系统自带 |

### 2.2 首次启动

```bash
# 1. 克隆仓库
git clone git@github.com:liudada118/windows.git
cd windows

# 2. 安装所有依赖 (workspace会自动处理三个包的依赖)
pnpm install

# 3. 启动前端开发服务器
pnpm dev:client

# 4. 浏览器打开
# http://localhost:3000/windows/
```

### 2.3 常用命令

```bash
# 开发
pnpm dev:client          # 启动前端开发服务器
pnpm dev:server          # 启动后端开发服务器 (后端工程师用)

# 类型检查
pnpm typecheck:client    # 前端类型检查
pnpm typecheck:all       # 全部类型检查

# 构建
pnpm build:client        # 前端生产构建 → packages/client/dist/

# 代码格式化
pnpm format              # Prettier 格式化
```

### 2.4 注意事项

1. **base 路径:** Vite 配置了 `base: '/windows/'`，所有路由和资源路径都在 `/windows/` 子路径下。本地开发时访问 `http://localhost:3000/windows/`。
2. **共享包引用:** 在前端代码中通过 `@windoor/shared` 引用共享类型，通过 `@/` 引用 `packages/client/src/` 下的文件。
3. **不要修改 `ui/` 目录:** `packages/client/src/components/ui/` 是 shadcn/ui 自动生成的组件，不要手动修改。

---

## 3. 核心数据模型

这是整个项目最重要的部分，所有功能都围绕这个数据模型展开。类型定义在 `packages/shared/src/types/design.ts`。

### 3.1 Opening 递归树 — 核心中的核心

```
WindowUnit (一个窗户)
├── frame: Frame (外框)
│   ├── width, height (外框尺寸 mm)
│   └── profileSeriesId (型材系列)
└── rootOpening: Opening (根分格)
    ├── direction: 'none' | 'vertical' | 'horizontal'
    ├── children: Opening[] (子分格, 递归)
    ├── mullions: Mullion[] (中梃列表)
    └── sash?: Sash (叶子节点才有扇)
```

**关键规则:**
- `children` 和 `sash` 互斥 — 有子分格的节点不能有扇，有扇的节点不能有子分格
- 叶子节点（无 children）才能设置扇类型和玻璃
- 中梃（mullion）的 `position` 是相对于父分格的百分比（0-1）
- 所有尺寸单位为 **毫米 (mm)**

### 3.2 数据流

```
用户操作 → useEditorStore (状态管理) → 数据模型变更 → 渲染层自动更新
                                                    ├── CanvasRenderer (2D)
                                                    └── ThreePreview (3D)
```

**数据驱动渲染原则:** 渲染层只读取数据模型并绘制，绝不在渲染层做业务计算。改变画面的唯一方式是改变数据模型。

### 3.3 型材系列

预置 5 种型材系列（60/65/70/80/85），定义在 `packages/shared/src/constants/profiles.ts`。每种系列包含框宽、扇宽、中梃宽等参数，直接影响渲染和算料。

---

## 4. 关键文件说明

### 4.1 Editor.tsx — 主编辑器页面

这是最核心的文件（969 行），整合了所有组件：

```
Editor.tsx
├── 顶部: TopBar (文件操作、模板选择、视图切换)
├── 左侧: Toolbar (绘制工具)
├── 中央: CanvasRenderer (2D) / ThreePreview (3D) / ScenePreview (实景)
├── 右侧: PropertiesPanel (属性编辑)
└── 底部: StatusBar (坐标、缩放、工具状态)
```

### 4.2 useEditorStore.ts — 状态管理

基于自定义 Hook 的状态管理，包含：
- `windows: WindowUnit[]` — 所有窗户列表
- `selectedWindowId` — 当前选中的窗户
- `selectedOpeningId` — 当前选中的分格
- `activeTool` — 当前激活的工具
- `zoom / panX / panY` — 画布视口状态
- 各种 action: `addWindow`, `deleteWindow`, `addMullion`, `setSash`, `updateDimensions` 等

### 4.3 CanvasRenderer.tsx — 2D 画布渲染

当前基于 SVG 实现，**需要迁移到 Konva.js**。核心职责：
- 递归渲染 Opening 树为可视化图形
- 处理鼠标交互（选中、绘制外框、添加中梃、拖拽）
- 显示尺寸标注、扇类型图标、选中高亮
- 支持缩放和平移

### 4.4 window-factory.ts — 窗型工厂

提供预设窗型模板的创建函数，如两等分、三等分、田字格、日字格等。

### 4.5 window3d.ts — 3D 建模工具

使用 Three.js 创建门窗的 3D 模型，包含框架、玻璃、扇等几何体的生成逻辑。

---

## 5. 开发规范

### 5.1 代码规范

| 规则 | 说明 |
| :--- | :--- |
| 组件命名 | PascalCase，文件名与组件名一致 |
| Hook 命名 | `use` 前缀，camelCase |
| 类型命名 | PascalCase，接口用 `interface`，联合类型用 `type` |
| 导入顺序 | React → 第三方 → @windoor/shared → @/ 本地 → 相对路径 |
| 样式方式 | Tailwind CSS 优先，复杂动画用 CSS 模块 |
| 注释语言 | 中文注释，英文变量名 |

### 5.2 Git 工作流

```
main ← 稳定版本
  └── develop ← 开发主线
       ├── feat/canvas-konva ← 功能分支
       ├── feat/properties-panel
       └── fix/xxx
```

**提交规范 (Conventional Commits):**

```
feat(canvas): 实现Konva.js基础画布渲染
fix(toolbar): 修复工具切换状态不同步
refactor(types): 统一Opening数据模型
```

### 5.3 分支命名

```
feat/模块名-功能描述    # 新功能
fix/模块名-问题描述     # 修复
refactor/模块名-描述    # 重构
```

### 5.4 PR 检查清单

- [ ] `pnpm typecheck:client` 通过
- [ ] `pnpm build:client` 通过
- [ ] 新增/修改的组件有中文注释说明用途
- [ ] 共享类型变更同步更新了 `packages/shared/`
- [ ] 无 `any` 类型（确实需要时加 `// eslint-disable-next-line` 注释说明原因）

---

## 6. 任务清单

### 6.1 Sprint 1（第 1-2 周）: Konva.js 画布迁移

这是最高优先级的任务，将 CanvasRenderer.tsx 从 SVG 迁移到 Konva.js。

| 编号 | 任务 | 工时 | 说明 |
| :--- | :--- | :--- | :--- |
| S1-01 | 安装 konva + react-konva | 0.5h | `pnpm --filter @windoor/client add konva react-konva` |
| S1-02 | 创建 KonvaCanvas.tsx 基础骨架 | 4h | Stage → Layer 结构，接入 useEditorStore |
| S1-03 | 实现 OpeningRenderer 递归组件 | 8h | 递归渲染 Opening 树，绘制框架线条和玻璃填充 |
| S1-04 | 实现中梃渲染和拖拽 | 6h | 中梃线条 + 拖拽交互 + 位置约束 |
| S1-05 | 实现扇类型图标渲染 | 4h | 15 种扇类型的 2D 图例 |
| S1-06 | 实现尺寸标注 | 4h | 外框尺寸 + 分格尺寸标注线 |
| S1-07 | 实现选中高亮和交互反馈 | 3h | 点击选中、hover 效果 |
| S1-08 | 实现绘制外框工具 | 6h | 鼠标拖拽绘制矩形外框 |
| S1-09 | 实现画布缩放和平移 | 3h | 滚轮缩放、中键/空格拖拽平移 |
| S1-10 | 替换 Editor.tsx 中的 CanvasRenderer | 2h | 切换为 KonvaCanvas，保留旧文件作备份 |

**总工时: 40.5h**

**关键参考:** Konva.js 官方 [Window Frame Designer 示例](https://konvajs.org/docs/sandbox/Window_Frame_Designer.html)，与我们的需求高度吻合。

### 6.2 Sprint 2（第 3-4 周）: 交互完善

| 编号 | 任务 | 工时 | 说明 |
| :--- | :--- | :--- | :--- |
| S2-01 | 添加中梃工具（垂直/水平） | 6h | 点击分格添加中梃，自动分割子分格 |
| S2-02 | 添加扇工具 | 4h | 点击叶子分格设置扇类型 |
| S2-03 | 删除功能 | 3h | 删除中梃（合并分格）、删除扇、删除窗户 |
| S2-04 | 尺寸修改交互 | 6h | 双击尺寸标注弹出输入框，修改后自动重新分配 |
| S2-05 | 撤销/重做 | 4h | 基于快照的历史栈，Ctrl+Z / Ctrl+Shift+Z |
| S2-06 | 键盘快捷键 | 2h | Delete 删除、Escape 取消、1-7 切换工具 |
| S2-07 | 右键菜单 | 4h | 分格右键：添加中梃/设置扇/删除 |
| S2-08 | 属性面板联动优化 | 4h | 选中分格时右侧面板实时显示/编辑属性 |

**总工时: 33h**

### 6.3 Sprint 3（第 5-6 周）: 产品化

| 编号 | 任务 | 工时 | 说明 |
| :--- | :--- | :--- | :--- |
| S3-01 | localStorage 自动保存 | 3h | 通过 storageAdapter 抽象，后端就绪后只换适配器 |
| S3-02 | 窗型模板库 | 4h | 8+ 种预设模板，点击创建 |
| S3-03 | 颜色/覆膜系统 | 4h | 框架颜色、玻璃颜色、覆膜选择 |
| S3-04 | 导出为图片 | 3h | 导出 2D 图纸为 PNG/SVG |
| S3-05 | 移动端适配优化 | 4h | 触摸手势、响应式布局 |
| S3-06 | 边界条件校验 | 4h | 最小/最大尺寸、扇尺寸限制、实时提示 |
| S3-07 | 3D 预览优化 | 3h | 颜色同步、开启动画、阴影效果 |
| S3-08 | 集成测试 | 4h | 核心流程端到端测试 |

**总工时: 29h**

---

## 7. Konva.js 迁移指南

### 7.1 为什么选 Konva.js

详细的技术选型分析见 `docs/CANVAS-ENGINE-SELECTION.md`，核心理由：

1. **场景图架构与 Opening 树天然对齐** — Stage → Layer → Group → Shape 映射到 窗户 → 分区 → Opening → 图形
2. **官方有门窗设计器示例** — 可直接参考
3. **行业已验证** — AVADA MEDIA 的门窗配置器使用 Konva.js
4. **react-konva 声明式渲染** — 与 React 数据驱动理念一致

### 7.2 Konva.js 分层策略

```
Stage (画布容器)
├── Layer: background    ← 网格背景、标尺
├── Layer: windows       ← 门窗图形 (主渲染层)
│   └── Group: window-{id}
│       ├── Rect: frame  ← 外框
│       └── Group: opening-{id} (递归)
│           ├── Rect: glass-fill  ← 玻璃填充
│           ├── Line: mullion     ← 中梃
│           └── Group: sash-icon  ← 扇类型图标
├── Layer: dimensions    ← 尺寸标注线和文字
├── Layer: interaction   ← 选中高亮、hover效果、拖拽辅助线
└── Layer: drawing       ← 绘制中的临时图形
```

### 7.3 递归渲染模式

```tsx
// 核心递归组件 — 这是最重要的组件
function OpeningRenderer({ opening, bounds }: { opening: Opening; bounds: Rect }) {
  // 叶子节点: 渲染玻璃 + 扇图标
  if (!opening.children || opening.children.length === 0) {
    return (
      <Group>
        <Rect {...bounds} fill="rgba(173,216,230,0.3)" stroke="#666" />
        {opening.sash && <SashIcon type={opening.sash.type} bounds={bounds} />}
      </Group>
    );
  }

  // 分支节点: 按中梃位置切分子区域，递归渲染
  const childBounds = calculateChildBounds(opening, bounds);
  return (
    <Group>
      {opening.children.map((child, i) => (
        <OpeningRenderer key={child.id} opening={child} bounds={childBounds[i]} />
      ))}
      {opening.mullions.map(m => (
        <MullionLine key={m.id} mullion={m} parentBounds={bounds} />
      ))}
    </Group>
  );
}
```

### 7.4 迁移步骤

1. **新建 `KonvaCanvas.tsx`**，不要修改现有 `CanvasRenderer.tsx`
2. 先实现静态渲染（只读取数据画图，不处理交互）
3. 逐步添加交互（选中 → 绘制 → 拖拽 → 删除）
4. 在 Editor.tsx 中用 `KonvaCanvas` 替换 `CanvasRenderer`
5. 确认功能完整后删除旧的 `CanvasRenderer.tsx`

---

## 8. 持久化适配器

为了让前端在没有后端的情况下完全可用，同时为后续 API 对接做好准备：

```typescript
// packages/client/src/lib/storage-adapter.ts

interface StorageAdapter {
  save(data: DesignData): Promise<void>;
  load(): Promise<DesignData | null>;
  list(): Promise<DesignListItem[]>;
  delete(id: string): Promise<void>;
}

// Phase 1: localStorage 实现 (你现在用这个)
class LocalStorageAdapter implements StorageAdapter {
  private key = 'windoor-designs';
  async save(data: DesignData) {
    localStorage.setItem(this.key, JSON.stringify(data));
  }
  async load() {
    const raw = localStorage.getItem(this.key);
    return raw ? JSON.parse(raw) : null;
  }
  // ...
}

// Phase 2: API 实现 (后端就绪后切换)
class ApiStorageAdapter implements StorageAdapter {
  async save(data: DesignData) {
    await fetch('/api/designs', { method: 'PUT', body: JSON.stringify(data) });
  }
  // ...
}

// 导出当前使用的适配器
export const storage: StorageAdapter = new LocalStorageAdapter();
```

---

## 9. 设计风格规范

### 9.1 工业蓝图美学

项目采用"工业蓝图"设计风格，深色背景 + 精确线条 + 工程感配色。

| 元素 | 颜色 | 用途 |
| :--- | :--- | :--- |
| 背景 | `oklch(0.14 0.025 260)` | 主画布背景 |
| 边框 | `oklch(0.25 0.035 260)` | 面板边框 |
| 强调色 | `amber-400` | 工具激活、重要操作 |
| 文字主色 | `slate-300` | 正文文字 |
| 文字辅色 | `slate-500` | 标签、辅助信息 |
| 玻璃填充 | `rgba(173, 216, 230, 0.3)` | 2D 玻璃区域 |
| 选中高亮 | `rgba(59, 130, 246, 0.3)` | 选中的分格 |

### 9.2 字体

```css
font-family: 'JetBrains Mono', 'Noto Sans SC', monospace;
```

已在 `index.html` 中通过 Google Fonts CDN 引入。

---

## 10. 常见问题

### Q1: 启动报错 "Cannot find module '@windoor/shared'"

确保在仓库根目录执行 `pnpm install`，workspace 会自动建立包之间的软链接。

### Q2: 类型定义在哪里修改？

共享类型（前后端都用的）修改 `packages/shared/src/types/`，前端专有类型修改 `packages/client/src/lib/types.ts`。修改共享类型后前后端都会自动获取更新。

### Q3: 为什么 base 路径是 '/windows/'？

因为部署在 `http://8.140.238.44/windows/` 子路径下。本地开发时也需要通过 `http://localhost:3000/windows/` 访问。

### Q4: shadcn/ui 组件怎么用？

从 `@/components/ui/*` 导入，例如 `import { Button } from '@/components/ui/button'`。已有 50+ 个预装组件，优先使用而非自己造轮子。

### Q5: 我需要安装新的 npm 包怎么办？

```bash
# 安装到前端包
pnpm --filter @windoor/client add 包名

# 安装到共享包
pnpm --filter @windoor/shared add 包名

# 安装到根目录 (开发工具)
pnpm add -Dw 包名
```

---

## 11. 相关文档索引

| 文档 | 路径 | 说明 |
| :--- | :--- | :--- |
| 产品需求文档 | `docs/PRD_V5_Complete.md` | 完整的产品规格 |
| 技术架构文档 | `ARCHITECTURE.md` | 系统架构和技术决策 |
| 画布引擎选型 | `docs/CANVAS-ENGINE-SELECTION.md` | Konva.js 选型分析 |
| 画图模块规格书 | `docs/画图模块_可执行规格书.md` | 画图模块详细规格 |
| 前端任务书 | `docs/FRONTEND-BINDOOR-TASK.md` | 详细的开发任务拆分 |
| 团队协作规范 | `docs/TEAM-SPEC.md` | 前后端接口和协作规范 |
| Monorepo 指南 | `docs/MONOREPO-GUIDE.md` | 仓库结构和工作流 |

---

## 12. 联系方式

遇到以下问题时找技术负责人确认：
- 数据模型变更（影响前后端契约）
- 新增共享类型
- 架构层面的技术决策
- 与后端工程师的接口对齐

**祝开发顺利！**
