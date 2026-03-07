# Bug 分析

## 关键发现

1. **组合窗（U形窗、L形窗、凸窗）** 存储在 `designData.compositeWindows` 中
2. **普通窗** 存储在 `designData.windows` 中
3. **ShowcasePage** 只读取 `designData.windows`，完全忽略了 `compositeWindows`
4. 当用户只添加了组合窗时，`windows.length === 0`，所以显示"暂无窗户设计"

## 修复方案

ShowcasePage 需要同时读取 `compositeWindows`，并为组合窗提供专门的展示卡片。
组合窗的 `panels` 数组中每个 panel 都有一个 `windowUnit`，可以用来渲染。
