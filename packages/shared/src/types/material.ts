// WindoorDesigner - 物料类型定义
// 型材、五金、玻璃等物料相关类型

export interface MaterialCategory {
  id: string;
  name: string;
  parentId: string | null;
}

export interface GlassSpec {
  id: string;
  name: string;
  structure: string;      // e.g. "5+12A+5"
  thickness: number;       // 总厚度 mm
  uValue: number;          // 传热系数 W/(m²·K)
  pricePerSqm: number;    // 元/m²
}

export interface HardwareItem {
  id: string;
  name: string;
  brand: string;
  model: string;
  type: 'handle' | 'hinge' | 'lock_point' | 'friction_stay' | 'seal' | 'other';
  unit: string;            // 计量单位
  pricePerUnit: number;
}

export interface SealStrip {
  id: string;
  name: string;
  material: 'EPDM' | 'TPE' | 'silicone';
  pricePerMeter: number;
}
