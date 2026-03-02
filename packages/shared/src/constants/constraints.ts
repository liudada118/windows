// WindoorDesigner - 边界约束常量
// 前后端共享的校验规则

export const CONSTRAINTS = {
  MIN_OPENING_SIZE: 100,    // 最小分格尺寸 mm
  MIN_MULLION_SPACING: 100, // 中梃最小间距 mm
  MIN_MULLION_EDGE: 100,    // 中梃到边缘最小距离 mm
  MIN_WINDOW_WIDTH: 200,    // 窗户最小宽度 mm
  MIN_WINDOW_HEIGHT: 200,   // 窗户最小高度 mm
  MAX_WINDOW_WIDTH: 6000,   // 窗户最大宽度 mm
  MAX_WINDOW_HEIGHT: 4000,  // 窗户最大高度 mm
  MIN_SASH_WIDTH: 300,      // 开启扇最小宽度 mm
  MIN_SASH_HEIGHT: 400,     // 开启扇最小高度 mm
  MAX_SASH_WIDTH: 1200,     // 开启扇最大宽度 mm
  MAX_SASH_HEIGHT: 2400,    // 开启扇最大高度 mm
} as const;
