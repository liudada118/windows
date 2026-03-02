// WindoorDesigner - 3D窗户模型生成器 v3.0
// 基于 window3d.ts 重构，增加：
// - 颜色同步（20+ 纯色实时切换）
// - 木纹贴图渲染（23种木纹 UV 映射）
// - 爆炸视图支持（通过 userData 标记各部件类型）
// - 增强玻璃材质（MeshPhysicalMaterial）
// - 部件分组标记（用于爆炸视图分离）

import * as THREE from 'three';
import type { WindowUnit, Opening, SashType, ProfileSeries } from './types';
import { DEFAULT_PROFILE_SERIES } from './types';
import {
  createFrameMaterial,
  createWoodGrainMaterial,
  createColorMaterial,
  SOLID_COLORS,
  WOOD_GRAINS,
} from './textures';
import { createEnhancedGlassMaterial, setUVMapping } from './three-utils';

const SCALE = 0.001;
const GLASS_THICKNESS = 6 * SCALE;
const HARDWARE_SIZE = 12 * SCALE;

// ===== 材质配置接口 =====
export interface MaterialConfig {
  type: 'solid' | 'woodgrain';
  colorName?: string;
  colorHex?: string;
  grainName?: string;
  glassSpec?: string; // 如 "5+12A+5"
}

const DEFAULT_MATERIAL_CONFIG: MaterialConfig = {
  type: 'solid',
  colorHex: '#B8B8B8',
};

// ===== 部件类型标记（用于爆炸视图） =====
type PartType = 'frame' | 'mullion' | 'sash' | 'glass' | 'hardware' | 'wall';

function markPart(obj: THREE.Object3D, partType: PartType, partId?: string): void {
  obj.userData.partType = partType;
  obj.userData.partId = partId || '';
}

// ===== 获取 ProfileSeries =====
function getProfileSeries(profileSeriesId: string): ProfileSeries {
  return DEFAULT_PROFILE_SERIES.find(s => s.id === profileSeriesId) || DEFAULT_PROFILE_SERIES[2];
}

// ===== 创建五金件材质 =====
function createHardwareMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4a4a4a'),
    metalness: 0.9,
    roughness: 0.2,
  });
}

// ===== 创建框架型材 =====
function createFrameProfile(
  x: number, y: number, width: number, height: number,
  profileWidth: number, depth: number,
  material: THREE.Material
): THREE.Group {
  const group = new THREE.Group();
  const pw = profileWidth * SCALE;
  const d = depth * SCALE;

  const edges = [
    { px: x + width / 2, py: y + height - pw / 2, w: width, h: pw, name: 'top' },
    { px: x + width / 2, py: y + pw / 2, w: width, h: pw, name: 'bottom' },
    { px: x + pw / 2, py: y + height / 2, w: pw, h: height - pw * 2, name: 'left' },
    { px: x + width - pw / 2, py: y + height / 2, w: pw, h: height - pw * 2, name: 'right' },
  ];

  for (const edge of edges) {
    const geo = new THREE.BoxGeometry(edge.w, edge.h, d);
    const mesh = new THREE.Mesh(geo, material.clone());
    mesh.position.set(edge.px, edge.py, d / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `frame-${edge.name}`;

    // UV 映射：根据型材尺寸设置 repeat
    if ((material as THREE.MeshStandardMaterial).map) {
      const repeatX = edge.w / (200 * SCALE);
      const repeatY = edge.h / (200 * SCALE);
      setUVMapping(mesh, repeatX, repeatY);
    }

    group.add(mesh);
  }

  markPart(group, 'frame');
  return group;
}

// ===== 创建中梃 =====
function createMullionMeshes(
  opening: Opening,
  offsetX: number,
  offsetY: number,
  mullionWidth: number,
  mullionDepth: number,
  material: THREE.Material
): THREE.Group {
  const group = new THREE.Group();
  const mw = mullionWidth * SCALE;
  const md = mullionDepth * SCALE;

  for (const mullion of opening.mullions) {
    let geo: THREE.BoxGeometry;
    let px: number, py: number;

    if (mullion.type === 'vertical') {
      const posX = mullion.position * SCALE;
      geo = new THREE.BoxGeometry(mw, opening.rect.height * SCALE, md);
      px = offsetX + posX;
      py = offsetY + opening.rect.y * SCALE + opening.rect.height * SCALE / 2;
    } else {
      const posY = mullion.position * SCALE;
      geo = new THREE.BoxGeometry(opening.rect.width * SCALE, mw, md);
      px = offsetX + opening.rect.x * SCALE + opening.rect.width * SCALE / 2;
      py = offsetY + posY;
    }

    const mesh = new THREE.Mesh(geo, material.clone());
    mesh.position.set(px, py, md / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `mullion-${mullion.id}`;
    markPart(mesh, 'mullion', mullion.id);
    group.add(mesh);
  }

  return group;
}

// ===== 创建扇 =====
function createSashMesh(
  sash: { type: SashType; rect: { x: number; y: number; width: number; height: number }; profileWidth?: number },
  offsetX: number,
  offsetY: number,
  sashWidth: number,
  sashDepth: number,
  frameMat: THREE.Material,
  glassMat: THREE.Material,
  hardwareMat: THREE.Material,
  openAngle: number = 0
): THREE.Group {
  const group = new THREE.Group();
  const sw = (sash.profileWidth || sashWidth) * SCALE;
  const sd = sashDepth * SCALE;
  const rect = sash.rect;
  const w = rect.width * SCALE;
  const h = rect.height * SCALE;

  // 扇框架
  const sashEdges = [
    { px: w / 2, py: h - sw / 2, ew: w, eh: sw },
    { px: w / 2, py: sw / 2, ew: w, eh: sw },
    { px: sw / 2, py: h / 2, ew: sw, eh: h - sw * 2 },
    { px: w - sw / 2, py: h / 2, ew: sw, eh: h - sw * 2 },
  ];

  const sashFrameGroup = new THREE.Group();
  for (const edge of sashEdges) {
    const geo = new THREE.BoxGeometry(edge.ew, edge.eh, sd);
    const mesh = new THREE.Mesh(geo, frameMat.clone());
    mesh.position.set(edge.px, edge.py, sd / 2);
    mesh.castShadow = true;
    sashFrameGroup.add(mesh);
  }
  markPart(sashFrameGroup, 'sash');
  group.add(sashFrameGroup);

  // 玻璃
  const glassW = w - sw * 2;
  const glassH = h - sw * 2;
  if (glassW > 0 && glassH > 0) {
    const glassGeo = new THREE.BoxGeometry(glassW, glassH, GLASS_THICKNESS);
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.position.set(w / 2, h / 2, sd / 2);
    glassMesh.name = 'sash-glass';
    markPart(glassMesh, 'glass');
    group.add(glassMesh);
  }

  // 五金件
  if (sash.type !== 'fixed') {
    const handleGeo = new THREE.CylinderGeometry(
      HARDWARE_SIZE / 2, HARDWARE_SIZE / 2, HARDWARE_SIZE * 3, 8
    );
    const handleMesh = new THREE.Mesh(handleGeo, hardwareMat);
    handleMesh.name = 'handle';
    markPart(handleMesh, 'hardware');

    switch (sash.type) {
      case 'casement-left':
      case 'casement-out-left':
      case 'tilt-turn-left':
        handleMesh.position.set(w - sw / 2, h / 2, sd + HARDWARE_SIZE);
        handleMesh.rotation.x = Math.PI / 2;
        break;
      case 'casement-right':
      case 'casement-out-right':
      case 'tilt-turn-right':
        handleMesh.position.set(sw / 2, h / 2, sd + HARDWARE_SIZE);
        handleMesh.rotation.x = Math.PI / 2;
        break;
      case 'casement-top':
        handleMesh.position.set(w / 2, sw / 2, sd + HARDWARE_SIZE);
        handleMesh.rotation.z = Math.PI / 2;
        handleMesh.rotation.x = Math.PI / 2;
        break;
      case 'casement-bottom':
        handleMesh.position.set(w / 2, h - sw / 2, sd + HARDWARE_SIZE);
        handleMesh.rotation.z = Math.PI / 2;
        handleMesh.rotation.x = Math.PI / 2;
        break;
      default:
        handleMesh.position.set(w / 2, h / 2, sd + HARDWARE_SIZE);
        handleMesh.rotation.x = Math.PI / 2;
        break;
    }
    group.add(handleMesh);
  }

  // 设置位置
  group.position.set(offsetX + rect.x * SCALE, offsetY + rect.y * SCALE, 0);

  // 应用开启角度
  if (openAngle !== 0 && sash.type !== 'fixed') {
    const pivotGroup = new THREE.Group();

    switch (sash.type) {
      case 'casement-left':
      case 'tilt-turn-left': {
        pivotGroup.position.set(offsetX + rect.x * SCALE, offsetY + rect.y * SCALE, 0);
        group.position.set(0, 0, 0);
        pivotGroup.add(group);
        pivotGroup.rotation.y = -openAngle;
        return pivotGroup;
      }
      case 'casement-right':
      case 'tilt-turn-right': {
        pivotGroup.position.set(offsetX + (rect.x + rect.width) * SCALE, offsetY + rect.y * SCALE, 0);
        group.position.set(-w, 0, 0);
        pivotGroup.add(group);
        pivotGroup.rotation.y = openAngle;
        return pivotGroup;
      }
      case 'casement-out-left': {
        pivotGroup.position.set(offsetX + rect.x * SCALE, offsetY + rect.y * SCALE, 0);
        group.position.set(0, 0, 0);
        pivotGroup.add(group);
        pivotGroup.rotation.y = openAngle;
        return pivotGroup;
      }
      case 'casement-out-right': {
        pivotGroup.position.set(offsetX + (rect.x + rect.width) * SCALE, offsetY + rect.y * SCALE, 0);
        group.position.set(-w, 0, 0);
        pivotGroup.add(group);
        pivotGroup.rotation.y = -openAngle;
        return pivotGroup;
      }
      case 'casement-top': {
        pivotGroup.position.set(offsetX + rect.x * SCALE, offsetY + (rect.y + rect.height) * SCALE, 0);
        group.position.set(0, -h, 0);
        pivotGroup.add(group);
        pivotGroup.rotation.x = openAngle;
        return pivotGroup;
      }
      case 'casement-bottom': {
        pivotGroup.position.set(offsetX + rect.x * SCALE, offsetY + rect.y * SCALE, 0);
        group.position.set(0, 0, 0);
        pivotGroup.add(group);
        pivotGroup.rotation.x = -openAngle;
        return pivotGroup;
      }
      case 'sliding-left': {
        group.position.x -= openAngle * w * 2;
        return group;
      }
      case 'sliding-right': {
        group.position.x += openAngle * w * 2;
        return group;
      }
      case 'folding-left': {
        pivotGroup.position.set(offsetX + rect.x * SCALE, offsetY + rect.y * SCALE, 0);
        group.position.set(0, 0, 0);
        pivotGroup.add(group);
        pivotGroup.rotation.y = -openAngle * 1.5;
        return pivotGroup;
      }
      case 'folding-right': {
        pivotGroup.position.set(offsetX + (rect.x + rect.width) * SCALE, offsetY + rect.y * SCALE, 0);
        group.position.set(-w, 0, 0);
        pivotGroup.add(group);
        pivotGroup.rotation.y = openAngle * 1.5;
        return pivotGroup;
      }
    }
  }

  return group;
}

// ===== 递归处理 Opening 树 =====
function processOpenings(
  openings: Opening[],
  offsetX: number,
  offsetY: number,
  series: ProfileSeries,
  frameMat: THREE.Material,
  glassMat: THREE.Material,
  hardwareMat: THREE.Material,
  openAngle: number
): THREE.Group {
  const group = new THREE.Group();

  for (const opening of openings) {
    // 中梃
    const mullionGroup = createMullionMeshes(
      opening, offsetX, offsetY,
      series.mullionWidth, series.mullionDepth,
      frameMat
    );
    group.add(mullionGroup);

    if (opening.isSplit && opening.childOpenings.length > 0) {
      const childGroup = processOpenings(
        opening.childOpenings,
        offsetX, offsetY,
        series,
        frameMat, glassMat, hardwareMat,
        openAngle
      );
      group.add(childGroup);
    } else {
      if (opening.sash) {
        const sashGroup = createSashMesh(
          opening.sash,
          offsetX, offsetY,
          series.sashWidth, series.sashDepth,
          frameMat, glassMat, hardwareMat,
          openAngle
        );
        group.add(sashGroup);
      } else {
        // 无扇 - 纯玻璃
        const r = opening.rect;
        const glassW = r.width * SCALE;
        const glassH = r.height * SCALE;
        if (glassW > 0 && glassH > 0) {
          const frameDepth = series.frameDepth * SCALE;
          const glassGeo = new THREE.BoxGeometry(glassW, glassH, GLASS_THICKNESS);
          const glassMesh = new THREE.Mesh(glassGeo, glassMat);
          glassMesh.position.set(
            offsetX + r.x * SCALE + glassW / 2,
            offsetY + r.y * SCALE + glassH / 2,
            frameDepth / 2
          );
          glassMesh.name = `glass-${opening.id}`;
          markPart(glassMesh, 'glass', opening.id);
          group.add(glassMesh);
        }
      }
    }
  }

  return group;
}

// ===== 主函数 v3: 支持材质配置 =====
export function createWindow3DV2(
  windowUnit: WindowUnit,
  openAngle: number = 0,
  materialConfig?: MaterialConfig
): THREE.Group {
  const group = new THREE.Group();
  group.name = `window-${windowUnit.id}`;

  const series = getProfileSeries(windowUnit.profileSeriesId);
  const config = materialConfig || DEFAULT_MATERIAL_CONFIG;

  // 创建材质
  const frameMat = createFrameMaterial({
    type: config.type,
    colorHex: config.colorHex || series.color,
    colorName: config.colorName,
    grainName: config.grainName,
  });
  const glassMat = createEnhancedGlassMaterial(config.glassSpec);
  const hardwareMat = createHardwareMaterial();

  const w = windowUnit.width * SCALE;
  const h = windowUnit.height * SCALE;

  // 外框
  const frameGroup = createFrameProfile(
    0, 0, w, h,
    series.frameWidth,
    series.frameDepth,
    frameMat
  );
  frameGroup.name = 'outer-frame';
  group.add(frameGroup);

  // 处理分格树
  const openingsGroup = processOpenings(
    windowUnit.frame.openings,
    0, 0,
    series,
    frameMat, glassMat, hardwareMat,
    openAngle
  );
  openingsGroup.name = 'openings';
  group.add(openingsGroup);

  // 居中
  group.position.set(-w / 2, -h / 2, 0);

  return group;
}

/**
 * 实时更新材质颜色（不重建几何体）
 */
export function updateMaterialColor(
  windowGroup: THREE.Group,
  config: MaterialConfig
): void {
  const newMat = createFrameMaterial({
    type: config.type,
    colorHex: config.colorHex,
    colorName: config.colorName,
    grainName: config.grainName,
  });

  windowGroup.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const partType = child.userData.partType;
      if (partType === 'frame' || partType === 'mullion' || partType === 'sash') {
        // 释放旧材质
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
        child.material = newMat.clone();
      }
    }
  });
}

/**
 * 获取所有颜色选项
 */
export function getAllColorOptions(): { name: string; hex: string }[] {
  return Object.entries(SOLID_COLORS).map(([name, hex]) => ({ name, hex }));
}

/**
 * 获取所有木纹选项
 */
export function getAllWoodGrainOptions(): string[] {
  return Object.keys(WOOD_GRAINS);
}
