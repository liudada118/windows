// WindoorDesigner - 3D窗户模型生成器
// 将2D WindowUnit数据模型转换为Three.js 3D几何体
// 工业蓝图美学: 铝合金质感框架 + 半透明玻璃
// 修复: 使用MeshStandardMaterial替代MeshPhysicalMaterial，提高兼容性

import * as THREE from 'three';
import type { WindowUnit, Opening, Frame, SashType } from './types';
import { DEFAULT_PROFILE_SERIES } from './types';

// 材质常量
const SCALE = 0.001; // mm -> Three.js units (1 unit = 1 meter)
const FRAME_DEPTH = 70 * SCALE; // 框架深度 70mm
const GLASS_THICKNESS = 6 * SCALE; // 玻璃厚度 6mm
const SASH_DEPTH = 50 * SCALE; // 扇深度 50mm
const HARDWARE_SIZE = 12 * SCALE; // 五金件尺寸

// 创建铝合金材质 - 使用MeshStandardMaterial提高兼容性
function createAluminumMaterial(color: string = '#B8B8B8'): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: 0.8,
    roughness: 0.3,
    envMapIntensity: 1.0,
  });
}

// 创建玻璃材质 - 简化为透明MeshStandardMaterial
function createGlassMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c8e6f0'),
    metalness: 0.0,
    roughness: 0.1,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false, // 避免透明物体深度冲突
  });
}

// 创建五金件材质
function createHardwareMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4a4a4a'),
    metalness: 0.9,
    roughness: 0.2,
  });
}

// 创建一个矩形框架截面（挤出体）
function createFrameProfile(
  x: number, y: number, width: number, height: number,
  profileWidth: number, depth: number,
  material: THREE.Material
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  const pw = profileWidth * SCALE;
  const d = depth;

  // 四条边框
  const edges = [
    // 上边
    { px: x + width / 2, py: y + height - pw / 2, w: width, h: pw },
    // 下边
    { px: x + width / 2, py: y + pw / 2, w: width, h: pw },
    // 左边
    { px: x + pw / 2, py: y + height / 2, w: pw, h: height - pw * 2 },
    // 右边
    { px: x + width - pw / 2, py: y + height / 2, w: pw, h: height - pw * 2 },
  ];

  for (const edge of edges) {
    const geo = new THREE.BoxGeometry(edge.w, edge.h, d);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(edge.px, edge.py, d / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  return meshes;
}

// 创建中梃/横档
function createMullionMesh(
  opening: Opening,
  offsetX: number,
  offsetY: number,
  mullionWidth: number,
  material: THREE.Material
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  const mw = mullionWidth * SCALE;

  for (const mullion of opening.mullions) {
    let geo: THREE.BoxGeometry;
    let px: number, py: number;

    if (mullion.type === 'vertical') {
      const posX = mullion.position * SCALE;
      geo = new THREE.BoxGeometry(mw, opening.rect.height * SCALE, FRAME_DEPTH);
      px = offsetX + posX;
      py = offsetY + opening.rect.height * SCALE / 2;
    } else {
      const posY = mullion.position * SCALE;
      geo = new THREE.BoxGeometry(opening.rect.width * SCALE, mw, FRAME_DEPTH);
      px = offsetX + opening.rect.width * SCALE / 2;
      py = offsetY + posY;
    }

    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(px, py, FRAME_DEPTH / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  return meshes;
}

// 创建扇的3D模型（包含开启动画角度）
function createSashMesh(
  sash: { type: SashType; rect: { x: number; y: number; width: number; height: number } },
  offsetX: number,
  offsetY: number,
  sashWidth: number,
  material: THREE.Material,
  glassMaterial: THREE.Material,
  hardwareMat: THREE.Material,
  openAngle: number = 0
): THREE.Group {
  const group = new THREE.Group();
  const sw = sashWidth * SCALE;
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

  for (const edge of sashEdges) {
    const geo = new THREE.BoxGeometry(edge.ew, edge.eh, SASH_DEPTH);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(edge.px, edge.py, SASH_DEPTH / 2);
    mesh.castShadow = true;
    group.add(mesh);
  }

  // 玻璃
  const glassW = w - sw * 2;
  const glassH = h - sw * 2;
  if (glassW > 0 && glassH > 0) {
    const glassGeo = new THREE.BoxGeometry(glassW, glassH, GLASS_THICKNESS);
    const glassMesh = new THREE.Mesh(glassGeo, glassMaterial);
    glassMesh.position.set(w / 2, h / 2, SASH_DEPTH / 2);
    group.add(glassMesh);
  }

  // 五金件（把手）
  if (sash.type !== 'fixed') {
    const handleGeo = new THREE.CylinderGeometry(
      HARDWARE_SIZE / 2, HARDWARE_SIZE / 2, HARDWARE_SIZE * 3, 8
    );
    const handleMesh = new THREE.Mesh(handleGeo, hardwareMat);

    if (sash.type === 'casement-left') {
      handleMesh.position.set(w - sw / 2, h / 2, SASH_DEPTH + HARDWARE_SIZE);
      handleMesh.rotation.x = Math.PI / 2;
    } else if (sash.type === 'casement-right') {
      handleMesh.position.set(sw / 2, h / 2, SASH_DEPTH + HARDWARE_SIZE);
      handleMesh.rotation.x = Math.PI / 2;
    } else if (sash.type === 'casement-top') {
      handleMesh.position.set(w / 2, sw / 2, SASH_DEPTH + HARDWARE_SIZE);
      handleMesh.rotation.z = Math.PI / 2;
      handleMesh.rotation.x = Math.PI / 2;
    } else {
      // sliding - handle in center
      handleMesh.position.set(w / 2, h / 2, SASH_DEPTH + HARDWARE_SIZE);
      handleMesh.rotation.x = Math.PI / 2;
    }
    group.add(handleMesh);
  }

  // 设置扇的位置
  group.position.set(
    offsetX + rect.x * SCALE,
    offsetY + rect.y * SCALE,
    0
  );

  // 应用开启角度
  if (openAngle !== 0 && sash.type !== 'fixed') {
    const pivotGroup = new THREE.Group();

    if (sash.type === 'casement-left') {
      // 左开 - 绕左边旋转
      pivotGroup.position.set(
        offsetX + rect.x * SCALE,
        offsetY + rect.y * SCALE,
        0
      );
      group.position.set(0, 0, 0);
      pivotGroup.add(group);
      pivotGroup.rotation.y = -openAngle;
      return pivotGroup;
    } else if (sash.type === 'casement-right') {
      // 右开 - 绕右边旋转
      pivotGroup.position.set(
        offsetX + (rect.x + rect.width) * SCALE,
        offsetY + rect.y * SCALE,
        0
      );
      group.position.set(-w, 0, 0);
      pivotGroup.add(group);
      pivotGroup.rotation.y = openAngle;
      return pivotGroup;
    } else if (sash.type === 'casement-top') {
      // 上悬 - 绕上边旋转
      pivotGroup.position.set(
        offsetX + rect.x * SCALE,
        offsetY + (rect.y + rect.height) * SCALE,
        0
      );
      group.position.set(0, -h, 0);
      pivotGroup.add(group);
      pivotGroup.rotation.x = openAngle;
      return pivotGroup;
    } else if (sash.type === 'sliding-left') {
      // 左推 - X轴平移
      group.position.x -= openAngle * w * 2;
      return group;
    } else if (sash.type === 'sliding-right') {
      // 右推 - X轴平移
      group.position.x += openAngle * w * 2;
      return group;
    }
  }

  return group;
}

// 递归处理Opening树，生成3D模型
function processOpenings(
  openings: Opening[],
  offsetX: number,
  offsetY: number,
  mullionWidth: number,
  sashWidth: number,
  aluminumMat: THREE.Material,
  glassMat: THREE.Material,
  hardwareMat: THREE.Material,
  openAngle: number
): THREE.Group {
  const group = new THREE.Group();

  for (const opening of openings) {
    // 中梃/横档
    const mullionMeshes = createMullionMesh(opening, offsetX, offsetY, mullionWidth, aluminumMat);
    mullionMeshes.forEach(m => group.add(m));

    if (opening.isSplit && opening.childOpenings.length > 0) {
      // 递归处理子分格
      const childGroup = processOpenings(
        opening.childOpenings,
        offsetX,
        offsetY,
        mullionWidth,
        sashWidth,
        aluminumMat,
        glassMat,
        hardwareMat,
        openAngle
      );
      group.add(childGroup);
    } else {
      // 叶子节点 - 添加扇或玻璃
      if (opening.sash) {
        const sashGroup = createSashMesh(
          opening.sash,
          offsetX,
          offsetY,
          sashWidth,
          aluminumMat,
          glassMat,
          hardwareMat,
          openAngle
        );
        group.add(sashGroup);
      } else {
        // 无扇 - 添加纯玻璃
        const r = opening.rect;
        const glassW = r.width * SCALE;
        const glassH = r.height * SCALE;
        if (glassW > 0 && glassH > 0) {
          const glassGeo = new THREE.BoxGeometry(glassW, glassH, GLASS_THICKNESS);
          const glassMesh = new THREE.Mesh(glassGeo, glassMat);
          glassMesh.position.set(
            offsetX + r.x * SCALE + glassW / 2,
            offsetY + r.y * SCALE + glassH / 2,
            FRAME_DEPTH / 2
          );
          group.add(glassMesh);
        }
      }
    }
  }

  return group;
}

// 主函数: 将WindowUnit转换为完整的3D模型
export function createWindow3D(
  windowUnit: WindowUnit,
  openAngle: number = 0
): THREE.Group {
  const group = new THREE.Group();
  group.name = `window-${windowUnit.id}`;

  const series = DEFAULT_PROFILE_SERIES.find(s => s.id === windowUnit.profileSeriesId)
    || DEFAULT_PROFILE_SERIES[2]; // 默认70系列

  const aluminumMat = createAluminumMaterial(series.color);
  const glassMat = createGlassMaterial();
  const hardwareMat = createHardwareMaterial();

  const w = windowUnit.width * SCALE;
  const h = windowUnit.height * SCALE;

  // 外框
  const frameMeshes = createFrameProfile(
    0, 0, w, h,
    series.frameWidth,
    FRAME_DEPTH,
    aluminumMat
  );
  frameMeshes.forEach(m => group.add(m));

  // 处理分格树
  const openingsGroup = processOpenings(
    windowUnit.frame.openings,
    0, 0,
    series.mullionWidth,
    series.sashWidth,
    aluminumMat,
    glassMat,
    hardwareMat,
    openAngle
  );
  group.add(openingsGroup);

  // 居中模型
  group.position.set(-w / 2, -h / 2, 0);

  return group;
}

// 创建场景环境（地面、灯光、天空）- 降低阴影贴图分辨率
export function createSceneEnvironment(scene: THREE.Scene): void {
  // 环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // 稍微增加环境光补偿
  scene.add(ambientLight);

  // 主方向光（模拟阳光）- 降低阴影贴图分辨率
  const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.0);
  sunLight.position.set(3, 5, 4);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024; // 从2048降到1024
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 0.1;
  sunLight.shadow.camera.far = 20;
  sunLight.shadow.camera.left = -5;
  sunLight.shadow.camera.right = 5;
  sunLight.shadow.camera.top = 5;
  sunLight.shadow.camera.bottom = -5;
  scene.add(sunLight);

  // 补光
  const fillLight = new THREE.DirectionalLight(0xb0c4de, 0.4);
  fillLight.position.set(-2, 3, -2);
  scene.add(fillLight);

  // 底部反光
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
  rimLight.position.set(0, -2, 3);
  scene.add(rimLight);

  // 地面
  const groundGeo = new THREE.PlaneGeometry(20, 20);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a35,
    roughness: 0.9,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  // 背景渐变
  scene.background = new THREE.Color(0x1a1a2e);

  // 雾效
  scene.fog = new THREE.FogExp2(0x1a1a2e, 0.15);
}

// 创建墙体背景（让窗户看起来嵌在墙里）
export function createWallBackground(
  windowWidth: number,
  windowHeight: number
): THREE.Group {
  const group = new THREE.Group();
  const w = windowWidth * SCALE;
  const h = windowHeight * SCALE;

  const wallPadding = 0.3; // 墙体比窗户大300mm
  const wallThickness = 0.15; // 墙体厚度150mm
  const wallW = w + wallPadding * 2;
  const wallH = h + wallPadding * 2;

  // 墙体材质
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xd4c8b8,
    roughness: 0.85,
    metalness: 0.0,
  });

  // 上方墙体
  const topGeo = new THREE.BoxGeometry(wallW, wallPadding, wallThickness);
  const topMesh = new THREE.Mesh(topGeo, wallMat);
  topMesh.position.set(0, h / 2 + wallPadding / 2, -wallThickness / 2);
  topMesh.castShadow = true;
  topMesh.receiveShadow = true;
  group.add(topMesh);

  // 下方墙体
  const bottomGeo = new THREE.BoxGeometry(wallW, wallPadding, wallThickness);
  const bottomMesh = new THREE.Mesh(bottomGeo, wallMat);
  bottomMesh.position.set(0, -h / 2 - wallPadding / 2, -wallThickness / 2);
  bottomMesh.castShadow = true;
  bottomMesh.receiveShadow = true;
  group.add(bottomMesh);

  // 左侧墙体
  const leftGeo = new THREE.BoxGeometry(wallPadding, wallH, wallThickness);
  const leftMesh = new THREE.Mesh(leftGeo, wallMat);
  leftMesh.position.set(-w / 2 - wallPadding / 2, 0, -wallThickness / 2);
  leftMesh.castShadow = true;
  leftMesh.receiveShadow = true;
  group.add(leftMesh);

  // 右侧墙体
  const rightGeo = new THREE.BoxGeometry(wallPadding, wallH, wallThickness);
  const rightMesh = new THREE.Mesh(rightGeo, wallMat);
  rightMesh.position.set(w / 2 + wallPadding / 2, 0, -wallThickness / 2);
  rightMesh.castShadow = true;
  rightMesh.receiveShadow = true;
  group.add(rightMesh);

  // 窗台
  const sillGeo = new THREE.BoxGeometry(wallW, 0.03, wallThickness + FRAME_DEPTH + 0.05);
  const sillMat = new THREE.MeshStandardMaterial({
    color: 0xc0b0a0,
    roughness: 0.4,
    metalness: 0.1,
  });
  const sillMesh = new THREE.Mesh(sillGeo, sillMat);
  sillMesh.position.set(0, -h / 2 - 0.015, FRAME_DEPTH / 2 - wallThickness / 2 + 0.025);
  sillMesh.castShadow = true;
  sillMesh.receiveShadow = true;
  group.add(sillMesh);

  return group;
}
