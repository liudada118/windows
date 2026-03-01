# 画门窗设计器 — 技术分工与前后端协作规范

> 编写人：Manus AI（软件负责人视角）  
> 最后更新：2026-03-01  
> 适用范围：3-5 人小团队快速迭代开发

---

## 一、团队角色与分工

### 1.1 角色定义

本项目按照 **前端主导 + 后端支撑** 的模式组织。由于核心业务逻辑（画图、算料）天然在浏览器端运行，后端主要承担数据持久化、用户管理和报价配置等支撑性功能。

| 角色 | 人数 | 职责范围 | 核心技能要求 |
| :--- | :--- | :--- | :--- |
| **技术负责人 (TL)** | 1 | 架构设计、Code Review、技术决策、接口定义 | 全栈能力，熟悉门窗行业领域 |
| **前端工程师 A** | 1 | 画布引擎、3D 渲染、算料引擎、导出功能 | React + SVG/Canvas + Three.js |
| **前端工程师 B** | 1 | UI 页面、属性面板、报价模块、型材/五金库管理 | React + Tailwind + 表单/表格 |
| **后端工程师** | 1 | API 开发、数据库设计、用户认证、文件存储 | Node.js/Express + PostgreSQL |
| **测试/运维（兼职）** | 0.5 | 部署流水线、自动化测试、性能监控 | CI/CD + Nginx + Docker |

### 1.2 模块归属矩阵

下表明确每个模块的**主要负责人**和**协作方**，避免职责模糊。

| 模块 | 主负责 | 协作方 | 所在层 |
| :--- | :--- | :--- | :--- |
| 2D 画布引擎 (Canvas.tsx) | 前端 A | TL | 前端 |
| 3D 预览 (Preview3D.tsx) | 前端 A | — | 前端 |
| 工具箱 / 属性面板 | 前端 B | 前端 A | 前端 |
| 模板系统 | 前端 B | 前端 A | 前端 |
| 算料引擎 | 前端 A | TL、后端 | **共享层** |
| 型材库 / 五金库 | 前端 B | 后端 | 前端 + 后端 |
| 报价模块 | 前端 B | 后端 | 前端 + 后端 |
| 导出功能 (PDF/图片) | 前端 A | — | 前端 |
| 用户认证 | 后端 | 前端 B | 后端 |
| 设计数据存储 | 后端 | 前端 A | 后端 |
| 数据库设计 | 后端 | TL | 后端 |
| 部署 / CI/CD | 测试运维 | TL | 运维 |

---

## 二、前后端分层架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React SPA)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 画布引擎  │  │ 3D 预览  │  │ 算料引擎  │  │ 导出模块  │    │
│  │ Canvas   │  │ Preview  │  │ Calc     │  │ Export   │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │              │              │              │          │
│  ┌────┴──────────────┴──────────────┴──────────────┴────┐    │
│  │              DesignerContext (状态管理)                │    │
│  └──────────────────────┬───────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────┴───────────────────────────────┐    │
│  │              API Client (api.ts)                      │    │
│  │   封装所有 HTTP 请求，统一错误处理和 Token 管理         │    │
│  └──────────────────────┬───────────────────────────────┘    │
└─────────────────────────┼───────────────────────────────────┘
                          │  HTTP / JSON
┌─────────────────────────┼───────────────────────────────────┐
│                    后端 (Node.js / Express)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 认证模块  │  │ 设计存储  │  │ 型材/五金 │  │ 报价模块  │    │
│  │ Auth     │  │ Design   │  │ Material │  │ Quote    │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │              │              │              │          │
│  ┌────┴──────────────┴──────────────┴──────────────┴────┐    │
│  │              PostgreSQL 数据库                         │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 关键设计原则

**原则一：算料引擎放在前端，后端只存结果。** 算料计算需要实时响应用户的每次设计变更（添加中梃、改尺寸等），将其放在前端可以做到毫秒级反馈，无需网络往返。后端只在用户"保存"时接收最终的算料结果。

**原则二：共享类型定义，前后端用同一套 TypeScript 接口。** 项目已有 `shared/` 目录，将核心领域模型（`DesignData`、`Frame`、`Cell` 等）放入 `shared/types.ts`，前后端共同引用，避免数据结构不一致。

**原则三：前端可离线工作，后端是增量增强。** 当前 MVP 已经是纯前端可用的。后续加入后端后，前端仍然可以在离线状态下完成画图和算料，联网后再同步数据。这意味着前端不应该对后端产生硬依赖。

---

## 三、共享类型规范 (shared/types.ts)

### 3.1 迁移策略

当前核心类型定义在 `client/src/lib/types.ts`，后续需要将**领域模型**部分迁移到 `shared/types.ts`，使前后端共享。

| 类型 | 当前位置 | 迁移目标 | 说明 |
| :--- | :--- | :--- | :--- |
| `DesignData` | client/src/lib/types.ts | **shared/types.ts** | 核心领域模型，前后端共享 |
| `Frame`, `Cell`, `Mullion`, `Sash` | client/src/lib/types.ts | **shared/types.ts** | 设计数据子结构 |
| `ColorConfig`, `Filling`, `GlazingBar` | client/src/lib/types.ts | **shared/types.ts** | 设计数据子结构 |
| `CanvasState`, `ToolType` | client/src/lib/types.ts | 保留前端 | 纯 UI 状态，后端不需要 |
| `HistoryEntry`, `Template` | client/src/lib/types.ts | 保留前端 | 纯 UI 状态 |
| `ProfileSeries`, `Hardware` | 新增 | **shared/types.ts** | 型材和五金配件模型 |
| `QuoteItem`, `QuoteSheet` | 新增 | **shared/types.ts** | 报价模型 |
| `CalcResult`, `MaterialList` | 新增 | **shared/types.ts** | 算料结果模型 |

### 3.2 新增共享类型定义

以下是后续开发需要新增的核心类型，前后端团队必须严格遵守：

```typescript
// ========== shared/types.ts 新增类型 ==========

/** 项目（包含多樘窗） */
export interface Project {
  id: string;
  name: string;
  customerName?: string;
  address?: string;
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
  userId: string;
  designs: DesignData[];   // 该项目下的所有窗设计
}

/** 型材系列 */
export interface ProfileSeries {
  id: string;
  name: string;            // 如 "60系列", "70系列"
  brand?: string;          // 品牌
  material: 'aluminum' | 'pvc' | 'wood' | 'steel';
  frameWidth: number;      // 外框型材宽度 (mm)
  mullionWidth: number;    // 中梃型材宽度 (mm)
  sashFrameWidth: number;  // 扇框型材宽度 (mm)
  profiles: ProfileSpec[]; // 该系列下的所有型材规格
}

/** 单根型材规格 */
export interface ProfileSpec {
  id: string;
  code: string;            // 型材编号，如 "60-001"
  name: string;            // 名称，如 "60系列外框上横"
  usage: ProfileUsage;     // 用途
  weightPerMeter: number;  // 每米重量 (kg/m)
  pricePerMeter: number;   // 每米单价 (元/m)
  length: number;          // 标准长度 (mm)，通常 6000
}

export type ProfileUsage =
  | 'frame_top' | 'frame_bottom' | 'frame_left' | 'frame_right'
  | 'mullion_vertical' | 'mullion_horizontal'
  | 'sash_top' | 'sash_bottom' | 'sash_left' | 'sash_right'
  | 'glazing_bead';        // 压线

/** 五金配件 */
export interface Hardware {
  id: string;
  name: string;            // 如 "执手", "铰链", "锁点"
  category: HardwareCategory;
  applicableSashTypes: SashType[];  // 适用的扇类型
  unit: string;            // 计量单位，如 "套", "个", "根"
  pricePerUnit: number;    // 单价 (元)
  /** 数量计算规则：fixed=固定数量, perMeter=按米计, formula=公式 */
  quantityRule: {
    type: 'fixed' | 'perMeter' | 'formula';
    value: number;         // fixed 时为数量，perMeter 时为每米数量
    formula?: string;      // formula 时的计算表达式
  };
}

export type HardwareCategory =
  | 'handle'       // 执手/把手
  | 'hinge'        // 铰链/合页
  | 'lock_point'   // 锁点
  | 'stay'         // 风撑
  | 'roller'       // 滑轮（推拉窗）
  | 'track'        // 轨道（推拉窗）
  | 'seal'         // 密封条
  | 'other';

/** 玻璃规格 */
export interface GlassSpec {
  id: string;
  name: string;            // 如 "5+12A+5中空", "5+12A+5Low-E"
  structure: string;       // 结构描述
  thickness: number;       // 总厚度 (mm)
  pricePerSqm: number;    // 每平方米单价 (元/m²)
  uValue?: number;         // 传热系数
}

/** 算料结果 */
export interface CalcResult {
  designId: string;
  /** 型材清单 */
  profiles: {
    specId: string;
    specCode: string;
    specName: string;
    cutLength: number;     // 下料长度 (mm)
    quantity: number;       // 数量
    totalLength: number;   // 总长度 (mm)
    weight: number;        // 重量 (kg)
    cost: number;          // 费用 (元)
  }[];
  /** 玻璃清单 */
  glasses: {
    glassSpecId: string;
    width: number;         // 玻璃宽度 (mm)
    height: number;        // 玻璃高度 (mm)
    area: number;          // 面积 (m²)
    quantity: number;
    cost: number;
  }[];
  /** 五金清单 */
  hardwares: {
    hardwareId: string;
    name: string;
    quantity: number;
    unit: string;
    cost: number;
  }[];
  /** 汇总 */
  summary: {
    totalProfileWeight: number;
    totalGlassArea: number;
    totalProfileCost: number;
    totalGlassCost: number;
    totalHardwareCost: number;
    totalCost: number;
  };
}

/** 报价单 */
export interface QuoteSheet {
  id: string;
  projectId: string;
  createdAt: string;
  items: QuoteItem[];
  totalAmount: number;
  discount?: number;
  finalAmount: number;
  remark?: string;
}

export interface QuoteItem {
  designId: string;
  windowCode: string;
  quantity: number;
  unitPrice: number;       // 单价 (元/樘)
  totalPrice: number;
  calcResult: CalcResult;
}
```

### 3.3 类型命名规范

| 规则 | 说明 | 示例 |
| :--- | :--- | :--- |
| 接口用 PascalCase | 所有 interface 和 type | `DesignData`, `ProfileSeries` |
| 枚举值用 snake_case | 联合类型的字面量值 | `'casement_left'`, `'tilt_turn_right'` |
| ID 字段统一用 `id: string` | 前端生成用 nanoid，后端生成用 UUID | `id: string` |
| 时间字段用 ISO 8601 字符串 | 前后端统一格式 | `"2026-03-01T10:30:00Z"` |
| 金额单位统一为**元** | 精度保留 2 位小数 | `pricePerMeter: 25.50` |
| 长度单位统一为**毫米 (mm)** | 所有尺寸相关字段 | `width: 1500` |

---

## 四、API 接口规范

### 4.1 通用约定

| 项目 | 规范 |
| :--- | :--- |
| **基础路径** | `/api/v1/` |
| **数据格式** | JSON (`Content-Type: application/json`) |
| **认证方式** | Bearer Token (JWT)，放在 `Authorization` 头 |
| **分页参数** | `?page=1&pageSize=20`，响应包含 `total` 字段 |
| **排序参数** | `?sort=createdAt&order=desc` |
| **错误格式** | `{ "code": "ERR_NOT_FOUND", "message": "项目不存在" }` |
| **成功格式** | `{ "data": {...}, "message": "ok" }` |
| **时间格式** | ISO 8601 (`2026-03-01T10:30:00Z`) |
| **ID 格式** | UUID v4 (后端生成) 或 nanoid (前端生成) |

### 4.2 统一响应结构

```typescript
// 成功响应
interface ApiResponse<T> {
  data: T;
  message: string;
}

// 分页响应
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  message: string;
}

// 错误响应
interface ApiError {
  code: string;           // 机器可读的错误码
  message: string;        // 人类可读的错误描述
  details?: unknown;      // 可选的详细信息
}
```

### 4.3 错误码规范

| 错误码 | HTTP 状态码 | 说明 |
| :--- | :--- | :--- |
| `ERR_UNAUTHORIZED` | 401 | 未登录或 Token 过期 |
| `ERR_FORBIDDEN` | 403 | 无权限访问该资源 |
| `ERR_NOT_FOUND` | 404 | 资源不存在 |
| `ERR_VALIDATION` | 422 | 请求参数校验失败 |
| `ERR_CONFLICT` | 409 | 资源冲突（如重复创建） |
| `ERR_INTERNAL` | 500 | 服务器内部错误 |

### 4.4 接口清单

#### 4.4.1 认证模块 (`/api/v1/auth/`)

| 方法 | 路径 | 说明 | 请求体 | 响应体 |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | 注册 | `{ phone, password, name }` | `{ token, user }` |
| `POST` | `/auth/login` | 登录 | `{ phone, password }` | `{ token, user }` |
| `POST` | `/auth/refresh` | 刷新 Token | `{ refreshToken }` | `{ token }` |
| `GET` | `/auth/me` | 获取当前用户 | — | `{ user }` |

#### 4.4.2 项目管理 (`/api/v1/projects/`)

| 方法 | 路径 | 说明 | 请求体/参数 | 响应体 |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/projects` | 项目列表 | `?page&pageSize&sort` | `PaginatedResponse<Project>` |
| `POST` | `/projects` | 创建项目 | `{ name, customerName?, address? }` | `ApiResponse<Project>` |
| `GET` | `/projects/:id` | 项目详情（含所有窗设计） | — | `ApiResponse<Project>` |
| `PUT` | `/projects/:id` | 更新项目信息 | `{ name?, customerName?, address? }` | `ApiResponse<Project>` |
| `DELETE` | `/projects/:id` | 删除项目 | — | `ApiResponse<null>` |

#### 4.4.3 设计数据 (`/api/v1/projects/:projectId/designs/`)

| 方法 | 路径 | 说明 | 请求体 | 响应体 |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/designs` | 保存设计 | `DesignData` (完整 JSON) | `ApiResponse<DesignData>` |
| `PUT` | `/designs/:id` | 更新设计 | `DesignData` (完整 JSON) | `ApiResponse<DesignData>` |
| `DELETE` | `/designs/:id` | 删除设计 | — | `ApiResponse<null>` |
| `POST` | `/designs/:id/duplicate` | 复制设计 | — | `ApiResponse<DesignData>` |

> **关键约定：** 设计数据采用**整体覆盖**策略（PUT 整个 `DesignData` JSON），而非 PATCH 局部更新。原因是 Cell 树结构复杂，局部更新容易产生不一致。前端在用户点击"保存"时，将当前完整的 `DesignData` 序列化后发送给后端。

#### 4.4.4 型材库 (`/api/v1/profiles/`)

| 方法 | 路径 | 说明 | 请求体 | 响应体 |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/profiles/series` | 型材系列列表 | — | `ApiResponse<ProfileSeries[]>` |
| `POST` | `/profiles/series` | 创建型材系列 | `ProfileSeries` | `ApiResponse<ProfileSeries>` |
| `PUT` | `/profiles/series/:id` | 更新型材系列 | `ProfileSeries` | `ApiResponse<ProfileSeries>` |
| `GET` | `/profiles/specs` | 型材规格列表 | `?seriesId` | `ApiResponse<ProfileSpec[]>` |
| `POST` | `/profiles/specs` | 创建型材规格 | `ProfileSpec` | `ApiResponse<ProfileSpec>` |

#### 4.4.5 五金配件库 (`/api/v1/hardwares/`)

| 方法 | 路径 | 说明 | 请求体 | 响应体 |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/hardwares` | 配件列表 | `?category` | `ApiResponse<Hardware[]>` |
| `POST` | `/hardwares` | 创建配件 | `Hardware` | `ApiResponse<Hardware>` |
| `PUT` | `/hardwares/:id` | 更新配件 | `Hardware` | `ApiResponse<Hardware>` |
| `DELETE` | `/hardwares/:id` | 删除配件 | — | `ApiResponse<null>` |

#### 4.4.6 玻璃规格 (`/api/v1/glasses/`)

| 方法 | 路径 | 说明 | 请求体 | 响应体 |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/glasses` | 玻璃规格列表 | — | `ApiResponse<GlassSpec[]>` |
| `POST` | `/glasses` | 创建玻璃规格 | `GlassSpec` | `ApiResponse<GlassSpec>` |
| `PUT` | `/glasses/:id` | 更新玻璃规格 | `GlassSpec` | `ApiResponse<GlassSpec>` |

#### 4.4.7 报价 (`/api/v1/quotes/`)

| 方法 | 路径 | 说明 | 请求体 | 响应体 |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/quotes` | 生成报价单 | `{ projectId, discount? }` | `ApiResponse<QuoteSheet>` |
| `GET` | `/quotes/:id` | 获取报价单 | — | `ApiResponse<QuoteSheet>` |
| `GET` | `/quotes` | 报价单列表 | `?projectId` | `PaginatedResponse<QuoteSheet>` |

---

## 五、数据库设计规范

### 5.1 表结构概览

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  users   │────<│ projects │────<│ designs  │
└──────────┘     └──────────┘     └──────────┘
                       │
                       └────<┌──────────┐
                             │  quotes  │
                             └──────────┘

┌──────────────────┐     ┌──────────────────┐
│ profile_series   │────<│ profile_specs    │
└──────────────────┘     └──────────────────┘

┌──────────┐     ┌──────────┐
│ hardwares│     │ glasses  │
└──────────┘     └──────────┘
```

### 5.2 关键表定义

| 表名 | 主要字段 | 说明 |
| :--- | :--- | :--- |
| `users` | id, phone, password_hash, name, role, created_at | 用户表 |
| `projects` | id, user_id, name, customer_name, address, created_at, updated_at | 项目表 |
| `designs` | id, project_id, window_code, quantity, **design_json** (JSONB), calc_result_json, created_at, updated_at | 设计数据表 |
| `profile_series` | id, name, brand, material, frame_width, mullion_width, sash_frame_width | 型材系列表 |
| `profile_specs` | id, series_id, code, name, usage, weight_per_meter, price_per_meter | 型材规格表 |
| `hardwares` | id, name, category, applicable_sash_types, unit, price_per_unit, quantity_rule | 五金配件表 |
| `glasses` | id, name, structure, thickness, price_per_sqm, u_value | 玻璃规格表 |
| `quotes` | id, project_id, items_json, total_amount, discount, final_amount, created_at | 报价单表 |

> **关键决策：** `designs` 表的 `design_json` 字段使用 **JSONB** 类型存储完整的 `DesignData` 对象。这是因为 Cell 树结构是递归嵌套的，用关系型表拆分会极其复杂且查询低效。JSONB 支持索引和部分查询，同时保持了数据结构的完整性。

### 5.3 数据库命名规范

| 规则 | 说明 | 示例 |
| :--- | :--- | :--- |
| 表名用复数 snake_case | — | `profile_series`, `hardwares` |
| 字段名用 snake_case | — | `created_at`, `user_id` |
| 主键统一用 `id` (UUID) | — | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` |
| 外键格式 `{表名单数}_id` | — | `project_id`, `series_id` |
| 时间字段带时区 | — | `TIMESTAMPTZ DEFAULT NOW()` |
| JSONB 字段后缀 `_json` | 标识非结构化存储 | `design_json`, `calc_result_json` |

---

## 六、前端 API 客户端规范

### 6.1 统一封装

前端需要创建 `client/src/lib/api.ts` 作为所有后端请求的统一入口：

```typescript
// client/src/lib/api.ts — 前端 API 客户端封装示例

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) { this.token = token; }
  clearToken() { this.token = null; }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(error.code || 'ERR_UNKNOWN', error.message || '请求失败');
    }

    return res.json();
  }

  // 项目
  getProjects(params?: { page?: number; pageSize?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<PaginatedResponse<Project>>('GET', `/projects?${query}`);
  }

  createProject(data: { name: string; customerName?: string }) {
    return this.request<ApiResponse<Project>>('POST', '/projects', data);
  }

  // 设计数据
  saveDesign(projectId: string, design: DesignData) {
    return this.request<ApiResponse<DesignData>>(
      'POST', `/projects/${projectId}/designs`, design
    );
  }

  updateDesign(projectId: string, designId: string, design: DesignData) {
    return this.request<ApiResponse<DesignData>>(
      'PUT', `/projects/${projectId}/designs/${designId}`, design
    );
  }

  // ... 其他接口
}

export const api = new ApiClient();
```

### 6.2 前端集成策略（渐进式）

后端 API 不是一次性全部接入的，而是分阶段渐进式集成：

| 阶段 | 接入的 API | 前端改动 |
| :--- | :--- | :--- |
| **阶段 0（当前）** | 无 | 纯前端，localStorage 保存 |
| **阶段 1** | 认证 + 项目 + 设计存储 | 添加登录页，DesignerContext 增加保存/加载逻辑 |
| **阶段 2** | 型材库 + 五金库 + 玻璃库 | PropertyPanel 从 API 加载型材列表，替代硬编码 |
| **阶段 3** | 报价 | 新增报价页面，调用报价 API |

> **重要原则：** 每个阶段前端都应该保留**降级方案**。例如阶段 1 中，如果后端不可用，前端仍然可以用 localStorage 保存数据。通过 `try/catch` 和 fallback 机制实现。

---

## 七、Git 工作流与代码规范

### 7.1 分支策略

```
main (生产分支)
  └── develop (开发分支)
        ├── feature/calc-engine      (前端 A)
        ├── feature/profile-ui       (前端 B)
        ├── feature/auth-api         (后端)
        └── feature/design-storage   (后端)
```

| 分支类型 | 命名规则 | 合并目标 | 说明 |
| :--- | :--- | :--- | :--- |
| `main` | — | — | 生产环境，只接受 develop 合并 |
| `develop` | — | main | 开发集成分支 |
| `feature/*` | `feature/模块名-功能` | develop | 功能开发分支 |
| `fix/*` | `fix/问题描述` | develop | 缺陷修复分支 |
| `hotfix/*` | `hotfix/紧急修复` | main + develop | 生产紧急修复 |

### 7.2 Commit 规范

采用 **Conventional Commits** 格式：

```
<type>(<scope>): <description>

[optional body]
```

| type | 说明 | 示例 |
| :--- | :--- | :--- |
| `feat` | 新功能 | `feat(canvas): 添加中梃拖拽吸附功能` |
| `fix` | 修复 | `fix(calc): 修复三等分时型材长度计算错误` |
| `refactor` | 重构 | `refactor(context): 将算料逻辑抽离为独立模块` |
| `docs` | 文档 | `docs: 更新 API 接口文档` |
| `style` | 样式 | `style(panel): 调整属性面板间距` |
| `chore` | 构建/工具 | `chore: 升级 Three.js 到 0.165` |

### 7.3 Code Review 检查清单

每个 PR 合并前，TL 需要检查以下要点：

| 检查项 | 说明 |
| :--- | :--- |
| 类型安全 | 是否使用了 shared/types.ts 中的共享类型，无 `any` |
| 接口一致 | API 请求/响应是否符合本文档定义的接口规范 |
| 错误处理 | 是否有 try/catch，是否有用户友好的错误提示 |
| 性能影响 | Canvas 渲染是否有不必要的重渲染，3D 场景是否有内存泄漏 |
| 向后兼容 | 是否破坏了已有的 DesignData JSON 结构 |
| 离线降级 | 后端不可用时，前端功能是否仍然可用 |

---

## 八、算料引擎接口规范

算料引擎是本项目最核心的业务模块，虽然运行在前端，但其输入输出需要严格定义，以便后端存储和报价模块使用。

### 8.1 算料引擎位置

```
client/src/lib/calc-engine.ts    ← 算料引擎核心
client/src/lib/calc-profiles.ts  ← 型材计算
client/src/lib/calc-glass.ts     ← 玻璃计算
client/src/lib/calc-hardware.ts  ← 五金计算
```

### 8.2 算料引擎接口

```typescript
// 算料引擎主入口
function calculateMaterials(
  design: DesignData,
  series: ProfileSeries,
  glassSpec: GlassSpec,
  hardwares: Hardware[]
): CalcResult;
```

### 8.3 型材下料长度计算规则

| 部位 | 计算公式 | 说明 |
| :--- | :--- | :--- |
| 外框上横 | `frame.width - 2 * 45°切角余量` | 45° 切角余量通常为 frameWidth |
| 外框下横 | 同上 | — |
| 外框左竖 | `frame.height - 2 * 45°切角余量` | — |
| 外框右竖 | 同上 | — |
| 竖中梃 | `parentCell.rect.height` | 中梃长度 = 父 Cell 高度 |
| 横中梃 | `parentCell.rect.width` | 中梃长度 = 父 Cell 宽度 |
| 扇框上横 | `cell.rect.width - 2 * 45°切角余量` | 切角余量 = sashFrameWidth |
| 扇框下横 | 同上 | — |
| 扇框左竖 | `cell.rect.height - 2 * 45°切角余量` | — |
| 扇框右竖 | 同上 | — |

### 8.4 玻璃尺寸计算规则

| 场景 | 宽度公式 | 高度公式 |
| :--- | :--- | :--- |
| 固定玻璃 | `cell.width - 2 * 压线扣减` | `cell.height - 2 * 压线扣减` |
| 开启扇玻璃 | `cell.width - 2 * sashFrameWidth - 2 * 压线扣减` | `cell.height - 2 * sashFrameWidth - 2 * 压线扣减` |

> 压线扣减量通常为 15-20mm，具体取决于型材系列。

---

## 九、部署与环境规范

### 9.1 环境定义

| 环境 | 用途 | 地址 | 部署方式 |
| :--- | :--- | :--- | :--- |
| **开发环境** | 本地开发调试 | localhost:3000 | `pnpm dev` |
| **测试环境** | 集成测试 | 8.140.238.44/windows-test/ | CI 自动部署 |
| **生产环境** | 线上服务 | 8.140.238.44/windows/ | 手动部署或 CI |

### 9.2 后端环境变量

| 变量名 | 说明 | 示例值 |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://user:pass@localhost:5432/windoor` |
| `JWT_SECRET` | JWT 签名密钥 | 随机 32 位字符串 |
| `JWT_EXPIRES_IN` | Token 有效期 | `7d` |
| `PORT` | 后端服务端口 | `8080` |
| `NODE_ENV` | 运行环境 | `production` |

### 9.3 前端环境变量

| 变量名 | 说明 | 示例值 |
| :--- | :--- | :--- |
| `VITE_API_URL` | 后端 API 地址 | `/api/v1`（通过 Nginx 代理） |
| `VITE_APP_TITLE` | 应用标题 | `画门窗设计器` |

---

## 十、里程碑与交付节奏

### 10.1 两周一个 Sprint，每周一次 Demo

| 周次 | 前端 A | 前端 B | 后端 | 交付物 |
| :--- | :--- | :--- | :--- | :--- |
| W1-2 | localStorage 持久化 + 导出 PNG/PDF | 多窗列表管理 UI | 数据库设计 + 用户认证 API | 可离线保存的设计器 + 登录页 |
| W3-4 | 算料引擎核心 | 型材库管理 UI | 项目/设计 CRUD API + 型材库 API | 可在线保存 + 基础算料 |
| W5-6 | 玻璃/五金计算 + 材料清单 UI | 五金库管理 UI + 报价 UI | 五金库 API + 玻璃库 API | 完整算料 + 材料清单 |
| W7-8 | 导出报价单 PDF + 性能优化 | 报价配置 UI + 整体 UI 打磨 | 报价 API + 部署优化 | 可报价的完整产品 |

### 10.2 每日站会关注点

每天 15 分钟站会，每人回答三个问题：昨天完成了什么、今天计划做什么、有什么阻塞。TL 重点关注以下风险：

| 风险点 | 预防措施 |
| :--- | :--- |
| 前后端接口不一致 | 后端先写 API 文档（本文档），前端按文档开发 Mock |
| DesignData JSON 结构变更 | 任何结构变更必须经过 TL 审批，并做向后兼容 |
| 算料公式不准确 | 参考行业标准（GB/T 8478），与门窗厂技术人员确认 |
| Three.js 内存泄漏 | 前端 A 负责 3D 模块的 dispose 清理 |
| 构建产物过大 | 使用 dynamic import 拆分 Three.js，目标 < 500KB 首屏 |

---

*本文档是团队协作的基础契约，所有成员在开发前必须通读。如有疑问或需要修改，请在团队会议上讨论后由 TL 统一更新。*
