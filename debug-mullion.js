// 模拟数据结构来理解问题
// 场景：一个 1500x1500 的窗户，框宽 60mm
// 添加第一根竖向中梃在 x=500
// 然后在右侧子分格添加第二根竖向中梃在 x=1000

// 初始状态：
// rootOpening: { rect: {x:60, y:60, w:1380, h:1380}, mullions: [], childOpenings: [] }

// 添加第一根中梃后（splitOpening）：
// rootOpening: {
//   rect: {x:60, y:60, w:1380, h:1380},
//   isSplit: true,
//   mullions: [{ id: 'm1', type: 'vertical', position: 500, profileWidth: 40 }],
//   childOpenings: [
//     { id: 'c1', rect: {x:60, y:60, w:420, h:1380} },  // 500 - 60 - 20 = 420
//     { id: 'c2', rect: {x:520, y:60, w:920, h:1380} },  // 60 + 1380 - 500 - 20 = 920
//   ]
// }

// 添加第二根中梃后（在 c2 中 splitOpening）：
// rootOpening: {
//   rect: {x:60, y:60, w:1380, h:1380},
//   isSplit: true,
//   mullions: [{ id: 'm1', type: 'vertical', position: 500 }],
//   childOpenings: [
//     { id: 'c1', rect: {x:60, y:60, w:420, h:1380} },
//     { id: 'c2', rect: {x:520, y:60, w:920, h:1380}, isSplit: true,
//       mullions: [{ id: 'm2', type: 'vertical', position: 1000 }],
//       childOpenings: [
//         { id: 'c3', rect: {x:520, y:60, w:460, h:1380} },  // 1000 - 520 - 20 = 460
//         { id: 'c4', rect: {x:1020, y:60, w:420, h:1380} }, // 520 + 920 - 1000 - 20 = 420
//       ]
//     }
//   ]
// }

// 现在拖拽 m2 到 position=800：
// updateMullionPositionInTree 在 rootOpening 层找不到 m2
// 递归进入 childOpenings，在 c2 中找到 m2
// 更新 m2.position = 800
// 重新计算 c2 的 childOpenings：
//   c3: {x:520, y:60, w:260, h:1380}  // 800 - 520 - 20 = 260
//   c4: {x:820, y:60, w:620, h:1380}  // 520 + 920 - 800 - 20 = 620
// 
// 关键：m1 的 position 不会变！因为 m1 在 rootOpening 层，
// 而 updateMullionPositionInTree 只更新了 c2 的内容。

// 所以数据层面应该是正确的。问题可能在渲染层。

// 让我检查 MullionRenderer 的渲染逻辑：
// mullion.position 是绝对坐标（相对于窗户左上角）
// MullionRenderer 中：
//   x = mullion.position * scale - halfWidth
//   y = parentRect.y * scale
// 
// 对于 m1: x = 500 * scale - halfWidth, parentRect = rootOpening.rect
// 对于 m2: x = 1000 * scale - halfWidth, parentRect = c2.rect
//
// 这看起来也是对的...

// 等等！问题可能是：当用户在一个窗户上添加两根中梃时，
// 如果两根中梃都在同一层级（rootOpening），而不是嵌套的！
// 
// 当前的 splitOpening 只支持二分法，每次分割只产生 2 个子 Opening。
// 如果用户在根 Opening 添加第一根中梃后，
// 想在根 Opening 的某个子 Opening 中添加第二根中梃，
// 那是嵌套结构。
//
// 但如果用户想在同一层级添加两根平行中梃呢？
// 当前实现是：第二根中梃会在第一根中梃产生的某个 childOpening 中添加。
// 这是正确的嵌套行为。
//
// 问题可能是：updateMullionPositionInTree 在更新嵌套中梃时，
// 调用了 resizeOpeningRecursive 来更新子 Opening 的 rect。
// 但它不应该影响父级的中梃。

// 让我重新审视 updateMullionPositionInTree：
// 当拖拽 m2 时：
// 1. 遍历 rootOpening.mullions → 找不到 m2
// 2. 递归进入 rootOpening.childOpenings
// 3. 在 c1 中找不到 m2
// 4. 在 c2 中找到 m2（c2.mullions 包含 m2）
// 5. 更新 m2.position，重新计算 c2 的 childOpenings
// 6. 返回更新后的 c2
// 7. rootOpening 的 childOpenings 被更新为 [c1, updated_c2]
// 8. rootOpening 的 mullions（包含 m1）不变

// 这看起来是正确的！m1 不应该移动。

// 除非... 问题出在 moveMullion 的 store action 中？
console.log("数据结构分析完成 - 需要在浏览器中实际调试");
