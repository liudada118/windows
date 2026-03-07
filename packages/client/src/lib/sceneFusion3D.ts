// sceneFusion3D.ts — 3D 实景融合核心服务 V3
// 方案: 构建真正的3D房间场景
// - 创建3D墙体（有厚度），照片作为正面墙面纹理
// - 在墙体上根据窗洞坐标挖洞（Shape + Holes）
// - 窗洞中放入真实的3D门窗模型
// - 添加地面增强空间感
// - 支持 OrbitControls 旋转缩放查看
// - 透视相机提供真实3D纵深感

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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
  windowUnit: WindowUnit | null;
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
  wallWidth: number;
  wallHeight: number;
  wallDepth: number;
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
        label: '正面窗洞',
        corners: {
          topLeft: { x: 0.15, y: 0.20 },
          topRight: { x: 0.85, y: 0.20 },
          bottomLeft: { x: 0.15, y: 0.75 },
          bottomRight: { x: 0.85, y: 0.75 },
        },
        confidence: 0.95,
        estimatedWidth: 1875,
        estimatedHeight: 1535,
      },
    ],
    sceneDescription: '室内厨房场景，面向外部建筑。',
    lightingCondition: 'bright',
    wallMaterial: '水泥毛坯墙面',
  };
}

// ===== 3D 场景构建 V3 — 真正的3D房间 =====

// 墙体尺寸（Three.js 单位，1 unit = 1 meter）
const WALL_DEPTH = 0.25; // 墙厚 250mm

/**
 * SceneBuilder — 构建真正的3D房间场景
 * 
 * 核心思路:
 * 1. 根据照片宽高比创建一面3D墙体（有厚度）
 * 2. 照片作为墙体正面的纹理贴图
 * 3. 根据窗洞归一化坐标在墙体上挖洞（使用 THREE.Shape + Path holes）
 * 4. 在窗洞位置放入真实的3D门窗模型
 * 5. 添加地面、环境光照
 * 6. 使用透视相机 + OrbitControls 实现旋转缩放
 */
export class SceneBuilder {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;

  // 墙体参数
  wallWidth = 4;   // 默认4米宽
  wallHeight = 3;  // 默认3米高
  photoAspect = 1;

  // 场景对象引用
  wallGroup: THREE.Group;
  windowsGroup: THREE.Group;
  lightsGroup: THREE.Group;
  environmentGroup: THREE.Group;

  // 当前窗洞数据
  private currentOpenings: WindowOpening[] = [];
  private photoTexture: THREE.Texture | null = null;

  constructor(container: HTMLElement) {
    const w = container.clientWidth;
    const h = container.clientHeight;

    // 场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 8, 20);

    // 透视相机
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 100);
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(0, 0, 0);

    // 渲染器
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // OrbitControls — 旋转缩放平移
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 15;
    this.controls.maxPolarAngle = Math.PI * 0.85;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    // 场景组
    this.wallGroup = new THREE.Group();
    this.wallGroup.name = 'wall-group';
    this.scene.add(this.wallGroup);

    this.windowsGroup = new THREE.Group();
    this.windowsGroup.name = 'windows-group';
    this.scene.add(this.windowsGroup);

    this.lightsGroup = new THREE.Group();
    this.lightsGroup.name = 'lights-group';
    this.scene.add(this.lightsGroup);

    this.environmentGroup = new THREE.Group();
    this.environmentGroup.name = 'environment-group';
    this.scene.add(this.environmentGroup);

    // 初始化光照和环境
    this.setupLighting(1.0);
    this.setupEnvironment();
  }

  /** 设置照片纹理并根据照片比例确定墙体尺寸 */
  setPhoto(texture: THREE.Texture): void {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    this.photoTexture = texture;

    const img = texture.image as HTMLImageElement;
    this.photoAspect = img.width / img.height;

    // 根据照片比例确定墙体尺寸
    // 保持墙高 3m，根据照片比例计算墙宽
    this.wallHeight = 3;
    this.wallWidth = this.wallHeight * this.photoAspect;

    // 更新相机位置
    const dist = Math.max(this.wallWidth, this.wallHeight) * 1.2;
    this.camera.position.set(0, 0, dist);
    this.controls.target.set(0, this.wallHeight * 0.1, 0);
    this.controls.update();
  }

  /** 构建墙体（带窗洞） */
  buildWall(openings: WindowOpening[]): void {
    this.currentOpenings = openings;

    // 清除旧墙体
    disposeGroup(this.wallGroup);
    this.wallGroup.clear();

    const W = this.wallWidth;
    const H = this.wallHeight;
    const D = WALL_DEPTH;

    // 1. 创建墙体正面形状（带窗洞）
    const wallShape = new THREE.Shape();
    wallShape.moveTo(-W / 2, -H / 2);
    wallShape.lineTo(W / 2, -H / 2);
    wallShape.lineTo(W / 2, H / 2);
    wallShape.lineTo(-W / 2, H / 2);
    wallShape.closePath();

    // 在墙体上挖窗洞
    for (const opening of openings) {
      const hole = this.openingToHolePath(opening);
      wallShape.holes.push(hole);
    }

    // 2. 挤出成3D墙体
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: D,
      bevelEnabled: false,
    };
    const wallGeometry = new THREE.ExtrudeGeometry(wallShape, extrudeSettings);

    // 设置UV映射 — 让照片正确贴到墙体正面
    this.setupWallUV(wallGeometry, W, H);

    // 3. 墙体材质
    // 正面用照片纹理，侧面和背面用灰色水泥材质
    const photoMat = new THREE.MeshStandardMaterial({
      map: this.photoTexture,
      roughness: 0.9,
      metalness: 0.0,
    });

    const cementMat = new THREE.MeshStandardMaterial({
      color: 0x8a8a8a,
      roughness: 0.95,
      metalness: 0.0,
    });

    // ExtrudeGeometry 有多个材质组: 0=正面, 1=背面, 2=侧面
    // 但实际上 ExtrudeGeometry 只有 2 个组: 0=正面+背面, 1=侧面
    wallGeometry.clearGroups();
    // 需要手动分组
    const posAttr = wallGeometry.getAttribute('position');
    const normalAttr = wallGeometry.getAttribute('normal');
    const indexAttr = wallGeometry.index;

    // 简化：使用单一材质数组
    // group 0 = 挤出面（正面+背面）, group 1 = 侧面
    // Three.js ExtrudeGeometry 默认: group 0 = 正面+背面面片, group 1 = 侧面面片
    const wallMesh = new THREE.Mesh(wallGeometry, [photoMat, cementMat]);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    // 墙体正面朝向 -Z 方向（面向相机）
    wallMesh.position.set(0, 0, D / 2);
    wallMesh.rotation.y = Math.PI; // 翻转使正面朝向相机

    this.wallGroup.add(wallMesh);

    // 4. 窗洞内壁（给窗洞加上内壁面，增加深度感）
    for (const opening of openings) {
      const innerWall = this.createOpeningInnerWall(opening, D);
      this.wallGroup.add(innerWall);
    }
  }

  /** 将归一化坐标转换为墙体上的洞口路径 */
  private openingToHolePath(opening: WindowOpening): THREE.Path {
    const W = this.wallWidth;
    const H = this.wallHeight;
    const { topLeft, topRight, bottomLeft, bottomRight } = opening.corners;

    // 归一化坐标 → 墙体坐标
    // 归一化: (0,0)=左上, (1,1)=右下
    // 墙体: 中心在原点, x: [-W/2, W/2], y: [-H/2, H/2]
    const toWallX = (nx: number) => (nx - 0.5) * W;
    const toWallY = (ny: number) => (0.5 - ny) * H; // y翻转

    const margin = 0.02; // 内缩一点避免边缘问题

    const x1 = toWallX(Math.min(topLeft.x, bottomLeft.x) + margin);
    const x2 = toWallX(Math.max(topRight.x, bottomRight.x) - margin);
    const y1 = toWallY(Math.max(bottomLeft.y, bottomRight.y) - margin); // bottom → 低y
    const y2 = toWallY(Math.min(topLeft.y, topRight.y) + margin);       // top → 高y

    const hole = new THREE.Path();
    hole.moveTo(x1, y1);
    hole.lineTo(x2, y1);
    hole.lineTo(x2, y2);
    hole.lineTo(x1, y2);
    hole.closePath();

    return hole;
  }

  /** 设置墙体UV映射（让照片正确贴到正面） */
  private setupWallUV(geometry: THREE.ExtrudeGeometry, W: number, H: number): void {
    const uv = geometry.getAttribute('uv');
    const pos = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');

    if (!uv || !pos || !normal) return;

    for (let i = 0; i < uv.count; i++) {
      const nx = normal.getX(i);
      const ny = normal.getY(i);
      const nz = normal.getZ(i);
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);

      // 正面和背面（法线朝 Z 方向）
      if (Math.abs(nz) > 0.5) {
        // 将墙体坐标映射到 UV [0,1]
        const u = (px / W) + 0.5;
        const v = (py / H) + 0.5;
        uv.setXY(i, u, v);
      }
      // 侧面保持默认 UV
    }
    uv.needsUpdate = true;
  }

  /** 创建窗洞内壁 */
  private createOpeningInnerWall(opening: WindowOpening, depth: number): THREE.Group {
    const group = new THREE.Group();
    const W = this.wallWidth;
    const H = this.wallHeight;
    const { topLeft, topRight, bottomLeft, bottomRight } = opening.corners;

    const margin = 0.02;
    const toWallX = (nx: number) => (nx - 0.5) * W;
    const toWallY = (ny: number) => (0.5 - ny) * H;

    const x1 = toWallX(Math.min(topLeft.x, bottomLeft.x) + margin);
    const x2 = toWallX(Math.max(topRight.x, bottomRight.x) - margin);
    const y1 = toWallY(Math.max(bottomLeft.y, bottomRight.y) - margin);
    const y2 = toWallY(Math.min(topLeft.y, topRight.y) + margin);

    const openW = x2 - x1;
    const openH = y2 - y1;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x6a6a6a,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    // 上内壁
    const topGeo = new THREE.PlaneGeometry(openW, depth);
    const topMesh = new THREE.Mesh(topGeo, innerMat);
    topMesh.position.set(cx, y2, 0);
    topMesh.rotation.x = Math.PI / 2;
    topMesh.receiveShadow = true;
    group.add(topMesh);

    // 下内壁
    const bottomGeo = new THREE.PlaneGeometry(openW, depth);
    const bottomMesh = new THREE.Mesh(bottomGeo, innerMat);
    bottomMesh.position.set(cx, y1, 0);
    bottomMesh.rotation.x = -Math.PI / 2;
    bottomMesh.receiveShadow = true;
    group.add(bottomMesh);

    // 左内壁
    const leftGeo = new THREE.PlaneGeometry(depth, openH);
    const leftMesh = new THREE.Mesh(leftGeo, innerMat);
    leftMesh.position.set(x1, cy, 0);
    leftMesh.rotation.y = Math.PI / 2;
    leftMesh.receiveShadow = true;
    group.add(leftMesh);

    // 右内壁
    const rightGeo = new THREE.PlaneGeometry(depth, openH);
    const rightMesh = new THREE.Mesh(rightGeo, innerMat);
    rightMesh.position.set(x2, cy, 0);
    rightMesh.rotation.y = -Math.PI / 2;
    rightMesh.receiveShadow = true;
    group.add(rightMesh);

    return group;
  }

  /** 在窗洞位置放入3D门窗模型 */
  addWindowAtOpening(
    opening: WindowOpening,
    windowUnit: WindowUnit,
    materialConfig?: MaterialConfig,
  ): void {
    // 移除旧的
    const old = this.windowsGroup.getObjectByName(`window-${opening.id}`);
    if (old) {
      this.windowsGroup.remove(old);
      disposeGroup(old);
    }

    const W = this.wallWidth;
    const H = this.wallHeight;
    const { topLeft, topRight, bottomLeft, bottomRight } = opening.corners;

    const margin = 0.02;
    const toWallX = (nx: number) => (nx - 0.5) * W;
    const toWallY = (ny: number) => (0.5 - ny) * H;

    const x1 = toWallX(Math.min(topLeft.x, bottomLeft.x) + margin);
    const x2 = toWallX(Math.max(topRight.x, bottomRight.x) - margin);
    const y1 = toWallY(Math.max(bottomLeft.y, bottomRight.y) - margin);
    const y2 = toWallY(Math.min(topLeft.y, topRight.y) + margin);

    const openW = x2 - x1;
    const openH = y2 - y1;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    // 创建3D门窗模型
    const windowGroup = createWindow3DV2(windowUnit, 0, materialConfig);
    windowGroup.name = `window-${opening.id}`;

    // 计算模型包围盒
    const box = new THREE.Box3().setFromObject(windowGroup);
    const modelSize = new THREE.Vector3();
    box.getSize(modelSize);
    const modelCenter = new THREE.Vector3();
    box.getCenter(modelCenter);

    // 缩放模型以适配窗洞
    // 门窗模型单位是 mm * 0.001 = meters
    const scaleX = openW / modelSize.x;
    const scaleY = openH / modelSize.y;
    const scale = Math.min(scaleX, scaleY) * 0.95; // 留5%边距
    windowGroup.scale.set(scale, scale, scale);

    // 定位到窗洞中心
    windowGroup.position.set(
      cx - modelCenter.x * scale,
      cy - modelCenter.y * scale,
      0, // 在墙面平面上
    );

    this.windowsGroup.add(windowGroup);
  }

  /** 移除窗洞中的门窗模型 */
  removeWindowFromOpening(openingId: string): void {
    const obj = this.windowsGroup.getObjectByName(`window-${openingId}`);
    if (obj) {
      this.windowsGroup.remove(obj);
      disposeGroup(obj);
    }
  }

  /** 设置光照 */
  setupLighting(intensity: number = 1.0): void {
    disposeGroup(this.lightsGroup);
    this.lightsGroup.clear();

    // 环境光 — 整体基础亮度
    const ambient = new THREE.AmbientLight(0xffffff, 0.5 * intensity);
    this.lightsGroup.add(ambient);

    // 半球光 — 天空/地面颜色渐变
    const hemi = new THREE.HemisphereLight(0xb1e1ff, 0xb97a20, 0.4 * intensity);
    hemi.position.set(0, 5, 0);
    this.lightsGroup.add(hemi);

    // 主方向光（从相机前方偏上打光，模拟室内主光源）
    const mainLight = new THREE.DirectionalLight(0xfff8f0, 1.0 * intensity);
    mainLight.position.set(2, 4, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.1;
    mainLight.shadow.camera.far = 20;
    mainLight.shadow.camera.left = -5;
    mainLight.shadow.camera.right = 5;
    mainLight.shadow.camera.top = 5;
    mainLight.shadow.camera.bottom = -5;
    mainLight.shadow.bias = -0.001;
    this.lightsGroup.add(mainLight);

    // 背面补光（从窗洞外面打进来的光）
    const backLight = new THREE.DirectionalLight(0xe0f0ff, 0.6 * intensity);
    backLight.position.set(0, 2, -3);
    this.lightsGroup.add(backLight);

    // 侧面补光
    const sideLight = new THREE.DirectionalLight(0xfff0e0, 0.3 * intensity);
    sideLight.position.set(-3, 1, 2);
    this.lightsGroup.add(sideLight);
  }

  /** 设置环境（地面、天空盒等） */
  private setupEnvironment(): void {
    // 地面（大平面）
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.9,
      metalness: 0.0,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -this.wallHeight / 2;
    floor.receiveShadow = true;
    floor.name = 'floor';
    this.environmentGroup.add(floor);

    // 网格辅助线（地面参考）
    const gridHelper = new THREE.GridHelper(20, 40, 0x333333, 0x222222);
    gridHelper.position.y = -this.wallHeight / 2 + 0.001;
    gridHelper.name = 'grid';
    this.environmentGroup.add(gridHelper);
  }

  /** 更新地面位置 */
  private updateFloorPosition(): void {
    const floor = this.environmentGroup.getObjectByName('floor');
    if (floor) {
      floor.position.y = -this.wallHeight / 2;
    }
    const grid = this.environmentGroup.getObjectByName('grid');
    if (grid) {
      grid.position.y = -this.wallHeight / 2 + 0.001;
    }
  }

  /** 设置视角 */
  setViewAngle(angle: 'front' | 'left' | 'right' | 'top' | 'perspective' | 'back'): void {
    const dist = Math.max(this.wallWidth, this.wallHeight) * 1.3;
    const target = new THREE.Vector3(0, 0, 0);

    switch (angle) {
      case 'front':
        this.camera.position.set(0, 0, dist);
        break;
      case 'left':
        this.camera.position.set(-dist, 0, 0);
        break;
      case 'right':
        this.camera.position.set(dist, 0, 0);
        break;
      case 'top':
        this.camera.position.set(0, dist, 0.1);
        break;
      case 'back':
        this.camera.position.set(0, 0, -dist);
        break;
      case 'perspective':
        this.camera.position.set(dist * 0.7, dist * 0.4, dist * 0.7);
        break;
    }

    this.controls.target.copy(target);
    this.controls.update();
  }

  /** 更新布局 */
  resize(): void {
    const container = this.renderer.domElement.parentElement;
    if (!container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /** 渲染一帧 */
  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /** 截图 */
  screenshot(): string {
    this.render();
    return this.renderer.domElement.toDataURL('image/png');
  }

  /** 切换网格显示 */
  toggleGrid(show: boolean): void {
    const grid = this.environmentGroup.getObjectByName('grid');
    if (grid) grid.visible = show;
  }

  /** 释放资源 */
  dispose(): void {
    this.controls.dispose();
    disposeGroup(this.wallGroup);
    disposeGroup(this.windowsGroup);
    disposeGroup(this.lightsGroup);
    disposeGroup(this.environmentGroup);
    this.renderer.dispose();

    const container = this.renderer.domElement.parentElement;
    if (container && container.contains(this.renderer.domElement)) {
      container.removeChild(this.renderer.domElement);
    }
  }
}

// ===== 旧接口兼容 =====

export function buildScene3D(
  scene: THREE.Scene,
  config: Scene3DConfig,
): THREE.Group {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'scene-fusion-3d';
  scene.add(rootGroup);
  return rootGroup;
}

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
  // 兼容旧接口
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
 * 释放 Three.js 对象资源
 */
function disposeGroup(group: THREE.Object3D): void {
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
    disposeGroup(root);
    scene.remove(root);
  }
  const lights = scene.getObjectByName('scene-lights');
  if (lights) scene.remove(lights);
}
