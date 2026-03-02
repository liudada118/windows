// WindoorDesigner - 3D 工具函数
// 爆炸视图、增强玻璃材质、UV 映射等

import * as THREE from 'three';

/**
 * 爆炸视图：将 Group 中的子对象沿法线方向分离
 */
export function applyExplodedView(
  group: THREE.Group,
  factor: number, // 0 = 正常, 1 = 完全展开
  center?: THREE.Vector3
): void {
  const c = center || new THREE.Vector3();
  // 计算 group 的 bounding box center
  if (!center) {
    const box = new THREE.Box3().setFromObject(group);
    box.getCenter(c);
  }

  group.children.forEach((child) => {
    if (!child.userData._originalPosition) {
      child.userData._originalPosition = child.position.clone();
    }
    const orig = child.userData._originalPosition as THREE.Vector3;
    const dir = orig.clone().sub(c).normalize();
    const dist = orig.distanceTo(c);
    const explodeDist = dist * factor * 1.5;
    child.position.copy(orig.clone().add(dir.multiplyScalar(explodeDist)));
  });
}

/**
 * 重置爆炸视图
 */
export function resetExplodedView(group: THREE.Group): void {
  group.children.forEach((child) => {
    if (child.userData._originalPosition) {
      child.position.copy(child.userData._originalPosition);
    }
  });
}

/**
 * 创建增强玻璃材质（MeshPhysicalMaterial）
 */
export function createEnhancedGlassMaterial(spec?: string): THREE.MeshPhysicalMaterial {
  // 解析玻璃规格计算厚度，如 "5+12A+5" → 22mm
  let thickness = 0.022; // 默认 22mm
  if (spec) {
    const parts = spec.split('+');
    let total = 0;
    for (const p of parts) {
      const num = parseFloat(p.replace(/[A-Za-z]/g, ''));
      if (!isNaN(num)) total += num;
    }
    if (total > 0) thickness = total * 0.001;
  }

  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#c8e6f0'),
    metalness: 0.0,
    roughness: 0.05,
    transparent: true,
    opacity: 0.25,
    transmission: 0.9,
    thickness: thickness * 1000, // Three.js 使用 world units
    ior: 1.5,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.0,
  });
}

/**
 * 为木纹材质设置 UV 映射（避免拉伸变形）
 */
export function setUVMapping(
  mesh: THREE.Mesh,
  repeatX: number = 1,
  repeatY: number = 1
): void {
  const material = mesh.material as THREE.MeshStandardMaterial;
  if (material.map) {
    material.map.wrapS = THREE.RepeatWrapping;
    material.map.wrapT = THREE.RepeatWrapping;
    material.map.repeat.set(repeatX, repeatY);
  }
}

/**
 * 平滑动画插值
 */
export function smoothStep(from: number, to: number, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return from + (to - from) * (clamped * clamped * (3 - 2 * clamped));
}

/**
 * 创建线框辅助（用于选中高亮）
 */
export function createWireframeHelper(
  object: THREE.Object3D,
  color: number = 0xffaa00
): THREE.Group {
  const wireGroup = new THREE.Group();
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const wireGeo = new THREE.WireframeGeometry(child.geometry);
      const wireMat = new THREE.LineBasicMaterial({ color, linewidth: 1 });
      const wireframe = new THREE.LineSegments(wireGeo, wireMat);
      wireframe.position.copy(child.position);
      wireframe.rotation.copy(child.rotation);
      wireframe.scale.copy(child.scale);
      wireGroup.add(wireframe);
    }
  });
  return wireGroup;
}

/**
 * 安全释放 Three.js 对象
 */
export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}
