# ShowcasePage.tsx 修复清单

1. `MATERIAL_PRESETS` 不存在，应该用 `MATERIAL_TYPES`
2. `opening.mullion` 应该是 `opening.mullions` (数组)
3. Opening 类型定义: `mullions: Mullion[]` (复数)
4. Mullion 类型是独立的，不是 Opening 的单数属性
