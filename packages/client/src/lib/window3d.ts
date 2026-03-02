// WindoorDesigner - 3D窗户模型生成器 v2.0
// 将2D WindowUnit数据模型转换为Three.js 3D几何体
// 工业蓝图美学: 铝合金质感框架 + 半透明玻璃
// v2.0: 支持所有扇类型、使用ProfileSeries的depth参数、修复硬编码

import * as THREE from 'three';
import type { WindowUnit, Opening, SashType, ProfileSeries } from './types';
import { DEFAULT_PROFILE_SERIES } from './types';

// 材质常量
const SCALE = 0.001; // mm -> Three.js units (1 unit = 1 meter)
const GLASS_THICKNESS = 6 * SCALE; // 玻璃厚度 6mm
const HARDWARE_SIZE = 12 * SCALE; // 五金件尺寸

// 获取ProfileSeries
function getProfileSeries(profileSeriesId: string): ProfileSeries {
  return DEFAULT_PROFILE_SERIES.find(s => s.id === profileSeriesId) || DEFAULT_PROFILE_SERIES[2];
}

// 创建铝合金材质
function createAluminumMaterial(color: string = '#B8B8B8'): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: 0.8,
    roughness: 0.3,
    envMapIntensity: 1.0,
  });
}

// 创建玻璃材质
function createGlassMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c8e6f0'),
    metalness: 0.0,
    roughness: 0.1,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
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
  const d = depth * SCALE;

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
  mullionDepth: number,
  material: THREE.Material
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
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

    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(px, py, md / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  return meshes;
}

// 创建扇的3D模型（支持所有扇类型）
function createSashMesh(
  sash: { type: SashType; rect: { x: number; y: number; width: number; height: number }; profileWidth?: number },
  offsetX: number,
  offsetY: number,
  sashWidth: number,
  sashDepth: number,
  material: THREE.Material,
  glassMaterial: THREE.Material,
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

  for (const edge of sashEdges) {
    const geo = new THREE.BoxGeometry(edge.ew, edge.eh, sd);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(edge.px, edge.py, sd / 2);
    mesh.castShadow = true;
    group.add(mesh);
  }

  // 玻璃
  const glassW = w - sw * 2;
  const glassH = h - sw * 2;
  if (glassW > 0 && glassH > 0) {
    const glassGeo = new THREE.BoxGeometry(glassW, glassH, GLASS_THICKNESS);
    const glassMesh = new THREE.Mesh(glassGeo, glassMaterial);
    glassMesh.position.set(w / 2, h / 2, sd / 2);
    group.add(glassMesh);
  }

  // 五金件（把手）- 根据扇类型放置
  if (sash.type !== 'fixed') {
    const handleGeo = new THREE.CylinderGeometry(
      HARDWARE_SIZE / 2, HARDWARE_SIZE / 2, HARDWARE_SIZE * 3, 8
    );
    const handleMesh = new THREE.Mesh(handleGeo, hardwareMat);

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
        // sliding, folding - handle in center
        handleMesh.position.set(w / 2, h / 2, sd + HARDWARE_SIZE);
        handleMesh.rotation.x = Math.PI / 2;
        break;
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

    switch (sash.type) {
      case 'casement-left':
      case 'tilt-turn-left': {
        // 左开 - 绕左边旋转
        pivotGroup.position.set(offsetX + rect.x * SCALE, offsetY + rect.y * SCALE, 0);
        group.position.set(0, 0, 0);
        pivotGroup.add(group);
        pivotGroup.rotation.y = -openAngle;
        return pivotGroup;
      }
      case 'casement-right':
      case 'tilt-turn-right': {
        // 右开 - 绕右边旋转
        pivotGroup.position.set(offsetX + (rect.x + rect.width) * SCALE, offsetY + rect.y * SCALE, 0);
        group.position.set(-w, 0, 0);
        pivotGroup.add(group);
        pivotGroup.rotation.y = openAngle;
        return pivotGroup;
      }
      case 'casement-out-left': {
        // 外开左 - 绕左边向外旋转
        pivotGroup.position.set(offsetX + rect.x * SCALE, offsetY + rect.y * SCALE, 0);
        group.position.set(0, 0, 0);
        pivotGroup.add(group);
        pivotGroup.rotation.y = openAngle; // 正方向=外开
        return pivotGroup;
      }
      case 'casement-out-right': {
        // 外开右 - 绕右边向外旋转
        pivotGroup.position.set(offsetX + (rect.x + rect.width) * SCALE, offsetY + rect.y * SCALE, 0);
        group.position.set(-w, 0, 0);
        pivotGroup.add(group);
        pivotGroup.rotation.y = -openAngle;
        return pivotGroup;
      }
      case 'casement-top': {
        // 上悬 - 绕上边旋转
        pivotGroup.position.set(offsetX + rect.x * SCALE, offsetY + (rect.y + rect.height) * SCALE, 0);
        group.position.set(0, -h, 0);
        pivotGroup.add(group);
        pivotGroup.rotation.x = openAngle;
        return pivotGroup;
      }
      case 'casement-bottom': {
        // 下悬 - 绕下边旋转
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
        // 折叠 - 绕左边旋转 + 缩放模拟折叠
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

// 递归处理Opening树，生成3D模型
function processOpenings(
  openings: Opening[],
  offsetX: number,
  offsetY: number,
  series: ProfileSeries,
  aluminumMat: THREE.Material,
  glassMat: THREE.Material,
  hardwareMat: THREE.Material,
  openAngle: number
): THREE.Group {
  const group = new THREE.Group();

  for (const opening of openings) {
    // 中梃/横档
    const mullionMeshes = createMullionMesh(
      opening, offsetX, offsetY,
      series.mullionWidth, series.mullionDepth,
      aluminumMat
    );
    mullionMeshes.forEach(m => group.add(m));

    if (opening.isSplit && opening.childOpenings.length > 0) {
      const childGroup = processOpenings(
        opening.childOpenings,
        offsetX, offsetY,
        series,
        aluminumMat, glassMat, hardwareMat,
        openAngle
      );
      group.add(childGroup);
    } else {
      if (opening.sash) {
        const sashGroup = createSashMesh(
          opening.sash,
          offsetX, offsetY,
          series.sashWidth, series.sashDepth,
          aluminumMat, glassMat, hardwareMat,
          openAngle
        );
        group.add(sashGroup);
      } else {
        // 无扇 - 添加纯玻璃
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

  const series = getProfileSeries(windowUnit.profileSeriesId);

  const aluminumMat = createAluminumMaterial(series.color);
  const glassMat = createGlassMaterial();
  const hardwareMat = createHardwareMaterial();

  const w = windowUnit.width * SCALE;
  const h = windowUnit.height * SCALE;

  // 外框 - 使用series.frameDepth
  const frameMeshes = createFrameProfile(
    0, 0, w, h,
    series.frameWidth,
    series.frameDepth,
    aluminumMat
  );
  frameMeshes.forEach(m => group.add(m));

  // 处理分格树
  const openingsGroup = processOpenings(
    windowUnit.frame.openings,
    0, 0,
    series,
    aluminumMat, glassMat, hardwareMat,
    openAngle
  );
  group.add(openingsGroup);

  // 居中模型
  group.position.set(-w / 2, -h / 2, 0);

  return group;
}

// 创建场景环境（地面、灯光、天空）
export function createSceneEnvironment(scene: THREE.Scene): void {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.0);
  sunLight.position.set(3, 5, 4);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 0.1;
  sunLight.shadow.camera.far = 20;
  sunLight.shadow.camera.left = -5;
  sunLight.shadow.camera.right = 5;
  sunLight.shadow.camera.top = 5;
  sunLight.shadow.camera.bottom = -5;
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0xb0c4de, 0.4);
  fillLight.position.set(-2, 3, -2);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
  rimLight.position.set(0, -2, 3);
  scene.add(rimLight);

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

  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.FogExp2(0x1a1a2e, 0.15);
}

// 创建墙体背景
export function createWallBackground(
  windowWidth: number,
  windowHeight: number,
  frameDepth: number = 70
): THREE.Group {
  const group = new THREE.Group();
  const w = windowWidth * SCALE;
  const h = windowHeight * SCALE;
  const fd = frameDepth * SCALE;

  const wallPadding = 0.3;
  const wallThickness = 0.15;
  const wallW = w + wallPadding * 2;
  const wallH = h + wallPadding * 2;

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
  const sillGeo = new THREE.BoxGeometry(wallW, 0.03, wallThickness + fd + 0.05);
  const sillMat = new THREE.MeshStandardMaterial({
    color: 0xc0b0a0,
    roughness: 0.4,
    metalness: 0.1,
  });
  const sillMesh = new THREE.Mesh(sillGeo, sillMat);
  sillMesh.position.set(0, -h / 2 - 0.015, fd / 2 - wallThickness / 2 + 0.025);
  sillMesh.castShadow = true;
  sillMesh.receiveShadow = true;
  group.add(sillMesh);

  return group;
}
