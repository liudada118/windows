# 画布引擎技术选型分析报告

> **项目：** 画门窗设计器（WinDoor Designer）
> **版本：** V1.0
> **日期：** 2026-03-02
> **作者：** Manus AI

---

## 1. 背景与问题

当前项目存在一个关键的技术栈冲突：PRD V5 文档中推荐使用 **Konva.js 或 Fabric.js**，画图模块可执行规格书中提到 **Fabric.js**，而实际代码使用的是 **手写 SVG + React JSX**。这一矛盾直接影响团队的开发方向和技术决策。本报告对三种方案进行深度对比分析，结合门窗设计器的具体场景需求，给出明确的选型建议。

---

## 2. 三种方案架构对比

### 2.1 技术架构差异

三种方案在底层渲染机制、对象管理方式和交互模型上存在本质差异。

**Konva.js** 采用场景图（Scene Graph）架构，这是一种在游戏引擎和专业图形软件中广泛使用的设计模式。它将视觉元素组织为层级树形结构，每个节点可以包含子节点并从父节点继承坐标变换。这种架构天然支持门窗设计器中的 Cell 递归分割模型——外框包含中梃，中梃分割出子区域，子区域又可以继续分割。Konva.js 通过 `react-konva` 提供了 React 声明式绑定，开发者可以像编写 React 组件一样操作 Canvas 图形 [1]。

**Fabric.js** 采用对象模型（Object Model）架构，更接近传统图形设计软件的思维方式。所有图形对象以扁平结构存在于 Canvas 级别，每个对象自带选择手柄、变换控制和事件处理能力。这种设计优先考虑即时可用性和直观的交互模式，适合需要快速提供图形编辑能力的应用。但其扁平结构与门窗设计器的树形数据模型存在阻抗不匹配 [2]。

**手写 SVG** 基于 DOM 渲染，每个图形元素都是一个 DOM 节点。SVG 是 W3C 制定的开放标准，与 HTML、CSS、ARIA 等 Web 标准深度集成。在 React 中可以直接用 JSX 编写 SVG 元素，无需任何额外库。但 DOM 的设计初衷并非高性能图形渲染，当元素数量增长时会面临性能瓶颈 [3]。

| 维度 | Konva.js | Fabric.js | 手写 SVG |
| :--- | :--- | :--- | :--- |
| 渲染技术 | HTML5 Canvas（可选 WebGL） | HTML5 Canvas | DOM（SVG 元素） |
| 架构模式 | 场景图（树形层级） | 对象模型（扁平结构） | DOM 树 |
| React 集成 | react-konva（官方声明式绑定） | 无官方绑定，需手动集成 | 原生支持（JSX 直写） |
| 对象管理 | Stage → Layer → Group → Shape | Canvas → Object（扁平） | DOM Tree |
| 坐标变换 | 自动继承父节点变换 | 手动计算 | CSS transform / viewBox |
| 事件系统 | 场景图事件冒泡 | 对象级事件监听 | DOM 事件模型 |

### 2.2 与 Cell 树形数据模型的契合度

门窗设计器的核心数据模型是 **Cell 递归树**：一个窗户由根 Cell 开始，通过水平或垂直分割产生子 Cell，每个子 Cell 可以继续分割或设置为玻璃/开扇。这种树形结构是整个系统的灵魂。

**Konva.js 的场景图与 Cell 树天然对齐。** Stage 对应画布，Layer 对应窗户，Group 对应 Cell 节点，Shape 对应具体的框架线、玻璃填充、标注等。父 Cell 的位置和尺寸变化会自动传递给所有子 Cell，无需手动计算坐标。Konva.js 官方的 Window Frame Designer 示例 [4] 正是使用这种树形结构来表示窗户分格，与我们的 Cell 模型完全一致。

**Fabric.js 的扁平结构需要额外的映射层。** 由于所有对象都在 Canvas 级别，开发者需要自行维护 Cell 树到 Fabric 对象的映射关系。当 Cell 树发生变化（如分割、合并、调整比例）时，需要手动计算每个子对象的新位置和尺寸。虽然 Fabric.js 支持 Group，但其 Group 的嵌套能力和坐标继承不如 Konva.js 的场景图完善。

**手写 SVG 的 DOM 树可以映射 Cell 树，但存在性能隐患。** SVG 的 `<g>` 元素可以嵌套，通过 `transform` 属性实现坐标变换继承。在 React 中可以用递归组件优雅地渲染 Cell 树。但每次 Cell 树变化都会触发 React 的 Virtual DOM diff 和 DOM 更新，当窗型复杂时（如组合窗、整栋楼排布）可能出现性能问题。

---

## 3. 性能分析

### 3.1 渲染性能

性能是选型的关键考量因素。门窗设计器涉及频繁的交互操作（拖拽调整分格、缩放平移、实时标注更新），需要流畅的渲染响应。

**Konva.js** 实现了多项源自游戏引擎的性能优化策略。脏区域检测（Dirty Region Detection）算法精确识别需要重绘的区域，避免整个画布重绘。多层渲染系统允许将静态内容（如外框、标注）和动态内容（如拖拽中的分格线）分离到不同 Layer，静态层缓存为位图，动态层独立更新。批量绘制将多个 Canvas API 调用合并执行，减少 JavaScript 与原生渲染代码之间的上下文切换开销 [1]。

**Fabric.js** 采用同步渲染模型，每次变更都触发完整的画布重绘。内置的交互能力（选择手柄、变换控制）即使在不需要时也会维护事件监听和选择逻辑，带来额外的计算开销。在处理 1000 个以上对象时，性能下降明显 [2]。

**手写 SVG** 在少量元素时性能表现优秀，因为浏览器对 SVG 渲染做了大量优化。但随着元素增加，DOM 操作的开销线性增长。Felt（一款地图编辑器）的工程团队分享了从 SVG 迁移到 Canvas 的实战经验 [5]：当地图包含数千个元素时，React 需要创建、diff、reconcile 和更新大量 DOM 节点，导致缩放时出现视觉闪烁，全选 1000 个元素时需要管理数千个 SVG 和事件处理器。他们最终决定迁移到 Canvas，性能获得了显著提升。

### 3.2 门窗设计器的元素数量估算

评估性能需求需要先估算实际场景中的元素数量。

| 场景 | 元素数量估算 | 性能要求 |
| :--- | :--- | :--- |
| 单个简单窗型（两等分） | 外框 4 + 中梃 1 + 玻璃 2 + 标注 6 + 开启标记 2 ≈ **15 个** | 三种方案均可胜任 |
| 单个复杂窗型（田字格+开扇） | 外框 4 + 中梃 3 + 玻璃 4 + 标注 12 + 开启标记 4 + 五金 4 ≈ **31 个** | 三种方案均可胜任 |
| 组合窗（3-5 个窗型拼接） | 每个窗型 30 × 5 ≈ **150 个** | 三种方案均可胜任 |
| 整栋楼门窗排布（V2.0 需求） | 50 个窗位 × 30 ≈ **1500 个** | SVG 可能出现卡顿 |
| 工厂批量排版（未来需求） | 100+ 窗型同时显示 ≈ **3000+ 个** | 仅 Canvas 方案可胜任 |

从当前 V1.0 的需求来看，三种方案在性能上都能满足。但考虑到 V2.0 的整栋楼排布和未来的工厂批量排版需求，Canvas 方案（Konva.js 或 Fabric.js）具有更好的性能扩展空间。

### 3.3 导出能力

门窗设计器需要将设计图导出为图片或 PDF，用于打印和分享。

**Konva.js** 提供 `stage.toDataURL()` 和 `stage.toBlob()` 方法，可以直接将画布内容导出为 PNG、JPEG 等格式。由于 Canvas 本身就是像素级渲染，导出结果与屏幕显示完全一致。

**Fabric.js** 同样支持 `canvas.toDataURL()` 和 `canvas.toSVG()` 导出。值得注意的是，Fabric.js 还支持导出为 SVG 格式，这在需要矢量输出时是一个优势。

**手写 SVG** 可以直接序列化 SVG DOM 为字符串，天然支持矢量导出。但如果需要导出为位图（PNG/JPEG），则需要借助 `<canvas>` 元素进行转换，过程较为复杂。

---

## 4. 开发效率与生态

### 4.1 学习曲线与开发体验

| 维度 | Konva.js | Fabric.js | 手写 SVG |
| :--- | :--- | :--- | :--- |
| 学习曲线 | 中等（需理解场景图概念） | 低（API 直观，即学即用） | 低（Web 开发者已熟悉） |
| React 集成难度 | 低（react-konva 官方支持） | 高（需手动管理生命周期） | 无（原生支持） |
| TypeScript 支持 | 完善（内置类型定义） | 完善（V6+ 用 TS 重写） | 完善（React SVG 类型） |
| 调试体验 | 中等（Canvas 像素级，需辅助工具） | 中等（同 Canvas） | 优秀（浏览器 DevTools 直接检查） |
| 文档质量 | 优秀（大量示例和教程） | 良好（文档完整但示例较少） | 优秀（MDN + 大量社区资源） |

### 4.2 社区活跃度与维护状态

| 指标 | Konva.js | Fabric.js | 手写 SVG |
| :--- | :--- | :--- | :--- |
| GitHub Stars | 14.1k | ~28k | N/A（Web 标准） |
| NPM 周下载量 | 289k | ~200k | N/A |
| 最近更新 | 2025 年 11 月 | 2026 年 2 月（V7.2） | 持续演进 |
| 核心维护者 | Anton Lavrenov（活跃） | 社区驱动（多位核心贡献者） | W3C 标准组织 |
| 门窗设计示例 | **有**（官方 Window Frame Designer） | 无 | 无 |

Fabric.js 拥有更高的 GitHub Stars，但 Konva.js 的 NPM 周下载量更高，说明 Konva.js 在实际项目中的采用率更高。更关键的是，Konva.js 官方维护了一个完整的 **Window Frame Designer** 示例 [4]，这是一个专门为门窗设计场景制作的 Demo，使用 React + react-konva + MobX，采用树形数据结构表示窗户分格，支持选择分格、水平/垂直分割、设置扇类型等功能——与我们的需求高度吻合。

### 4.3 行业验证

AVADA MEDIA 是一家专业的软件开发公司，他们为门窗行业客户开发了一款 **Interactive 2D Window Configurator** [6]。该配置器的功能与我们的需求几乎完全一致：窗型模板选择、尺寸设置、颜色/覆膜、双层玻璃配置、开启方式设置、自动计算面积/周长/成本。他们的技术选型是 **HTML5 Canvas + Konva.js**，仅用 2 人团队完成开发。这一行业案例进一步验证了 Konva.js 在门窗设计场景中的适用性。

---

## 5. 迁移成本评估

当前项目已经使用手写 SVG 实现了基础功能（画布渲染、模板选择、分格操作、2D/3D 切换等）。迁移到其他方案需要评估改造成本。

### 5.1 从手写 SVG 迁移到 Konva.js

迁移范围主要集中在 `Canvas.tsx` 组件（当前约 350 行）。核心变化是将 SVG 元素替换为 react-konva 组件：

| 当前 SVG 实现 | 迁移后 Konva.js 实现 |
| :--- | :--- |
| `<svg>` 根元素 | `<Stage>` + `<Layer>` |
| `<rect>` 矩形 | `<Rect>` |
| `<line>` 线段 | `<Line>` |
| `<text>` 文本 | `<Text>` |
| `<path>` 路径（开启弧线） | `<Arc>` / `<Path>` |
| `<g>` 分组 | `<Group>` |
| SVG `onClick` 事件 | Konva `onClick` 事件 |
| SVG `transform` | Group `x`, `y`, `rotation` |

**不需要改动的部分：** DesignerContext（状态管理）、types.ts（数据模型）、design-utils.ts（工具函数）、PropertyPanel（属性面板）、TopToolbar（顶部工具栏）、Toolbox（工具箱）、Preview3D（3D 预览）。这些组件与渲染层解耦，不受画布引擎切换影响。

**预估工时：** 3-5 个工作日（1 人），包括 Canvas.tsx 重写、事件处理适配、导出功能适配和测试。

### 5.2 从手写 SVG 迁移到 Fabric.js

Fabric.js 没有官方的 React 绑定，迁移需要额外处理 React 生命周期与 Fabric Canvas 的同步问题。需要在 `useEffect` 中初始化 Fabric Canvas，在 `useRef` 中保持引用，手动处理组件卸载时的清理。此外，Fabric.js 的扁平对象模型与 Cell 树的映射需要编写额外的适配代码。

**预估工时：** 5-8 个工作日（1 人），比 Konva.js 方案多出约 60% 的工作量，主要来自 React 集成和数据模型适配。

---

## 6. 综合评分

基于以上分析，对三种方案进行综合评分（满分 10 分）：

| 评估维度 | 权重 | Konva.js | Fabric.js | 手写 SVG |
| :--- | :--- | :--- | :--- | :--- |
| 数据模型契合度 | 25% | **9.5** | 6.0 | 7.5 |
| 渲染性能与扩展性 | 20% | **9.0** | 8.0 | 6.0 |
| React 集成体验 | 15% | **9.0** | 5.0 | 9.5 |
| 行业验证与示例 | 15% | **10.0** | 5.0 | 3.0 |
| 导出能力 | 10% | 8.5 | **9.0** | 7.0 |
| 学习曲线 | 10% | 7.5 | 8.0 | **9.0** |
| 迁移成本（越低越好） | 5% | 7.0 | 5.0 | **10.0** |
| **加权总分** | **100%** | **9.0** | **6.5** | **7.1** |

---

## 7. 选型建议

### 7.1 推荐方案：Konva.js（react-konva）

综合数据模型契合度、性能扩展性、React 集成体验和行业验证四个关键维度，**Konva.js 是画门窗设计器的最优选择**。核心理由如下：

**第一，场景图架构与 Cell 树天然对齐。** 门窗设计器的核心是 Cell 递归树，Konva.js 的 Stage → Layer → Group → Shape 层级结构可以一一映射到 窗户 → 分区 → Cell → 图形元素。父节点的坐标变换自动传递给子节点，省去了大量手动计算。

**第二，官方有完整的门窗设计器示例。** Konva.js 官方维护的 Window Frame Designer [4] 使用了与我们完全相同的技术方案（React + 树形数据结构 + 分格操作），可以直接作为参考甚至部分复用代码，大幅降低开发风险。

**第三，行业已验证。** AVADA MEDIA 为门窗行业客户开发的 2D 窗户配置器 [6] 选择了 Konva.js，功能覆盖了我们 V1.0 的全部需求，证明了该方案在门窗场景中的可行性和成熟度。

**第四，性能扩展空间充足。** 脏区域检测、多层渲染、批量绘制等优化策略确保了从单个窗型（15 个元素）到整栋楼排布（1500+ 个元素）的性能平滑过渡。

### 7.2 不推荐 Fabric.js 的理由

Fabric.js 虽然社区规模更大（GitHub Stars 更高），但在门窗设计器场景中存在三个关键短板：扁平对象模型与 Cell 树的阻抗不匹配、缺少官方 React 绑定导致集成复杂度高、没有门窗行业的参考示例。这些短板会显著增加开发工时和维护成本。

### 7.3 不推荐继续使用手写 SVG 的理由

手写 SVG 是当前的实现方案，短期内可以继续使用。但从中长期来看，它面临两个风险：一是性能天花板较低，当 V2.0 引入整栋楼排布功能时可能出现卡顿；二是缺乏专业图形库提供的高级能力（如碰撞检测、对象吸附、变换控制器），这些功能在后续迭代中都需要从零实现。

### 7.4 推荐的迁移策略

建议采用 **渐进式迁移** 而非一次性重写：

1. **Sprint 1（第 1 周）：** 安装 `konva` 和 `react-konva`，在一个独立的实验页面中用 Konva.js 复现当前的基础画布功能（外框绘制、分格渲染、点击选中）。
2. **Sprint 1（第 2 周）：** 将实验页面的 Konva 画布替换到主页面，保留 DesignerContext 和所有 UI 组件不变，仅替换 `Canvas.tsx` 的渲染层。
3. **Sprint 2 起：** 在 Konva.js 基础上开发新功能（拖拽调整分格、对象吸附、精确标注），不再在 SVG 方案上投入。

这种策略的优势是风险可控——如果 Konva.js 在实际使用中出现意外问题，可以快速回退到 SVG 方案。

---

## 8. 参考资料

[1] Konva.js 官方文档 - Getting Started with React. https://konvajs.org/docs/react/index.html

[2] Medium - Konva.js vs Fabric.js: In-Depth Technical Comparison. https://medium.com/@www.blog4j.com/konva-js-vs-fabric-js-in-depth-technical-comparison-and-use-case-analysis-9c247968dd0f

[3] JointJS Blog - SVG versus Canvas: Which technology to choose and why? https://www.jointjs.com/blog/svg-versus-canvas

[4] Konva.js 官方示例 - Window Frame Designer. https://konvajs.org/docs/sandbox/Window_Frame_Designer.html

[5] Felt Engineering Blog - From SVG to Canvas: Making Felt Faster. https://felt.com/blog/from-svg-to-canvas-part-1-making-felt-faster

[6] AVADA MEDIA - Interactive 2D Window Configurator. https://avada-media.com/portfolio/2d-window-configurator/
