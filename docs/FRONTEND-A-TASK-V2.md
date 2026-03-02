# 前端 A 完整任务书 V2.0 — 画图 + 渲染 + 导出 + 算料

> **文档版本：** V2.0 | **日期：** 2026-03-02 | **作者：** 技术负责人（TL）
>
> **目标读者：** 前端 A 工程师
>
> **变更说明：** 在 V1.0 任务书（2D 画布核心，104.5h）基础上，追加 3D 预览、导出打印、算料引擎前端、材料清单 UI、画布高级功能，形成"先出可用效果"的完整交付方案。
>
> **核心策略：** 画图渲染是产品灵魂，不依赖后端，前端 A 独立推进，先让用户能画、能看 3D、能导出、能算料，形成可演示的完整闭环。

---

## 0. 任务总览

你将独立完成画门窗设计器的 **画图 + 渲染 + 导出 + 算料** 全部前端模块。这是整个产品的核心价值模块，覆盖从 2D 设计到 3D 预览到材料清单到文件导出的完整链路。

**交付目标：** 一个基于 Konva.js 的专业级 2D 门窗设计器，配合 Three.js 3D 实时预览、WindoorFormula 算料引擎、多格式导出（PNG/SVG/PDF/DXF），以及材料清单自动生成。用户完成设计后，可以一键查看 3D 效果、自动生成材料清单和报价、导出专业图纸。

**技术栈：**

| 分类 | 技术 | 说明 |
| :--- | :--- | :--- |
| 框架 | React 19 + TypeScript | 已有项目基础 |
| 画布引擎 | **Konva.js + react-konva** | 替换现有 SVG 方案 |
| 3D 渲染 | **Three.js** | 已有基础实现（ThreePreview.tsx + window3d.ts） |
| 算料引擎 | **自研 DSL 解析器 + Web Worker** | WindoorFormula DSL |
| 状态管理 | **Zustand** | 替换现有 useReducer |
| UI 组件 | shadcn/ui + Tailwind CSS 4 | 已有项目基础 |
| 导出 | jsPDF + dxf-writer + JSZip | 多格式导出 |
| 数据持久化 | localStorage | 不依赖后端 |

**不需要你做的事情（后续由其他人完成）：**

- 后端 API、数据库、用户认证
- 业务 UI 页面（登录、项目管理、订单、客户、报价等）
- 公式调试器 UI（由前端 B 完成，你提供算料引擎 API）
- AI 炫图、AR 拍照搭配（V2.0 功能）
- 阳光房 3D 设计器（V2.0 功能）

---

## 1. 与 V1.0 任务书的关系

V1.0 任务书（`FRONTEND-BINDOOR-TASK.md`）中的全部内容保持不变，本文档是其 **扩展版本**。V1.0 的 Sprint 1-3（2D 画布核心，104.5h）是本文档的 Phase 1，后续 Phase 追加新模块。

**请先完成 V1.0 任务书的全部内容**，然后按本文档的 Phase 2-5 继续推进。V1.0 任务书中的数据模型、Store 设计、渲染规范、交互逻辑等全部沿用，不重复描述。

| 阶段 | 对应 V1.0 | 内容 | 工时 | 周期 |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | Sprint 1-3 | 2D 画布核心（Konva.js 迁移 + 全部交互） | 104.5h | 6 周 |
| **Phase 2** | 新增 | 3D 预览增强 + 2D↔3D 联动 | 26h | 2 周 |
| **Phase 3** | 新增 | 导出与打印（PNG/SVG/PDF/DXF） | 30h | 2 周 |
| **Phase 4** | 新增 | 算料引擎前端 + 材料清单 UI | 71h | 4 周 |
| **Phase 5** | 新增 | 画布高级功能（异形框/格条/多选等） | 59h | 3 周 |
| **合计** | | | **290.5h** | **约 17 周** |

---

## 2. Phase 2：3D 预览增强（第 7-8 周，26h）

### 2.1 背景

当前 Three.js 3D 预览已有基础实现（`ThreePreview.tsx` + `window3d.ts`），可以渲染基本的 3D 框体。但 PRD 要求的完整 3D 功能尚未覆盖，包括颜色/木纹同步、爆炸视图、开启动画等。

本阶段的目标是让 3D 预览从"能看"升级为"好看 + 好用"，用户在 2D 画布设计完成后，一键切换到 3D 视图即可看到逼真的渲染效果。

### 2.2 2D → 3D 数据映射规则

这是 3D 渲染的核心——如何将 2D 设计数据转换为 3D 模型。以下映射规则必须严格遵守：

| 2D 数据字段 | 3D 模型属性 | 映射规则 |
| :--- | :--- | :--- |
| `frame.profileWidth` / `profileHeight` | `THREE.ExtrudeGeometry` | 将型材的 2D 截面（一个带厚度的矩形）沿 `frame.shape` 的路径进行拉伸，形成 3D 框体 |
| `glass.spec`（如"5+12A+5"） | `THREE.MeshPhysicalMaterial.thickness` | 解析玻璃规格计算总厚度（如 22mm），渲染为有厚度的透明材质 |
| `colorConfig.frameColor` | `THREE.MeshStandardMaterial.color` | 纯色直接设置 `color` 属性 |
| 木纹贴图 | `THREE.MeshStandardMaterial.map` | 加载对应木纹图片作为 `map` 纹理贴图 |
| `sash.openingType` + `hingeSide` | 枢轴点 (Pivot Point) | 将扇的枢轴点设置在 `hingeSide` 对应的边缘，用于开启动画 |

**3D 场景默认参数：**

| 参数 | 值 | 说明 |
| :--- | :--- | :--- |
| 环境光 (AmbientLight) | 强度 0.6 | 柔和的基础照明 |
| 平行光 (DirectionalLight) | 强度 0.8，位置 (-5, 10, 7.5) | 模拟从左上方照射的自然光 |
| 阴影类型 | `PCFSoftShadowMap` | 柔和阴影 |
| 型材材质 | `MeshStandardMaterial`，metalness: 0.3, roughness: 0.6 | 金属质感 |
| 玻璃材质 | `MeshPhysicalMaterial`，transmission: 0.9, opacity: 0.3 | 透明效果 |

### 2.3 任务列表

| 任务 ID | 任务 | 预估工时 | 验收标准 |
| :--- | :--- | :--- | :--- |
| **P2-01** | 重构 3D 模型生成逻辑，基于 2D→3D 映射规则从 designStore 数据自动生成 3D 场景 | 4h | 2D 画布中的窗户在 3D 视图中正确显示，包括外框、中梃、玻璃、扇框 |
| **P2-02** | 实现颜色同步：20+ 纯色实时切换 | 4h | 2D 切换颜色后，3D 模型在 500ms 内同步更新 |
| **P2-03** | 实现木纹贴图渲染：23 种木纹的 UV 映射和材质 | 4h | 木纹贴图正确映射到框体表面，无拉伸/变形 |
| **P2-04** | 实现爆炸视图：框、扇、玻璃、五金分离展示 | 6h | 点击"爆炸视图"按钮，各组件沿法线方向平滑分离，再次点击恢复 |
| **P2-05** | 实现开启动画：基于 hingeSide 设置枢轴点，模拟扇的开启/关闭 | 4h | 点击扇组件或"开启动画"按钮，扇沿铰链侧旋转开启（平开 90°，内倒 15°） |
| **P2-06** | 3D 光照与阴影优化 | 2h | 光照参数符合 2.2 节定义，阴影柔和自然 |
| **P2-07** | Three.js 代码拆分（dynamic import），确保首屏 < 500KB | 2h | Three.js 按需加载，不影响 2D 画布首屏性能 |

**23 种木纹贴图列表：** 纯白、瓷泳灰、瓷泳金、红花梨、肌肤黑、金橡、水晶红、香槟、柚木、原木、尊贵白、巴西柚木、白松木、横纹紫檀、红橡、金丝楠、沙比利、水曲柳、樱桃木、黑胡桃、红木、白橡、深胡桃。

> **木纹贴图来源：** 暂时使用 512×512 的程序化纹理（基于 Perlin Noise 生成木纹效果），后续由设计师提供真实贴图替换。在 `client/src/lib/textures.ts` 中封装纹理生成和加载逻辑。

### 2.4 文件结构（新增）

```
client/src/
├── components/
│   ├── three/                    # 3D 渲染相关组件（重构现有）
│   │   ├── ThreePreview.tsx      # 3D 预览容器（重构）
│   │   ├── WindowModel.tsx       # 窗户 3D 模型生成器（新增）
│   │   ├── FrameModel.tsx        # 外框 3D 模型（新增）
│   │   ├── GlassModel.tsx        # 玻璃 3D 模型（新增）
│   │   ├── SashModel.tsx         # 扇 3D 模型（新增）
│   │   └── ExplodedView.tsx      # 爆炸视图控制器（新增）
├── lib/
│   ├── textures.ts               # 木纹纹理生成与加载（新增）
│   └── three-utils.ts            # 3D 工具函数（新增）
```

### 2.5 Phase 2 交付物

- 3D 预览完整可用：从 2D 画布一键切换到 3D 视图，模型自动生成
- 颜色/木纹实时同步
- 爆炸视图和开启动画
- Three.js 按需加载，不影响首屏性能

---

## 3. Phase 3：导出与打印（第 9-10 周，30h）

### 3.1 导出格式规格

PRD 7.13 节定义了 4 种导出格式，每种面向不同用户群体：

| 格式 | 目标用户 | 规格要求 | 技术方案 |
| :--- | :--- | :--- | :--- |
| **PNG** | 销售、客户 | 300 DPI 高分辨率，支持透明背景，默认包含尺寸标注 | Konva.js `stage.toDataURL()` + 高分辨率缩放 |
| **SVG** | 开发者、设计师 | 矢量格式，保留图层和对象 ID，便于二次开发 | 自定义 SVG 生成器（遍历 designStore 数据） |
| **PDF** | 客户、工厂 | A4 页面，标准化打印模板（含标注 + 材料清单），矢量格式 | jsPDF + 自定义模板引擎 |
| **DXF** | 工厂 (CNC) | AutoCAD 2007 兼容，图层分离（外框/中梃/扇/玻璃/标注） | dxf-writer 库 |

### 3.2 打印模板

导出 PDF 和打印时，必须套用标准化模板：

```
┌──────────────────────────────────────────────────┐
│ [公司Logo]          **门窗加工单**         [二维码] │
├──────────────────────────────────────────────────┤
│ 客户: 张三    订单号: PO20260302-001   日期: 2026-03-02 │
├──────────────────────────────────────────────────┤
│                       (门窗图纸)                     │
│                                                  │
├──────────────────────────────────────────────────┤
│ 型材清单 | 玻璃清单 | 五金清单                      │
├──────────────────────────────────────────────────┤
│ 备注: ...                                        │
└──────────────────────────────────────────────────┘
```

模板中的客户信息、订单号等字段暂时使用 localStorage 中的数据或用户手动输入，后续对接后端 API 自动填充。

### 3.3 任务列表

| 任务 ID | 任务 | 预估工时 | 验收标准 |
| :--- | :--- | :--- | :--- |
| **P3-01** | 导出 PNG：300 DPI，支持透明背景选项，含尺寸标注 | 3h | 导出的 PNG 清晰度满足打印需求，3000×3000px 导出 < 2s |
| **P3-02** | 导出 SVG：遍历 designStore 生成矢量 SVG，保留图层和 ID | 3h | SVG 可在 Illustrator/Inkscape 中打开并编辑 |
| **P3-03** | 导出 PDF：基于 jsPDF 实现 A4 打印模板 | 8h | PDF 包含图纸 + 尺寸标注 + 材料清单（Phase 4 完成后集成） |
| **P3-04** | 导出 DXF：AutoCAD 2007 兼容，图层分离 | 8h | DXF 可在 AutoCAD 中打开，外框/中梃/扇/玻璃/标注在不同图层 |
| **P3-05** | 打印模板系统：公司 Logo + 客户信息 + 图纸 + 明细 | 4h | 模板可配置公司信息，打印效果专业 |
| **P3-06** | 批量导出：多窗型打包 ZIP 下载 | 4h | 选择多个窗型 + 格式，一键打包下载 |

**依赖安装：**

```bash
pnpm add jspdf dxf-writer jszip file-saver
pnpm add -D @types/file-saver
```

### 3.4 文件结构（新增）

```
client/src/
├── lib/
│   ├── export/                   # 导出相关模块
│   │   ├── exportPNG.ts          # PNG 导出
│   │   ├── exportSVG.ts          # SVG 导出
│   │   ├── exportPDF.ts          # PDF 导出（含打印模板）
│   │   ├── exportDXF.ts          # DXF 导出
│   │   ├── exportBatch.ts        # 批量导出（ZIP）
│   │   └── printTemplate.ts      # 打印模板配置
```

### 3.5 DXF 图层定义

| 图层名 | 颜色 | 内容 |
| :--- | :--- | :--- |
| `FRAME` | 白色 (7) | 外框轮廓线 |
| `MULLION` | 青色 (4) | 中梃轮廓线 |
| `SASH` | 红色 (1) | 扇框轮廓线 + 开启标记 |
| `GLASS` | 蓝色 (5) | 玻璃区域轮廓 |
| `DIMENSION` | 绿色 (3) | 尺寸标注线和文字 |
| `TEXT` | 黄色 (2) | 其他文字标注 |

### 3.6 Phase 3 交付物

- 4 种格式导出全部可用（PNG/SVG/PDF/DXF）
- 打印模板专业美观
- 批量导出功能
- 性能指标：PNG 导出 < 2s，PDF 生成 < 3s

---

## 4. Phase 4：算料引擎前端 + 材料清单 UI（第 11-14 周，71h）

### 4.1 算料引擎概述

算料引擎是门窗软件的核心竞争力。用户在 2D 画布完成设计后，系统自动根据公式计算出每根型材的下料长度、每块玻璃的面积、所需五金配件的数量和总报价。

算料引擎基于 **WindoorFormula DSL**（PRD 8.3 节），这是一个自定义的公式语言，支持四则运算、比较、逻辑、三元条件、12 个内置函数和 30+ 系统变量。

### 4.2 WindoorFormula DSL 规格

#### 4.2.1 数据类型

| 类型 | 说明 | 示例 |
| :--- | :--- | :--- |
| Number | 浮点数，精度 DECIMAL(10,2) | `2400.00` |
| String | 字符串，用双引号包裹 | `"荣耀120"` |
| Boolean | 布尔值 | `true` / `false` |
| List | 数组 | `[1, 2, 3]` |

#### 4.2.2 系统变量（30+）

| 变量名 | 含义 | 单位 | 来源 |
| :--- | :--- | :--- | :--- |
| `W` | 外框总宽 | mm | `windowUnit.width` |
| `H` | 外框总高 | mm | `windowUnit.height` |
| `FW` | 外框型材面宽 | mm | `frame.profileWidth` |
| `FH` | 外框型材截面高 | mm | `profileSeries.frameProfileHeight` |
| `SW` | 扇型材面宽 | mm | `sash.profileWidth` |
| `SH` | 扇型材截面高 | mm | `profileSeries.sashProfileHeight` |
| `MW` | 中梃型材面宽 | mm | `mullion.profileWidth` |
| `MH` | 中梃型材截面高 | mm | `profileSeries.mullionProfileHeight` |
| `GW` | 玻璃宽 | mm | 计算值（Opening.rect.width - 扣减） |
| `GH` | 玻璃高 | mm | 计算值（Opening.rect.height - 扣减） |
| `N` | 扇数量 | 个 | 计算值 |
| `AREA` | 面积 | ㎡ | `W × H / 1000000` |
| `REGION_W` | 当前区域宽 | mm | `opening.rect.width` |
| `REGION_H` | 当前区域高 | mm | `opening.rect.height` |
| `SASH_COUNT` | 扇总数 | 个 | 遍历 Opening 树统计 |
| `MULLION_COUNT` | 中梃总数 | 个 | 遍历 Opening 树统计 |
| `HAS_SCREEN` | 是否有纱窗 | bool | `sash.hasFlyScreen` |
| `OPEN_DIR` | 开启方向 | string | `sash.openingType` |

#### 4.2.3 运算符

| 运算符 | 说明 | 优先级（低→高） |
| :--- | :--- | :--- |
| `? :` | 三元条件 | 1 |
| `\|\|` | 逻辑或 | 2 |
| `&&` | 逻辑与 | 3 |
| `>` `<` `>=` `<=` `==` `!=` | 比较 | 4 |
| `+` `-` | 加减 | 5 |
| `*` `/` `%` | 乘除取模 | 6 |
| `!` `-`(一元) | 逻辑非、取负 | 7 |

#### 4.2.4 内置函数（12 个）

| 函数 | 说明 | 示例 |
| :--- | :--- | :--- |
| `ROUND(x, n)` | 四舍五入到 n 位小数 | `ROUND(W/3, 2)` |
| `CEIL(x)` | 向上取整 | `CEIL(W/6000)` |
| `FLOOR(x)` | 向下取整 | `FLOOR(H/100)` |
| `MAX(a, b)` | 取最大值 | `MAX(W, H)` |
| `MIN(a, b)` | 取最小值 | `MIN(W, 3000)` |
| `ABS(x)` | 取绝对值 | `ABS(W - H)` |
| `IF(cond, a, b)` | 条件判断 | `IF(N>2, 3, 2)` |
| `SUM(list)` | 求和 | `SUM([100, 200])` |
| `COUNT(list)` | 计数 | `COUNT(sashes)` |
| `LOOKUP(key, table)` | 查表 | `LOOKUP("五金", table)` |
| `SQRT(x)` | 平方根 | `SQRT(W*W + H*H)` |
| `PI()` | 圆周率 | `PI() * R * R` |

#### 4.2.5 EBNF 语法定义

```ebnf
(* WindoorFormula DSL 完整语法 *)

expression        ::= ternary_expr
ternary_expr      ::= or_expr [ "?" expression ":" expression ]
or_expr           ::= and_expr { "||" and_expr }
and_expr          ::= comparison_expr { "&&" comparison_expr }
comparison_expr   ::= additive_expr { ( ">" | "<" | ">=" | "<=" | "==" | "!=" ) additive_expr }
additive_expr     ::= multiplicative_expr { ( "+" | "-" ) multiplicative_expr }
multiplicative_expr ::= unary_expr { ( "*" | "/" | "%" ) unary_expr }
unary_expr        ::= [ "!" | "-" ] primary_expr
primary_expr      ::= number_literal
                    | string_literal
                    | boolean_literal
                    | list_literal
                    | function_call
                    | variable
                    | "(" expression ")"

function_call     ::= identifier "(" [ expression { "," expression } ] ")"
variable          ::= identifier { "." identifier }
list_literal      ::= "[" [ expression { "," expression } ] "]"
boolean_literal   ::= "true" | "false"
```

#### 4.2.6 错误处理

| 错误码 | 类型 | 描述 | 前端提示 |
| :--- | :--- | :--- | :--- |
| 1001 | `SyntaxError` | 括号不匹配、缺少操作符 | "公式语法错误，请检查括号或运算符" |
| 1002 | `SyntaxError` | 非法的函数名称 | "函数 'ABC' 不存在" |
| 2001 | `ReferenceError` | 引用了不存在的变量 | "变量 'xxx' 不存在" |
| 2002 | `TypeError` | 函数参数数量或类型不匹配 | "函数 'MAX' 需要至少一个参数" |
| 2003 | `TypeError` | 对非数字类型执行数学运算 | "无法对文本 'abc' 进行数学计算" |
| 3001 | `EvaluationError` | 除以零 | "计算错误：不能除以零" |
| 3002 | `EvaluationError` | 递归深度超限 | "公式循环引用，无法计算" |
| 3003 | `TimeoutError` | 执行超时（> 50ms） | "公式计算超时，请简化公式" |

#### 4.2.7 安全沙箱

所有公式必须在 Web Worker 中执行，与主线程隔离：

- **禁用全局对象：** `window`, `document`, `fetch` 等全部禁止访问
- **白名单函数：** 仅暴露 `Math.*` 和自定义的 12 个内置函数
- **严禁危险操作：** 禁止 `eval`, `new Function()`, `setTimeout`, `setInterval`
- **超时限制：** 单个公式执行 ≤ 50ms
- **结果缓存：** 相同输入（窗户尺寸 + 型材参数）的计算结果缓存，避免重复计算

### 4.3 执行流程

```
designStore.design
       │
       ▼
┌──────────────────┐
│ 1. 变量提取       │  从 WindowUnit + Opening 树提取 W/H/FW/SW 等变量
│    (extractVars)  │
└──────┬───────────┘
       │ variables: Record<string, number|string|boolean>
       ▼
┌──────────────────┐
│ 2. 公式解析       │  Tokenizer → Parser → AST
│    (parse)        │  错误码: 1001, 1002
└──────┬───────────┘
       │ ast: ASTNode
       ▼
┌──────────────────┐
│ 3. 变量绑定       │  将 variables 绑定到 AST 中的变量节点
│    (bind)         │  错误码: 2001, 2002, 2003
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ 4. 沙箱求值       │  在 Web Worker 中遍历 AST 计算结果
│    (evaluate)     │  错误码: 3001, 3002, 3003
└──────┬───────────┘
       │ result: number
       ▼
┌──────────────────┐
│ 5. 结果校验       │  检查结果是否在合理范围（> 0 且 ≤ 支长）
│    (validate)     │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ 6. 清单生成       │  汇总型材清单 + 玻璃清单 + 五金清单 + 费用
│    (generateBOM)  │
└──────────────────┘
```

### 4.4 公式 JSON 结构

每条公式存储为以下 JSON 格式：

```typescript
interface FormulaItem {
  id: string;                  // 公式唯一 ID
  name: string;                // 如 "外框上横料"
  category: 'profile' | 'glass' | 'hardware' | 'accessory';
  materialCode: string;        // 材料编号，如 "001"
  expression: string;          // 公式表达式，如 "W - FW * 2 + 10"
  unit: 'mm' | 'm' | 'm2' | 'piece' | 'set';
  quantityExpression: string;  // 数量公式，如 "2"（上下各一根）
  conditions: string;          // 生效条件，如 "true" 或 "SASH_COUNT > 0"
  description: string;         // 说明
}

interface FormulaSet {
  id: string;
  seriesId: string;            // 关联的型材系列 ID
  tab: 'frame' | 'casement' | 'double_casement' | 'sliding' | 'folding'
     | 'pricing' | 'costing' | 'wage' | 'rules' | 'drilling';
  formulas: FormulaItem[];
}
```

### 4.5 预置公式示例

为 70 系列预置以下基础公式，供测试和演示：

**外框公式 Tab：**

| 名称 | 材料编号 | 公式 | 数量 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| 外框上横料 | 001 | `W - FW * 2 + 10` | `1` | 上横料下料长度 |
| 外框下横料 | 001 | `W - FW * 2 + 10` | `1` | 下横料下料长度 |
| 外框左竖料 | 002 | `H - FW * 2 + 10` | `1` | 左竖料下料长度 |
| 外框右竖料 | 002 | `H - FW * 2 + 10` | `1` | 右竖料下料长度 |
| 垂直中梃 | 003 | `H - FW * 2 - 10` | `MULLION_COUNT` | 每根垂直中梃的下料长度 |
| 水平中梃 | 003 | `REGION_W - 10` | `1` | 每根水平中梃的下料长度（按区域计算） |

**玻璃计算：**

| 名称 | 公式 | 数量 | 说明 |
| :--- | :--- | :--- | :--- |
| 玻璃宽 | `REGION_W - IF(HAS_SASH, SW * 2, 0) - 10` | — | 扣减扇框宽度和间隙 |
| 玻璃高 | `REGION_H - IF(HAS_SASH, SW * 2, 0) - 10` | — | 同上 |
| 玻璃面积 | `GW * GH / 1000000` | `1` | 单位：㎡ |

### 4.6 材料清单 UI

算料完成后，在设计器右侧面板的"报价"Tab 中展示材料清单：

```
┌──────────────────────────────────────────────────┐
│ 材料清单                                [导出Excel] │
├──────────────────────────────────────────────────┤
│ ▼ 型材清单 (6 项)                                  │
│   编号  名称          规格    长度    数量  小计    │
│   001   外框上横料    70系列  2270mm  1    ¥68.1  │
│   001   外框下横料    70系列  2270mm  1    ¥68.1  │
│   002   外框左竖料    70系列  1370mm  1    ¥41.1  │
│   002   外框右竖料    70系列  1370mm  1    ¥41.1  │
│   003   垂直中梃      70系列  1360mm  1    ¥40.8  │
│                                                  │
│ ▼ 玻璃清单 (2 项)                                  │
│   规格      宽      高      面积    数量  小计    │
│   5+12A+5  550mm  1360mm  0.748㎡  2    ¥149.6 │
│                                                  │
│ ▼ 五金清单 (4 项)                                  │
│   名称      型号      数量  单价    小计          │
│   执手      Hopo-053  1    ¥45    ¥45           │
│   铰链      H-301     2    ¥35    ¥70           │
│   锁点      L-201     3    ¥15    ¥45           │
│   风撑      F-101     1    ¥25    ¥25           │
│                                                  │
├──────────────────────────────────────────────────┤
│ 型材费用: ¥259.2   玻璃费用: ¥149.6              │
│ 五金费用: ¥185.0   其他费用: ¥50.0               │
│                                                  │
│ 总计: ¥643.8                    [生成报价单]      │
└──────────────────────────────────────────────────┘
```

### 4.7 任务列表

| 任务 ID | 任务 | 预估工时 | 验收标准 |
| :--- | :--- | :--- | :--- |
| **P4-01** | 实现 Tokenizer：将公式字符串分词为 Token 流 | 4h | 正确识别数字、字符串、标识符、运算符、括号 |
| **P4-02** | 实现 Parser：将 Token 流解析为 AST，严格遵循 EBNF 语法 | 8h | 所有运算符优先级正确，支持嵌套表达式和函数调用 |
| **P4-03** | 实现 Evaluator：遍历 AST 求值，支持 12 个内置函数 | 6h | 所有内置函数正确执行，错误码正确抛出 |
| **P4-04** | 实现 Web Worker 沙箱：隔离执行环境，50ms 超时 | 4h | 公式在 Worker 中执行，主线程不阻塞 |
| **P4-05** | 实现系统变量提取：从 designStore 数据提取 30+ 变量 | 4h | 所有变量正确绑定，遍历 Opening 树统计扇/中梃数量 |
| **P4-06** | 实现型材下料计算模块：遍历 Opening 树计算每根型材长度 | 8h | 基础窗型（单扇/两等分/三等分/田字格）算料结果正确 |
| **P4-07** | 实现玻璃面积计算模块：考虑扇框扣减和压线扣减 | 4h | 玻璃面积计算误差 < 1mm |
| **P4-08** | 实现五金配件自动匹配：基于扇类型和尺寸查询配件库 | 6h | 平开扇/推拉扇/内开内倒扇的五金配置正确 |
| **P4-09** | 实现结果缓存（memoization） | 2h | 相同输入不重复计算，缓存命中率 > 90% |
| **P4-10** | 预置 70 系列基础公式（外框 + 内扇 + 玻璃 + 五金） | 4h | 预置公式覆盖基础窗型 |
| **P4-11** | 材料清单 UI：表格组件 + 分类折叠 + 费用汇总 | 8h | 清单数据与算料结果一致，支持展开/折叠 |
| **P4-12** | 材料清单与画布联动：画布修改后自动重新算料 | 3h | 修改尺寸/添加中梃/切换扇类型后，清单在 500ms 内更新 |
| **P4-13** | 算料引擎单元测试：覆盖 10+ 典型窗型 | 10h | 测试用例全部通过，覆盖边界条件 |

### 4.8 文件结构（新增）

```
client/src/
├── lib/
│   ├── calc-engine/              # 算料引擎核心
│   │   ├── tokenizer.ts          # 词法分析器
│   │   ├── parser.ts             # 语法分析器（AST 生成）
│   │   ├── evaluator.ts          # AST 求值器
│   │   ├── types.ts              # AST 节点类型定义
│   │   ├── builtins.ts           # 12 个内置函数实现
│   │   ├── errors.ts             # 错误码定义
│   │   ├── variables.ts          # 系统变量提取
│   │   ├── cache.ts              # 结果缓存
│   │   └── index.ts              # 引擎入口（统一 API）
│   ├── calc-modules/             # 算料计算模块
│   │   ├── calc-profiles.ts      # 型材下料计算
│   │   ├── calc-glass.ts         # 玻璃面积计算
│   │   ├── calc-hardware.ts      # 五金配件匹配
│   │   └── calc-bom.ts           # BOM 清单生成
│   ├── formulas/                 # 预置公式
│   │   └── series-70.ts          # 70 系列预置公式
├── workers/
│   └── calc-worker.ts            # Web Worker 沙箱
├── components/
│   ├── panels/
│   │   └── MaterialList.tsx      # 材料清单 UI 组件（新增）
├── stores/
│   └── calcStore.ts              # 算料结果 Store（新增）
```

### 4.9 算料引擎对外 API

算料引擎对外暴露统一 API，供材料清单 UI 和公式调试器（前端 B）调用：

```typescript
// client/src/lib/calc-engine/index.ts

export interface CalcResult {
  profiles: ProfileItem[];     // 型材清单
  glasses: GlassItem[];        // 玻璃清单
  hardware: HardwareItem[];    // 五金清单
  totalCost: number;           // 总费用
  errors: CalcError[];         // 计算错误列表
  executionTime: number;       // 执行耗时 (ms)
}

export interface CalcError {
  code: number;                // 错误码
  message: string;             // 错误信息
  formulaId: string;           // 出错的公式 ID
  position?: number;           // 出错位置（字符偏移）
}

/**
 * 对一个 WindowUnit 执行完整算料
 */
export function calculateWindow(
  window: WindowUnit,
  formulaSet: FormulaSet,
  profileSeries: ProfileSeries
): Promise<CalcResult>;

/**
 * 执行单条公式（供公式调试器使用）
 */
export function evaluateFormula(
  expression: string,
  variables: Record<string, number | string | boolean>
): Promise<{ result: number; trace: TraceStep[]; error?: CalcError }>;
```

### 4.10 Phase 4 交付物

- 完整的 WindoorFormula DSL 解析器和执行器
- Web Worker 沙箱隔离执行
- 型材/玻璃/五金自动算料
- 材料清单 UI 与画布实时联动
- 10+ 典型窗型的单元测试全部通过
- 对外 API 供公式调试器（前端 B）调用

---

## 5. Phase 5：画布高级功能（第 15-17 周，59h）

### 5.1 概述

Phase 1 完成了画布的核心功能（矩形框 + 直线中梃 + 15 种扇 + 基础交互）。Phase 5 追加高级功能，提升设计器的专业性和功能丰富度。

### 5.2 任务列表

| 任务 ID | 任务 | 预估工时 | PRD 章节 | 验收标准 |
| :--- | :--- | :--- | :--- | :--- |
| **P5-01** | 异形框支持：弧形顶窗（半圆弧、尖弧、椭圆弧） | 8h | 7.3 Tab1 | 可绘制弧形顶窗，弧线平滑，尺寸标注正确 |
| **P5-02** | 异形框支持：三角形、梯形、圆形窗 | 8h | 7.3 Tab1 | 可绘制非矩形窗户，内部分格逻辑正确 |
| **P5-03** | 格条渲染：40+ 种格条模板叠加在玻璃上 | 8h | 4.7 / 7.3 Tab5 | 格条模板可选择并正确渲染在玻璃区域 |
| **P5-04** | 填充物渲染：纱窗、百叶、板材等 8 种 | 4h | 4.8 / 7.3 Tab6 | 填充物替代玻璃正确渲染 |
| **P5-05** | 标线工具：9 种标注类型（线段/折线/对角线/圆弧/箭头/文字等） | 6h | 7.3 Tab7 | 标线工具可用，标注清晰 |
| **P5-06** | 多选与批量操作：框选 + Ctrl 点选 + 批量删除/修改 | 4h | 7.15.2 | 框选和点选均可用，批量操作正确 |
| **P5-07** | 控制点交互增强：8 个控制点 + 等比/自由缩放 | 6h | 7.11.1 | 角控制点等比缩放（Shift 自由变形），边控制点单向拉伸 |
| **P5-08** | 右键菜单：分格右键添加中梃/设置扇/删除/复制 | 3h | — | 右键菜单功能完整 |
| **P5-09** | 设计版本管理：自动快照（最近 10 个版本）+ 版本列表 + 回滚 | 8h | 7.8 | 版本自动保存，可查看历史版本并回滚 |
| **P5-10** | 窗型图库集成：从预置图库选择模板加载到画布 | 4h | 16.5 | 图库浏览 + 搜索 + 一键加载 |

### 5.3 异形框技术方案

异形框是画布最复杂的高级功能。核心挑战是：非矩形的 Frame 如何定义内部 Opening 的分格逻辑。

**方案：** 扩展 `Frame.shape` 类型，增加路径定义：

```typescript
// 扩展 Frame 类型
interface Frame {
  id: string;
  shape: 'rectangle' | 'arc_top' | 'triangle' | 'trapezoid' | 'circle' | 'polygon';
  profileWidth: number;
  rootOpening: Opening;
  // 新增：异形框路径定义
  customPath?: {
    type: 'arc' | 'polygon';
    points?: Point[];           // 多边形顶点
    arcCenter?: Point;          // 弧形中心点
    arcRadius?: number;         // 弧形半径
    arcStartAngle?: number;     // 弧形起始角度
    arcEndAngle?: number;       // 弧形结束角度
  };
}
```

**渲染策略：**
- 矩形框：沿用现有 Rect 渲染
- 弧形顶：底部矩形 + 顶部 Arc（Konva.Arc）
- 三角形/梯形：Konva.Line（closed polygon）
- 圆形：Konva.Circle

### 5.4 Phase 5 交付物

- 异形框（弧形顶、三角形、梯形）可用
- 格条和填充物渲染
- 标线工具
- 多选批量操作
- 控制点增强
- 设计版本管理
- 窗型图库

---

## 6. 完整排期总览

```
Week 1-2   Week 3-4   Week 5-6   Week 7-8   Week 9-10  Week 11-12 Week 13-14 Week 15-16 Week 17
  │          │          │          │          │          │          │          │          │
  ├──Sprint1─┤          │          │          │          │          │          │          │
  │ 基础骨架  ├──Sprint2─┤          │          │          │          │          │          │
  │          │ 核心交互  ├──Sprint3─┤          │          │          │          │          │
  │          │          │ 面板完善  │          │          │          │          │          │
  │          │          │          │          │          │          │          │          │
  │◄──── Phase 1: 2D画布核心 (104.5h) ────►│          │          │          │          │
  │                                        │          │          │          │          │
  │                                        ├──Phase2──┤          │          │          │
  │                                        │ 3D预览    │          │          │          │
  │                                        │ (26h)    │          │          │          │
  │                                        │          ├──Phase3──┤          │          │
  │                                        │          │ 导出打印  │          │          │
  │                                        │          │ (30h)    │          │          │
  │                                        │          │          ├──Phase4──────────────┤
  │                                        │          │          │ 算料引擎+材料清单     │
  │                                        │          │          │ (71h)                │
  │                                        │          │          │          │          │
  │                                        │          │          │          ├──Phase5──┤
  │                                        │          │          │          │ 高级功能  │
  │                                        │          │          │          │ (59h)    │
```

> **说明：** Phase 4 和 Phase 5 有部分时间重叠，因为算料引擎的单元测试（P4-13）可以与画布高级功能的部分任务并行。实际排期可根据进度灵活调整。

### 6.1 里程碑检查点

| 里程碑 | 时间点 | 标志 | 可演示内容 |
| :--- | :--- | :--- | :--- |
| **M1：2D 画布可用** | 第 6 周末 | Phase 1 完成 | 拖拽绘制窗户、添加中梃/扇、属性面板、撤销/重做 |
| **M2：3D 预览可用** | 第 8 周末 | Phase 2 完成 | 2D↔3D 一键切换、颜色/木纹同步、爆炸视图 |
| **M3：导出可用** | 第 10 周末 | Phase 3 完成 | 导出 PNG/SVG/PDF/DXF，打印模板 |
| **M4：算料可用** | 第 14 周末 | Phase 4 完成 | 自动算料、材料清单、费用汇总 |
| **M5：高级功能可用** | 第 17 周末 | Phase 5 完成 | 异形框、格条、多选、版本管理 |

### 6.2 工时汇总

| Phase | 内容 | 工时 | 周期 |
| :--- | :--- | :--- | :--- |
| Phase 1 | 2D 画布核心 | 104.5h | 6 周 |
| Phase 2 | 3D 预览增强 | 26h | 2 周 |
| Phase 3 | 导出与打印 | 30h | 2 周 |
| Phase 4 | 算料引擎 + 材料清单 | 71h | 4 周 |
| Phase 5 | 画布高级功能 | 59h | 3 周 |
| **合计** | | **290.5h** | **约 17 周** |

---

## 7. 验收标准（新增部分）

### 7.1 3D 预览验收

| ID | 验收项 | 通过标准 |
| :--- | :--- | :--- |
| **AC-3D-01** | 2D→3D 自动生成 | 2D 画布中的窗户在 3D 视图中完整显示 |
| **AC-3D-02** | 颜色同步 | 2D 切换颜色后 3D 在 500ms 内同步 |
| **AC-3D-03** | 木纹贴图 | 23 种木纹正确映射，无拉伸变形 |
| **AC-3D-04** | 爆炸视图 | 组件平滑分离和恢复 |
| **AC-3D-05** | 开启动画 | 扇沿铰链侧正确旋转 |

### 7.2 导出验收

| ID | 验收项 | 通过标准 |
| :--- | :--- | :--- |
| **AC-EX-01** | PNG 导出 | 300 DPI，透明背景可选，< 2s |
| **AC-EX-02** | SVG 导出 | 可在 Illustrator 中编辑 |
| **AC-EX-03** | PDF 导出 | A4 模板，含标注和材料清单 |
| **AC-EX-04** | DXF 导出 | AutoCAD 可打开，图层分离 |
| **AC-EX-05** | 批量导出 | 多窗型 ZIP 打包 |

### 7.3 算料引擎验收

| ID | 验收项 | 通过标准 |
| :--- | :--- | :--- |
| **AC-CE-01** | 公式解析 | EBNF 语法全覆盖，优先级正确 |
| **AC-CE-02** | 沙箱隔离 | Web Worker 执行，主线程不阻塞 |
| **AC-CE-03** | 错误处理 | 7 种错误码正确抛出和提示 |
| **AC-CE-04** | 型材算料 | 基础窗型（单扇/两等分/三等分/田字格）结果正确 |
| **AC-CE-05** | 玻璃算料 | 面积计算误差 < 1mm |
| **AC-CE-06** | 五金匹配 | 平开/推拉/内开内倒配置正确 |
| **AC-CE-07** | 性能 | 单窗算料 < 100ms，缓存命中率 > 90% |
| **AC-CE-08** | 材料清单 UI | 数据与算料结果一致，画布修改后 500ms 内更新 |

### 7.4 画布高级功能验收

| ID | 验收项 | 通过标准 |
| :--- | :--- | :--- |
| **AC-ADV-01** | 弧形顶窗 | 弧线平滑，尺寸标注正确 |
| **AC-ADV-02** | 格条渲染 | 40+ 模板可选，正确叠加在玻璃上 |
| **AC-ADV-03** | 多选批量 | 框选 + Ctrl 点选 + 批量删除 |
| **AC-ADV-04** | 版本管理 | 自动快照 + 版本列表 + 回滚 |

---

## 8. 开发注意事项（补充）

### 8.1 Phase 间的依赖关系

- **Phase 2（3D）** 依赖 Phase 1 的 designStore 数据模型，但 3D 渲染组件可以独立开发
- **Phase 3（导出）** 依赖 Phase 1 的画布渲染，PDF 导出中的材料清单部分依赖 Phase 4
- **Phase 4（算料）** 不依赖 Phase 2/3，可以独立开发。但材料清单 UI 需要集成到 Phase 1 的属性面板中
- **Phase 5（高级功能）** 依赖 Phase 1 的画布基础设施

**建议开发顺序：** Phase 1 → Phase 2 → Phase 3（PDF 材料清单部分暂留占位） → Phase 4 → 回填 Phase 3 的 PDF 材料清单 → Phase 5

### 8.2 与前端 B 的协作接口

前端 B 负责公式调试器 UI，需要调用你的算料引擎 API。请在 Phase 4 完成后，确保以下 API 可用：

```typescript
// 前端 B 需要调用的 API
import { evaluateFormula } from '@/lib/calc-engine';

// 单条公式执行（公式调试器用）
const result = await evaluateFormula('W - FW * 2 + 10', { W: 2400, FW: 70 });
// => { result: 2270, trace: [...], error: undefined }
```

### 8.3 性能预算

| 场景 | 指标 | 目标值 |
| :--- | :--- | :--- |
| 2D 画布加载（50 组件） | FCP | < 1.5s |
| 2D 拖拽交互（200 组件） | FPS | > 45 |
| 3D 场景加载 | 耗时 | < 5s |
| PNG 导出（3000×3000px） | 耗时 | < 2s |
| PDF 生成 | 耗时 | < 3s |
| 单窗算料 | 耗时 | < 100ms |
| 内存占用（500 组件） | 峰值 | < 500MB |

### 8.4 不要做的事情（补充）

1. **不要在 3D 渲染中硬编码模型参数** — 所有参数必须从 designStore 数据映射
2. **不要在主线程执行公式** — 必须通过 Web Worker
3. **不要为每种窗型写单独的算料逻辑** — 统一通过公式引擎驱动
4. **不要在导出模块中依赖 DOM** — 导出逻辑应该纯数据驱动，方便后续移到 Worker
5. **不要跳过单元测试** — 算料引擎的正确性是产品生命线

---

## 9. 参考资料

[1] V1.0 任务书. `docs/FRONTEND-BINDOOR-TASK.md`

[2] PRD V6.0 Complete. `docs/PRD_V6_Complete.md`

[3] 技术架构文档 V2.0. `ARCHITECTURE.md`

[4] 画布引擎技术选型报告. `docs/CANVAS-ENGINE-SELECTION.md`

[5] Three.js 官方文档. https://threejs.org/docs/

[6] jsPDF 官方文档. https://github.com/parallax/jsPDF

[7] dxf-writer. https://github.com/ognjen-petrovic/dxf-writer

[8] Konva.js 官方文档. https://konvajs.org/docs/

[9] WindoorFormula DSL 规格. PRD V6.0 第 8.3 节
