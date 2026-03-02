// WindoorDesigner - 纹理生成与加载模块
// 23种木纹（Perlin Noise程序化生成） + 20+纯色
// 后续可替换为设计师提供的真实贴图

import * as THREE from 'three';

// ===== 纯色列表（20+） =====
export const SOLID_COLORS: Record<string, string> = {
  '纯白': '#FFFFFF',
  '象牙白': '#FFFFF0',
  '米白': '#FAF0E6',
  '奶油白': '#FFFDD0',
  '银灰': '#C0C0C0',
  '太空灰': '#4A4A4A',
  '深灰': '#333333',
  '哑黑': '#1A1A1A',
  '香槟金': '#D4AF37',
  '古铜色': '#B87333',
  '咖啡色': '#6F4E37',
  '深棕': '#3E2723',
  '墨绿': '#004D40',
  '藏蓝': '#003153',
  '酒红': '#722F37',
  '砂纹灰': '#808080',
  '砂纹黑': '#2C2C2C',
  '电泳香槟': '#C8A951',
  '电泳灰': '#6B6B6B',
  '氟碳白': '#F5F5F5',
  '氟碳灰': '#9E9E9E',
  '氟碳黑': '#212121',
};

// ===== 23种木纹定义 =====
export const WOOD_GRAINS: Record<string, { baseColor: string; grainColor: string; density: number }> = {
  '纯白': { baseColor: '#F5F0EB', grainColor: '#E8E0D8', density: 0.3 },
  '瓷泳灰': { baseColor: '#A0A0A0', grainColor: '#888888', density: 0.4 },
  '瓷泳金': { baseColor: '#C8A84E', grainColor: '#A08030', density: 0.5 },
  '红花梨': { baseColor: '#8B3A2F', grainColor: '#6B2A1F', density: 0.7 },
  '肌肤黑': { baseColor: '#2A2A2A', grainColor: '#1A1A1A', density: 0.3 },
  '金橡': { baseColor: '#C8A050', grainColor: '#A07830', density: 0.6 },
  '水晶红': { baseColor: '#B03030', grainColor: '#8B2020', density: 0.5 },
  '香槟': { baseColor: '#D4C090', grainColor: '#B8A070', density: 0.4 },
  '柚木': { baseColor: '#A07840', grainColor: '#806028', density: 0.7 },
  '原木': { baseColor: '#C8A870', grainColor: '#A88850', density: 0.6 },
  '尊贵白': { baseColor: '#F0E8E0', grainColor: '#D8D0C8', density: 0.2 },
  '巴西柚木': { baseColor: '#8B6838', grainColor: '#6B4820', density: 0.8 },
  '白松木': { baseColor: '#E8D8C0', grainColor: '#D0C0A0', density: 0.5 },
  '横纹紫檀': { baseColor: '#4A2028', grainColor: '#301018', density: 0.9 },
  '红橡': { baseColor: '#A06040', grainColor: '#804828', density: 0.7 },
  '金丝楠': { baseColor: '#B89850', grainColor: '#987830', density: 0.6 },
  '沙比利': { baseColor: '#8B5030', grainColor: '#6B3818', density: 0.7 },
  '水曲柳': { baseColor: '#C0A878', grainColor: '#A08858', density: 0.6 },
  '樱桃木': { baseColor: '#A05838', grainColor: '#804020', density: 0.6 },
  '黑胡桃': { baseColor: '#3E2820', grainColor: '#2E1810', density: 0.7 },
  '红木': { baseColor: '#6B2020', grainColor: '#4B1010', density: 0.8 },
  '白橡': { baseColor: '#D8C8A8', grainColor: '#C0B090', density: 0.5 },
  '深胡桃': { baseColor: '#3A2418', grainColor: '#2A1408', density: 0.8 },
};

// ===== Perlin Noise 简化实现 =====
class SimplexNoise {
  private perm: number[] = [];

  constructor(seed: number = 42) {
    const p: number[] = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates shuffle with seed
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    this.perm = [...p, ...p];
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this.fade(xf);
    const v = this.fade(yf);
    const aa = this.perm[this.perm[X] + Y];
    const ab = this.perm[this.perm[X] + Y + 1];
    const ba = this.perm[this.perm[X + 1] + Y];
    const bb = this.perm[this.perm[X + 1] + Y + 1];
    return this.lerp(
      this.lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u),
      this.lerp(this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1), u),
      v
    );
  }
}

// ===== 纹理缓存 =====
const textureCache = new Map<string, THREE.Texture>();

/**
 * 生成程序化木纹纹理（512x512）
 */
export function generateWoodGrainTexture(
  grainName: string,
  size: number = 512
): THREE.Texture {
  const cacheKey = `wood_${grainName}_${size}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const grain = WOOD_GRAINS[grainName];
  if (!grain) {
    // 返回默认纹理
    return generateSolidColorTexture('#B8B8B8');
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // 解析颜色
  const base = hexToRgb(grain.baseColor);
  const grainC = hexToRgb(grain.grainColor);
  const noise = new SimplexNoise(grainName.length * 7 + 31);

  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 多层 noise 模拟木纹
      const nx = x / size;
      const ny = y / size;

      // 主纹理 - 沿 Y 方向拉伸模拟木纹走向
      const n1 = noise.noise2D(nx * 4, ny * 20 * grain.density) * 0.5;
      const n2 = noise.noise2D(nx * 8, ny * 40 * grain.density) * 0.25;
      const n3 = noise.noise2D(nx * 16, ny * 80 * grain.density) * 0.125;

      // 年轮效果
      const ringVal = Math.sin((nx * 10 + n1 * 2) * Math.PI * 2) * 0.3;

      const t = Math.max(0, Math.min(1, 0.5 + n1 + n2 + n3 + ringVal));

      const r = Math.round(base.r + (grainC.r - base.r) * t);
      const g = Math.round(base.g + (grainC.g - base.g) * t);
      const b = Math.round(base.b + (grainC.b - base.b) * t);

      const idx = (y * size + x) * 4;
      data[idx] = Math.max(0, Math.min(255, r));
      data[idx + 1] = Math.max(0, Math.min(255, g));
      data[idx + 2] = Math.max(0, Math.min(255, b));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.needsUpdate = true;

  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 生成纯色纹理
 */
export function generateSolidColorTexture(color: string): THREE.Texture {
  const cacheKey = `solid_${color}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 4;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 4, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 创建带木纹的材质
 */
export function createWoodGrainMaterial(
  grainName: string,
  options?: { metalness?: number; roughness?: number }
): THREE.MeshStandardMaterial {
  const texture = generateWoodGrainTexture(grainName);
  return new THREE.MeshStandardMaterial({
    map: texture,
    metalness: options?.metalness ?? 0.1,
    roughness: options?.roughness ?? 0.7,
    envMapIntensity: 0.5,
  });
}

/**
 * 创建纯色铝合金材质
 */
export function createColorMaterial(
  color: string,
  options?: { metalness?: number; roughness?: number }
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: options?.metalness ?? 0.8,
    roughness: options?.roughness ?? 0.3,
    envMapIntensity: 1.0,
  });
}

/**
 * 根据配置创建框体材质（纯色或木纹）
 */
export function createFrameMaterial(config: {
  type: 'solid' | 'woodgrain';
  colorName?: string;
  colorHex?: string;
  grainName?: string;
}): THREE.MeshStandardMaterial {
  if (config.type === 'woodgrain' && config.grainName) {
    return createWoodGrainMaterial(config.grainName);
  }
  const hex = config.colorHex || SOLID_COLORS[config.colorName || '太空灰'] || '#4A4A4A';
  return createColorMaterial(hex);
}

/**
 * 清除纹理缓存
 */
export function clearTextureCache(): void {
  textureCache.forEach((tex) => tex.dispose());
  textureCache.clear();
}

// ===== 工具函数 =====
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 128, g: 128, b: 128 };
}
