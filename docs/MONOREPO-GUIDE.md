# Monorepo 目录结构与 Git 工作流规范

> **文档版本：** V1.0 | **日期：** 2026-03-02 | **作者：** 技术负责人（Manus AI）

---

## 1. 方案选型：为什么选 Monorepo

在门窗设计器这个项目中，前后端放在同一个仓库（Monorepo）是最合理的选择。原因有三：

第一，**前后端共享大量类型定义**。门窗设计器的核心数据模型（`Opening`、`WindowUnit`、`ProfileSeries`、`CalcResult` 等）在前端渲染和后端存储中完全一致。如果分仓库，这些类型要么重复维护（容易不一致），要么发布为独立 npm 包（增加发布流程复杂度）。Monorepo 下只需在 `packages/shared/` 中维护一份，前后端直接引用 [1]。

第二，**团队规模小（3-5 人）**。小团队分仓库会增加不必要的协调成本——改一个接口要同时在两个仓库提 PR、同步版本号、处理兼容性。Monorepo 下一个 PR 可以同时修改前后端代码，Code Review 时能看到完整的变更上下文 [2]。

第三，**集成测试更简单**。Monorepo 下可以用一条命令启动前后端联调，CI/CD 也只需要一套流水线。

### 1.1 工具选择：pnpm workspace

项目已经使用 pnpm 作为包管理器，pnpm workspace 是 Monorepo 管理的天然选择——零额外依赖、配置简单、磁盘效率高（硬链接去重）[3]。不需要引入 Turborepo 或 Nx 等重型工具，在项目规模扩大到 10+ 个包之前 pnpm workspace 完全够用。

---

## 2. 目标目录结构

```
windoor-designer/                    # 仓库根目录
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                   # CI 流水线（lint + typecheck + test）
│   │   └── deploy.yml               # 部署流水线
│   └── PULL_REQUEST_TEMPLATE.md     # PR 模板
├── docs/                            # 产品文档（不属于任何包）
│   ├── README.md                    # 文档索引
│   ├── PRD_V5_Complete.md           # 产品需求文档
│   ├── ARCHITECTURE.md → ../ARCHITECTURE.md  # 软链接
│   ├── CANVAS-ENGINE-SELECTION.md
│   ├── FRONTEND-BINDOOR-TASK.md
│   ├── TEAM-SPEC.md
│   ├── DEVELOPMENT-PLAN.md
│   ├── archive/                     # 归档文档
│   └── images/                      # 文档用图
├── packages/
│   ├── shared/                      # 共享包：类型 + 常量 + 工具函数
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts             # 统一导出
│   │       ├── types/
│   │       │   ├── design.ts        # 设计数据模型（Opening, WindowUnit...）
│   │       │   ├── material.ts      # 型材/五金/玻璃类型
│   │       │   ├── order.ts         # 订单/报价类型
│   │       │   ├── user.ts          # 用户/租户类型
│   │       │   └── api.ts           # API 请求/响应类型
│   │       ├── constants/
│   │       │   ├── profiles.ts      # 预置型材系列数据
│   │       │   ├── colors.ts        # 颜色预设
│   │       │   ├── glass.ts         # 玻璃规格预设
│   │       │   └── errors.ts        # 错误码定义
│   │       └── utils/
│   │           ├── validators.ts    # 边界校验函数
│   │           ├── geometry.ts      # 几何计算（面积、周长等）
│   │           └── id.ts            # ID 生成（nanoid 封装）
│   ├── client/                      # 前端包：React + Konva.js
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   ├── public/
│   │   │   └── favicon.ico
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── index.css
│   │       ├── pages/
│   │       │   └── DesignerPage.tsx
│   │       ├── components/
│   │       │   ├── canvas/          # Konva.js 画布组件
│   │       │   ├── panels/          # 工具箱/属性面板/工具栏
│   │       │   └── ui/              # shadcn/ui 组件
│   │       ├── stores/              # Zustand Stores
│   │       ├── hooks/
│   │       └── lib/
│   │           ├── storageAdapter.ts
│   │           └── templates.ts
│   └── server/                      # 后端包：Node.js + Express/Fastify
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts             # 入口
│           ├── app.ts               # Express/Fastify 实例
│           ├── routes/
│           │   ├── auth.ts          # 认证路由
│           │   ├── designs.ts       # 设计数据 CRUD
│           │   ├── profiles.ts      # 型材系列管理
│           │   ├── orders.ts        # 订单管理
│           │   └── calc.ts          # 算料结果存储
│           ├── services/
│           │   ├── designService.ts
│           │   ├── calcService.ts
│           │   └── orderService.ts
│           ├── middleware/
│           │   ├── auth.ts          # JWT 认证中间件
│           │   ├── tenantIsolation.ts # 多租户隔离
│           │   └── errorHandler.ts
│           ├── db/
│           │   ├── schema.ts        # 数据库 Schema（Drizzle ORM）
│           │   └── migrations/      # 数据库迁移文件
│           └── lib/
│               └── config.ts        # 环境变量配置
├── scripts/                         # 工程脚本
│   ├── setup.sh                     # 一键初始化开发环境
│   ├── seed-profiles.ts             # 导入预置型材数据
│   └── validate-prd.ts              # PRD 结构完整性校验
├── .gitignore
├── .prettierrc
├── .eslintrc.cjs
├── pnpm-workspace.yaml              # pnpm workspace 配置
├── package.json                     # 根 package.json（scripts + devDeps）
├── tsconfig.base.json               # 基础 TypeScript 配置
├── ARCHITECTURE.md                  # 技术架构文档
├── CHANGELOG.md                     # 变更日志
├── PRD_README.md                    # PRD 文档入口
└── README.md                        # 项目 README
```

---

## 3. 关键配置文件

### 3.1 pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
```

这一行告诉 pnpm 将 `packages/` 下的每个子目录视为一个独立的包。pnpm 会自动处理包之间的依赖关系。

### 3.2 根 package.json

```json
{
  "name": "windoor-designer",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm --filter client dev",
    "dev:server": "pnpm --filter server dev",
    "dev:all": "pnpm --parallel --filter client --filter server dev",
    "build": "pnpm --filter shared build && pnpm --parallel --filter client --filter server build",
    "build:client": "pnpm --filter shared build && pnpm --filter client build",
    "build:server": "pnpm --filter shared build && pnpm --filter server build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "clean": "pnpm -r clean",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "prettier": "^3.6.2",
    "typescript": "5.6.3"
  },
  "packageManager": "pnpm@10.4.1"
}
```

**关键设计：** 所有开发命令都通过根 `package.json` 的 scripts 入口执行，开发者不需要 `cd` 到子目录。`pnpm --filter` 精确控制执行范围，`--parallel` 并行启动前后端。

### 3.3 packages/shared/package.json

```json
{
  "name": "@windoor/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc --build",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "nanoid": "^5.1.5",
    "zod": "^4.1.12"
  }
}
```

### 3.4 packages/client/package.json

```json
{
  "name": "@windoor/client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "vite build",
    "preview": "vite preview --host",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@windoor/shared": "workspace:*",
    "konva": "^9.3.0",
    "react": "^19.2.1",
    "react-dom": "^19.2.1",
    "react-konva": "^18.2.10",
    "zustand": "^5.0.0",
    "nanoid": "^5.1.5",
    "wouter": "^3.3.5",
    "sonner": "^2.0.7",
    "lucide-react": "^0.453.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.3.1",
    "class-variance-authority": "^0.7.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.0.4",
    "@types/react": "^19.2.1",
    "@types/react-dom": "^19.2.1",
    "tailwindcss": "^4.1.14",
    "@tailwindcss/vite": "^4.1.3",
    "typescript": "5.6.3",
    "vite": "^7.1.7"
  }
}
```

**关键：** `"@windoor/shared": "workspace:*"` 这行声明了对 shared 包的依赖。pnpm 会自动将其链接到本地的 `packages/shared`，无需发布到 npm。

### 3.5 packages/server/package.json

```json
{
  "name": "@windoor/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "esbuild src/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "clean": "rm -rf dist",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@windoor/shared": "workspace:*",
    "express": "^4.21.2",
    "drizzle-orm": "^0.36.0",
    "pg": "^8.13.0",
    "jsonwebtoken": "^9.0.0",
    "zod": "^4.1.12",
    "nanoid": "^5.1.5"
  },
  "devDependencies": {
    "@types/express": "4.17.21",
    "@types/node": "^24.7.0",
    "drizzle-kit": "^0.28.0",
    "esbuild": "^0.25.0",
    "tsx": "^4.19.1",
    "typescript": "5.6.3"
  }
}
```

### 3.6 tsconfig.base.json（根目录）

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

每个子包的 `tsconfig.json` 通过 `"extends": "../../tsconfig.base.json"` 继承基础配置，只需添加自己的 `paths` 和 `include`。

### 3.7 packages/client/vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@windoor/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

**关键：** `resolve.alias` 让前端可以直接 `import { WindowUnit } from '@windoor/shared'`。`server.proxy` 将 `/api` 请求代理到后端开发服务器，前后端联调时前端不需要处理跨域。

---

## 4. 共享类型的使用方式

### 4.1 在 shared 中定义

```typescript
// packages/shared/src/types/design.ts
export interface Opening {
  id: string;
  rect: Rect;
  mullions: Mullion[];
  children: Opening[];
  sash: Sash | null;
  glassPane: GlassPane | null;
}

// packages/shared/src/index.ts
export * from './types/design';
export * from './types/material';
export * from './types/order';
export * from './types/user';
export * from './types/api';
export * from './constants/profiles';
export * from './constants/errors';
export * from './utils/validators';
export * from './utils/geometry';
```

### 4.2 在前端中使用

```typescript
// packages/client/src/stores/designStore.ts
import { Opening, WindowUnit, ProfileSeries } from '@windoor/shared';
import { validateMullionPlacement } from '@windoor/shared';
```

### 4.3 在后端中使用

```typescript
// packages/server/src/routes/designs.ts
import { DesignData, WindowUnit } from '@windoor/shared';
import { validateDesign } from '@windoor/shared';

router.put('/api/v1/designs/:id', async (req, res) => {
  const design: DesignData = req.body;
  const result = validateDesign(design);
  if (!result.valid) {
    return res.status(400).json({ errors: result.errors });
  }
  // 存储到数据库...
});
```

**核心价值：** 前端保存设计数据时调用 `validateDesign()`，后端接收数据时也调用同一个 `validateDesign()`。校验逻辑只写一次，前后端行为完全一致。

---

## 5. 迁移步骤

从当前仓库结构迁移到 Monorepo 结构，分 4 步完成：

### 步骤 1：创建 workspace 骨架（30 分钟）

```bash
# 创建目录结构
mkdir -p packages/shared/src/{types,constants,utils}
mkdir -p packages/client
mkdir -p packages/server/src/{routes,services,middleware,db,lib}
mkdir -p scripts

# 创建 workspace 配置
echo 'packages:\n  - "packages/*"' > pnpm-workspace.yaml
```

### 步骤 2：迁移前端代码（1 小时）

```bash
# 将现有 client/ 目录移动到 packages/client/
mv client/* packages/client/
mv vite.config.ts packages/client/

# 将现有 server/ 和 shared/ 占位文件清理
rm -rf client/ server/ shared/
```

### 步骤 3：提取共享类型到 shared（2 小时）

```bash
# 将 types.ts 中的类型定义拆分到 shared 包
# 将 constants.ts 中的常量迁移到 shared 包
# 将 validators.ts 迁移到 shared 包
# 更新前端的 import 路径
```

### 步骤 4：安装依赖并验证（30 分钟）

```bash
# 在根目录执行
pnpm install

# 验证前端可以正常启动
pnpm dev

# 验证类型检查通过
pnpm typecheck
```

**预计总迁移时间：** 4 小时（1 人）

---

## 6. Git 分支策略

### 6.1 分支模型

采用简化的 **GitHub Flow** 模型，适合小团队快速迭代 [4]：

```
main ─────────────────────────────────────────────────── 生产分支（始终可部署）
  │
  ├── feat/canvas-konva-migration ──── PR ──── merge ── 功能分支
  │
  ├── feat/api-designs-crud ────────── PR ──── merge ── 功能分支
  │
  ├── fix/mullion-drag-boundary ────── PR ──── merge ── 修复分支
  │
  └── chore/ci-setup ───────────────── PR ──── merge ── 工程分支
```

### 6.2 分支命名规范

| 前缀 | 用途 | 示例 |
| :--- | :--- | :--- |
| `feat/` | 新功能 | `feat/canvas-konva-migration` |
| `fix/` | Bug 修复 | `fix/mullion-drag-boundary` |
| `chore/` | 工程/配置/文档 | `chore/ci-setup` |
| `refactor/` | 重构（不改变行为） | `refactor/design-store-zustand` |
| `hotfix/` | 紧急线上修复 | `hotfix/login-crash` |

**命名规则：** `{前缀}/{模块}-{简述}`，全小写，单词用 `-` 连接。

### 6.3 Commit 规范

采用 **Conventional Commits** 格式 [5]：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

| type | 说明 | 示例 |
| :--- | :--- | :--- |
| `feat` | 新功能 | `feat(client): 实现垂直中梃添加交互` |
| `fix` | Bug 修复 | `fix(client): 修复中梃拖拽越界问题` |
| `docs` | 文档 | `docs: 更新 ARCHITECTURE.md V2.1` |
| `refactor` | 重构 | `refactor(shared): 统一 Opening 类型定义` |
| `test` | 测试 | `test(shared): 添加 validators 单元测试` |
| `chore` | 工程 | `chore: 配置 pnpm workspace` |
| `style` | 格式 | `style(client): 统一 import 排序` |

**scope 使用包名：** `client`、`server`、`shared`。跨包变更省略 scope。

### 6.4 PR 规范

每个 PR 必须包含：

1. **标题** — 遵循 Commit 规范格式
2. **描述** — 说明做了什么、为什么做、怎么测试
3. **截图/录屏** — 涉及 UI 变更时必须附上
4. **关联任务** — 引用任务 ID（如 `T-12`）

**合并策略：** 使用 **Squash and Merge**，保持 main 分支历史干净。

---

## 7. 前后端协作流程

### 7.1 接口契约优先（Contract First）

前后端开发的协作核心是**先定义接口，再各自实现**。流程如下：

```
1. TL 在 shared/src/types/api.ts 中定义接口类型
   ↓
2. 前端根据类型定义实现 storageAdapter（先用 localStorage mock）
   ↓  （并行）
3. 后端根据类型定义实现 API 路由
   ↓
4. 联调：前端将 storageAdapter 切换为 API 调用
```

### 7.2 接口类型定义示例

```typescript
// packages/shared/src/types/api.ts

// 统一响应格式
export interface ApiResponse<T> {
  code: number;          // 0 = 成功
  data: T;
  message: string;
  timestamp: string;
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 设计数据 API
export interface CreateDesignRequest {
  name: string;
  width: number;
  height: number;
  profileSeriesId: string;
}

export interface UpdateDesignRequest {
  name?: string;
  designData: DesignData;  // 整体覆盖
}

export interface DesignListItem {
  id: string;
  name: string;
  thumbnail: string;
  updatedAt: string;
  windowCount: number;
}
```

### 7.3 前端 Mock 策略

在后端未就绪时，前端通过 `storageAdapter` 抽象层实现完全独立开发：

```typescript
// packages/client/src/lib/storageAdapter.ts

// 当前阶段：localStorage 实现
const localAdapter = {
  saveDesign: (design: DesignData) => {
    localStorage.setItem('design', JSON.stringify(design));
    return Promise.resolve();
  },
  loadDesign: () => {
    const json = localStorage.getItem('design');
    return Promise.resolve(json ? JSON.parse(json) : null);
  },
};

// 后端就绪后：API 实现
const apiAdapter = {
  saveDesign: (design: DesignData) =>
    fetch('/api/v1/designs/current', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ designData: design }),
    }).then(r => r.json()),
  loadDesign: () =>
    fetch('/api/v1/designs/current').then(r => r.json()).then(r => r.data),
};

// 通过环境变量切换
export const storageAdapter =
  import.meta.env.VITE_USE_API === 'true' ? apiAdapter : localAdapter;
```

**切换方式：** 在 `.env` 文件中设置 `VITE_USE_API=true` 即可从 localStorage 切换到 API 模式，代码零修改。

---

## 8. CI/CD 流水线

### 8.1 CI 配置

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check (all packages)
        run: pnpm typecheck

      - name: Lint (all packages)
        run: pnpm lint

      - name: Test (all packages)
        run: pnpm test

      - name: Build shared
        run: pnpm --filter @windoor/shared build

      - name: Build client
        run: pnpm --filter @windoor/client build

      - name: Build server
        run: pnpm --filter @windoor/server build
```

### 8.2 构建顺序

由于 client 和 server 都依赖 shared，构建必须遵循依赖顺序：

```
shared (先构建) → client (并行) + server (并行)
```

根 `package.json` 的 `build` 脚本已经体现了这个顺序：

```json
"build": "pnpm --filter shared build && pnpm --parallel --filter client --filter server build"
```

---

## 9. 开发者快速上手

### 9.1 环境准备

```bash
# 1. 克隆仓库
git clone git@github.com:liudada118/windows.git
cd windows

# 2. 安装依赖（pnpm 会自动处理 workspace 链接）
pnpm install

# 3. 启动前端开发服务器（仅前端，不依赖后端）
pnpm dev

# 4. 启动前后端联调（后端就绪后）
pnpm dev:all
```

### 9.2 常用命令速查

| 命令 | 说明 |
| :--- | :--- |
| `pnpm dev` | 启动前端开发服务器（端口 3000） |
| `pnpm dev:server` | 启动后端开发服务器（端口 3001） |
| `pnpm dev:all` | 并行启动前后端 |
| `pnpm build` | 构建所有包（shared → client + server） |
| `pnpm typecheck` | 全量类型检查 |
| `pnpm lint` | 全量代码检查 |
| `pnpm test` | 运行所有测试 |
| `pnpm --filter client add <pkg>` | 给前端添加依赖 |
| `pnpm --filter server add <pkg>` | 给后端添加依赖 |
| `pnpm --filter shared add <pkg>` | 给共享包添加依赖 |

### 9.3 新成员 Onboarding 检查清单

1. 阅读 `README.md` 了解项目概况
2. 阅读 `ARCHITECTURE.md` 了解技术架构
3. 阅读 `docs/TEAM-SPEC.md` 了解团队规范
4. 执行 `pnpm install && pnpm dev` 确认环境正常
5. 阅读自己负责模块的任务书（如 `docs/FRONTEND-BINDOOR-TASK.md`）
6. 从 `main` 创建功能分支，开始开发

---

## 10. 部署策略

### 10.1 前端部署

```bash
# 构建前端静态文件
pnpm build:client

# 产出目录：packages/client/dist/
# 部署到 Nginx / CDN / 对象存储
```

### 10.2 后端部署

```bash
# 构建后端
pnpm build:server

# 产出目录：packages/server/dist/
# 使用 PM2 或 Docker 部署
node packages/server/dist/index.js
```

### 10.3 Docker 部署（推荐）

```dockerfile
# Dockerfile（根目录）
FROM node:22-alpine AS base
RUN corepack enable pnpm

# 安装依赖
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/client/package.json packages/client/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile

# 构建
FROM deps AS builder
COPY . .
RUN pnpm build

# 前端产物（Nginx 托管）
FROM nginx:alpine AS client
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html

# 后端运行时
FROM base AS server
WORKDIR /app
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

---

## 参考资料

[1] pnpm Workspaces 官方文档. https://pnpm.io/workspaces

[2] Monorepo vs Multi-repo: A Comparison. https://blog.logrocket.com/exploring-workspaces-other-tools-monorepos/

[3] pnpm 的硬链接和内容寻址存储. https://pnpm.io/motivation

[4] GitHub Flow 官方指南. https://docs.github.com/en/get-started/using-github/github-flow

[5] Conventional Commits 规范. https://www.conventionalcommits.org/
