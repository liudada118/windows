// sceneFusion3D.ts — 3D 实景融合核心服务
// 功能: AI窗洞检测 → 窗洞产品绑定 → 3D场景构建（照片映射到3D墙面 + 窗洞放置3D门窗模型）
// 技术: Three.js + OpenAI Vision API

import * as THREE from 'three';
import type { WindowUnit } from './types';
import { DEFAULT_PROFILE_SERIES } from './types';
import { createWindow3DV2 } from './window3d-v2';
import type { MaterialConfig } from './window3d-v2';

// ===== 类型定义 =====

/** 归一化坐标点 (0-1) */
export interface NormalizedPoint {
  x: number;
  y: number;
}

/** 窗洞区域 */
export interface WindowOpening {
  id: string;
  label: string;
  corners: {
    topLeft: NormalizedPoint;
    topRight: NormalizedPoint;
    bottomLeft: NormalizedPoint;
    bottomRight: NormalizedPoint;
  };
  confidence: number;
  estimatedWidth?: number;   // mm
  estimatedHeight?: number;  // mm
}

/** 窗洞绑定的产品 */
export interface OpeningProduct {
  openingId: string;
  windowUnit: WindowUnit | null;  // 绑定的门窗产品，null 表示未选择
  materialConfig?: MaterialConfig;
}

/** 场景分析结果 */
export interface Scene3DAnalysis {
  openings: WindowOpening[];
  sceneDescription: string;
  lightingCondition: 'bright' | 'normal' | 'dim';
  wallMaterial: string;
}

/** 3D 场景配置 */
export interface Scene3DConfig {
  wallWidth: number;    // 墙面宽度 (Three.js units)
  wallHeight: number;   // 墙面高度
  wallDepth: number;    // 墙面厚度
  photoTexture: THREE.Texture | null;
  openings: WindowOpening[];
  products: OpeningProduct[];
  lightIntensity: number;
  ambientIntensity: number;
}

// ===== AI 窗洞检测 =====

const SCENE_3D_ANALYSIS_PROMPT = `你是一个专业的建筑场景分析师。用户会上传一张包含门洞或窗洞的室内/室外照片。

你的任务是：
1. 识别照片中所有的门洞和窗洞的精确位置
2. 返回每个洞口的四角坐标（归一化到 0-1 范围，相对于图片尺寸）
3. 分析场景的光照条件和墙面材质
4. 估算洞口的实际尺寸（如果可能）

坐标说明：
- (0,0) 是图片左上角，(1,1) 是图片右下角
- topLeft: 洞口左上角
- topRight: 洞口右上角
- bottomLeft: 洞口左下角
- bottomRight: 洞口右下角

请严格按照以下 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "openings": [
    {
      "id": "opening_1",
      "label": "描述性名称（如：左侧窗洞、主门洞）",
      "corners": {
        "topLeft": { "x": 0.2, "y": 0.1 },
        "topRight": { "x": 0.8, "y": 0.1 },
        "bottomLeft": { "x": 0.2, "y": 0.9 },
        "bottomRight": { "x": 0.8, "y": 0.9 }
      },
      "confidence": 0.95,
      "estimatedWidth": 1500,
      "estimatedHeight": 1200
    }
  ],
  "sceneDescription": "场景描述",
  "lightingCondition": "bright|normal|dim",
  "wallMaterial": "墙面材质描述"
}`;

/** 调用 OpenAI Vision API 分析场景 */
export async function analyzeScene3D(
  imageBase64: string,
  apiKey: string,
): Promise<Scene3DAnalysis> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: SCENE_3D_ANALYSIS_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  try {
    const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error('AI 返回格式解析失败');
  }
}

/** 演示模式 - 模拟AI检测结果 */
export function mockScene3DAnalysis(): Scene3DAnalysis {
  return {
    openings: [
      {
        id: 'opening_1',
        label: '左侧窗洞',
        corners: {
          topLeft: { x: 0.08, y: 0.15 },
          topRight: { x: 0.35, y: 0.15 },
          bottomLeft: { x: 0.08, y: 0.85 },
          bottomRight: { x: 0.35, y: 0.85 },
        },
        confidence: 0.95,
        estimatedWidth: 1500,
        estimatedHeight: 2000,
      },
      {
        id: 'opening_2',
        label: '中间窗洞',
        corners: {
          topLeft: { x: 0.38, y: 0.12 },
          topRight: { x: 0.62, y: 0.12 },
          bottomLeft: { x: 0.38, y: 0.88 },
          bottomRight: { x: 0.62, y: 0.88 },
        },
        confidence: 0.95,
        estimatedWidth: 1800,
        estimatedHeight: 2200,
      },
      {
        id: 'opening_3',
        label: '右侧窗洞',
        corners: {
          topLeft: { x: 0.65, y: 0.15 },
          topRight: { x: 0.92, y: 0.15 },
          bottomLeft: { x: 0.65, y: 0.85 },
          bottomRight: { x: 0.92, y: 0.85 },
        },
        confidence: 0.93,
        estimatedWidth: 1500,
        estimatedHeight: 2000,
      },
    ],
    sceneDescription: '室内阳台区域，三面为大面积落地窗，外部为高层住宅楼。',
    lightingCondition: 'bright',
    wallMaterial: '白色乳胶漆墙面',
  };
}

// ===== 3D 场景构建 =====

const SCALE = 0.001; // mm -> Three.js units

/**
 * 构建3D实景场景
 * 将照片贴到3D墙面上，在窗洞位置挖空并放入3D门窗模型
 */
export function buildScene3D(
  scene: THREE.Scene,
  config: Scene3DConfig,
): THREE.Group {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'scene-fusion-3d';

  // 1. 创建带照片纹理的墙面（窗洞位置挖空）
  const wallGroup = createPhotoWall(config);
  rootGroup.add(wallGroup);

  // 2. 在每个窗洞位置放入3D门窗模型
  for (const product of config.products) {
    if (!product.windowUnit) continue;

    const opening = config.openings.find(o => o.id === product.openingId);
    if (!opening) continue;

    const windowGroup = createWindowAtOpening(
      opening,
      product.windowUnit,
      config.wallWidth,
      config.wallHeight,
      config.wallDepth,
      product.materialConfig,
    );
    rootGroup.add(windowGroup);
  }

  // 3. 设置场景光照
  setupSceneLighting(scene, config);

  scene.add(rootGroup);
  return rootGroup;
}

/**
 * 创建带照片纹理的3D墙面
 * 照片贴在墙面正面，窗洞位置使用 Shape 挖空
 */
function createPhotoWall(config: Scene3DConfig): THREE.Group {
  const group = new THREE.Group();
  group.name = 'photo-wall';

  const { wallWidth, wallHeight, wallDepth, openings } = config;

  // 创建墙面形状（带窗洞挖空）
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-wallWidth / 2, -wallHeight / 2);
  wallShape.lineTo(wallWidth / 2, -wallHeight / 2);
  wallShape.lineTo(wallWidth / 2, wallHeight / 2);
  wallShape.lineTo(-wallWidth / 2, wallHeight / 2);
  wallShape.closePath();

  // 为每个窗洞创建挖空路径
  for (const opening of openings) {
    const { topLeft, topRight, bottomLeft, bottomRight } = opening.corners;

    // 将归一化坐标转换为3D坐标
    const tlX = (topLeft.x - 0.5) * wallWidth;
    const tlY = (0.5 - topLeft.y) * wallHeight;
    const trX = (topRight.x - 0.5) * wallWidth;
    const trY = (0.5 - topRight.y) * wallHeight;
    const blX = (bottomLeft.x - 0.5) * wallWidth;
    const blY = (0.5 - bottomLeft.y) * wallHeight;
    const brX = (bottomRight.x - 0.5) * wallWidth;
    const brY = (0.5 - bottomRight.y) * wallHeight;

    const hole = new THREE.Path();
    hole.moveTo(tlX, tlY);
    hole.lineTo(trX, trY);
    hole.lineTo(brX, brY);
    hole.lineTo(blX, blY);
    hole.closePath();
    wallShape.holes.push(hole);
  }

  // 挤出墙体
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: wallDepth,
    bevelEnabled: false,
  };
  const wallGeometry = new THREE.ExtrudeGeometry(wallShape, extrudeSettings);

  // 墙面材质 - 正面贴照片纹理，侧面用墙面颜色
  const wallSideMat = new THREE.MeshStandardMaterial({
    color: 0xd4c8b8,
    roughness: 0.85,
    metalness: 0.0,
  });

  let wallFrontMat: THREE.Material;
  if (config.photoTexture) {
    config.photoTexture.colorSpace = THREE.SRGBColorSpace;
    wallFrontMat = new THREE.MeshStandardMaterial({
      map: config.photoTexture,
      roughness: 0.7,
      metalness: 0.0,
    });
  } else {
    wallFrontMat = wallSideMat.clone();
  }

  // ExtrudeGeometry 的材质索引: 0=正面, 1=侧面
  const wallMesh = new THREE.Mesh(wallGeometry, [wallFrontMat, wallSideMat]);
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  // 将墙面定位使正面朝向相机（z=0），墙体向后延伸
  wallMesh.position.z = 0;

  group.add(wallMesh);

  // 为每个窗洞添加洞口内壁
  for (const opening of openings) {
    const innerWall = createOpeningInnerWall(opening, wallWidth, wallHeight, wallDepth);
    group.add(innerWall);
  }

  return group;
}

/**
 * 创建窗洞内壁（洞口四面的内侧面）
 */
function createOpeningInnerWall(
  opening: WindowOpening,
  wallWidth: number,
  wallHeight: number,
  wallDepth: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `inner-wall-${opening.id}`;

  const { topLeft, topRight, bottomLeft, bottomRight } = opening.corners;

  // 转换坐标
  const tlX = (topLeft.x - 0.5) * wallWidth;
  const tlY = (0.5 - topLeft.y) * wallHeight;
  const trX = (topRight.x - 0.5) * wallWidth;
  const trY = (0.5 - topRight.y) * wallHeight;
  const blX = (bottomLeft.x - 0.5) * wallWidth;
  const blY = (0.5 - bottomLeft.y) * wallHeight;
  const brX = (bottomRight.x - 0.5) * wallWidth;
  const brY = (0.5 - bottomRight.y) * wallHeight;

  const innerMat = new THREE.MeshStandardMaterial({
    color: 0xe8e0d4,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  // 上内壁
  const topGeo = new THREE.BufferGeometry();
  const topVerts = new Float32Array([
    tlX, tlY, 0,
    trX, trY, 0,
    trX, trY, wallDepth,
    tlX, tlY, wallDepth,
  ]);
  const topIndices = [0, 1, 2, 0, 2, 3];
  topGeo.setAttribute('position', new THREE.BufferAttribute(topVerts, 3));
  topGeo.setIndex(topIndices);
  topGeo.computeVertexNormals();
  group.add(new THREE.Mesh(topGeo, innerMat));

  // 下内壁
  const bottomGeo = new THREE.BufferGeometry();
  const bottomVerts = new Float32Array([
    blX, blY, 0,
    brX, brY, 0,
    brX, brY, wallDepth,
    blX, blY, wallDepth,
  ]);
  bottomGeo.setAttribute('position', new THREE.BufferAttribute(bottomVerts, 3));
  bottomGeo.setIndex([0, 2, 1, 0, 3, 2]);
  bottomGeo.computeVertexNormals();
  group.add(new THREE.Mesh(bottomGeo, innerMat));

  // 左内壁
  const leftGeo = new THREE.BufferGeometry();
  const leftVerts = new Float32Array([
    tlX, tlY, 0,
    blX, blY, 0,
    blX, blY, wallDepth,
    tlX, tlY, wallDepth,
  ]);
  leftGeo.setAttribute('position', new THREE.BufferAttribute(leftVerts, 3));
  leftGeo.setIndex([0, 2, 1, 0, 3, 2]);
  leftGeo.computeVertexNormals();
  group.add(new THREE.Mesh(leftGeo, innerMat));

  // 右内壁
  const rightGeo = new THREE.BufferGeometry();
  const rightVerts = new Float32Array([
    trX, trY, 0,
    brX, brY, 0,
    brX, brY, wallDepth,
    trX, trY, wallDepth,
  ]);
  rightGeo.setAttribute('position', new THREE.BufferAttribute(rightVerts, 3));
  rightGeo.setIndex([0, 1, 2, 0, 2, 3]);
  rightGeo.computeVertexNormals();
  group.add(new THREE.Mesh(rightGeo, innerMat));

  return group;
}

/**
 * 在窗洞位置创建3D门窗模型
 */
function createWindowAtOpening(
  opening: WindowOpening,
  windowUnit: WindowUnit,
  wallWidth: number,
  wallHeight: number,
  wallDepth: number,
  materialConfig?: MaterialConfig,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `window-at-${opening.id}`;

  // 创建3D门窗模型
  const windowGroup = createWindow3DV2(windowUnit, 0, materialConfig);

  // 计算窗洞的中心位置和尺寸
  const { topLeft, topRight, bottomLeft, bottomRight } = opening.corners;
  const centerX = ((topLeft.x + topRight.x + bottomLeft.x + bottomRight.x) / 4 - 0.5) * wallWidth;
  const centerY = (0.5 - (topLeft.y + topRight.y + bottomLeft.y + bottomRight.y) / 4) * wallHeight;

  // 窗洞宽高
  const openingWidth = ((topRight.x - topLeft.x + bottomRight.x - bottomLeft.x) / 2) * wallWidth;
  const openingHeight = ((bottomLeft.y - topLeft.y + bottomRight.y - topRight.y) / 2) * wallHeight;

  // 门窗模型的原始尺寸
  const windowWidth = windowUnit.width * SCALE;
  const windowHeight = windowUnit.height * SCALE;

  // 缩放门窗模型以适配窗洞
  const scaleX = openingWidth / windowWidth;
  const scaleY = openingHeight / windowHeight;
  const scale = Math.min(scaleX, scaleY);
  windowGroup.scale.set(scale, scale, scale);

  // 定位到窗洞中心，稍微向前偏移（在墙面中间）
  windowGroup.position.set(
    centerX,
    centerY,
    wallDepth * 0.5,
  );

  group.add(windowGroup);
  return group;
}

/**
 * 设置场景光照
 */
function setupSceneLighting(scene: THREE.Scene, config: Scene3DConfig): void {
  // 清除旧灯光
  const oldLights = scene.children.filter(c =>
    c instanceof THREE.Light || c.name === 'scene-lights'
  );
  oldLights.forEach(l => scene.remove(l));

  const lightsGroup = new THREE.Group();
  lightsGroup.name = 'scene-lights';

  // 环境光
  const ambient = new THREE.AmbientLight(0xffffff, config.ambientIntensity);
  lightsGroup.add(ambient);

  // 主光源（模拟阳光）
  const sunLight = new THREE.DirectionalLight(0xfff5e6, config.lightIntensity);
  sunLight.position.set(3, 5, 4);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.1;
  sunLight.shadow.camera.far = 30;
  sunLight.shadow.camera.left = -8;
  sunLight.shadow.camera.right = 8;
  sunLight.shadow.camera.top = 8;
  sunLight.shadow.camera.bottom = -8;
  lightsGroup.add(sunLight);

  // 补光
  const fillLight = new THREE.DirectionalLight(0xb0c4de, config.lightIntensity * 0.4);
  fillLight.position.set(-2, 3, -2);
  lightsGroup.add(fillLight);

  // 背光
  const backLight = new THREE.DirectionalLight(0xffffff, config.lightIntensity * 0.2);
  backLight.position.set(0, 2, -5);
  lightsGroup.add(backLight);

  // 底部反射光
  const bounceLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
  lightsGroup.add(bounceLight);

  scene.add(lightsGroup);
}

/**
 * 加载照片为 Three.js 纹理
 */
export function loadPhotoTexture(photoUrl: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      photoUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        resolve(texture);
      },
      undefined,
      reject,
    );
  });
}

/**
 * 更新单个窗洞的门窗产品
 */
export function updateOpeningWindow(
  scene: THREE.Scene,
  rootGroup: THREE.Group,
  opening: WindowOpening,
  windowUnit: WindowUnit | null,
  wallWidth: number,
  wallHeight: number,
  wallDepth: number,
  materialConfig?: MaterialConfig,
): void {
  // 移除旧的门窗模型
  const oldWindow = rootGroup.getObjectByName(`window-at-${opening.id}`);
  if (oldWindow) {
    rootGroup.remove(oldWindow);
    disposeGroup(oldWindow as THREE.Group);
  }

  // 如果有新产品，创建新的门窗模型
  if (windowUnit) {
    const newWindow = createWindowAtOpening(
      opening,
      windowUnit,
      wallWidth,
      wallHeight,
      wallDepth,
      materialConfig,
    );
    rootGroup.add(newWindow);
  }
}

/**
 * 重建整个墙面（当窗洞位置变化时）
 */
export function rebuildWall(
  rootGroup: THREE.Group,
  config: Scene3DConfig,
): void {
  // 移除旧墙面
  const oldWall = rootGroup.getObjectByName('photo-wall');
  if (oldWall) {
    rootGroup.remove(oldWall);
    disposeGroup(oldWall as THREE.Group);
  }

  // 创建新墙面
  const newWall = createPhotoWall(config);
  rootGroup.add(newWall);
}

/**
 * 释放 Three.js 对象资源
 */
function disposeGroup(group: THREE.Group): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material?.dispose();
      }
    }
  });
}

/**
 * 释放整个场景资源
 */
export function disposeScene3D(scene: THREE.Scene): void {
  const root = scene.getObjectByName('scene-fusion-3d');
  if (root) {
    disposeGroup(root as THREE.Group);
    scene.remove(root);
  }
  const lights = scene.getObjectByName('scene-lights');
  if (lights) scene.remove(lights);
}
