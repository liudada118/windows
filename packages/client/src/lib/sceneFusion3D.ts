// sceneFusion3D.ts — 3D 实景融合核心服务 V4
// 分层构建法:
//   Layer 1: 照片平面 (PlaneGeometry + 照片纹理) — 保证贴图100%正确
//   Layer 2: 立体窗洞 (4面内壁 + 墙体厚度边缘) — 提供深度感和立体感
//   Layer 3: 3D门窗模型 — 放入窗洞位置
// 支持 OrbitControls 旋转缩放查看

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { WindowUnit } from './types';
import { createWindow3DV2 } from './window3d-v2';
import type { MaterialConfig } from './window3d-v2';

// ===== 类型定义 =====

export interface NormalizedPoint {
  x: number;
  y: number;
}

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
  estimatedWidth?: number;
  estimatedHeight?: number;
}

export interface OpeningProduct {
  openingId: string;
  windowUnit: WindowUnit | null;
  materialConfig?: MaterialConfig;
}

export interface Scene3DAnalysis {
  openings: WindowOpening[];
  sceneDescription: string;
  lightingCondition: 'bright' | 'normal' | 'dim';
  wallMaterial: string;
}

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
      "label": "描述性名称",
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
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: SCENE_3D_ANALYSIS_PROMPT },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' } },
        ],
      }],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) throw new Error(`API 请求失败: ${response.status}`);

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  try {
    const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error('AI 返回格式解析失败');
  }
}

export function mockScene3DAnalysis(): Scene3DAnalysis {
  return {
    openings: [{
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
    }],
    sceneDescription: '室内厨房场景，面向外部建筑。',
    lightingCondition: 'bright',
    wallMaterial: '水泥毛坯墙面',
  };
}

// ===== 3D 场景构建 V4 — 分层构建法 =====

const WALL_DEPTH = 0.24; // 墙厚 240mm

/**
 * SceneBuilder V4 — 分层构建法
 * 
 * Layer 1: 照片平面 — PlaneGeometry + 照片纹理，保证贴图100%正确
 * Layer 2: 墙体边框 — 在照片平面周围和窗洞周围构建立体边框，提供深度感
 * Layer 3: 3D门窗模型 — 放入窗洞位置
 */
export class SceneBuilder {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;

  wallWidth = 4;
  wallHeight = 3;
  photoAspect = 1;

  // 场景分组
  photoGroup: THREE.Group;      // Layer 1: 照片
  wallStructGroup: THREE.Group; // Layer 2: 墙体结构（立体边框+内壁）
  windowsGroup: THREE.Group;    // Layer 3: 3D门窗
  lightsGroup: THREE.Group;
  environmentGroup: THREE.Group;

  private currentOpenings: WindowOpening[] = [];
  private photoTexture: THREE.Texture | null = null;

  constructor(container: HTMLElement) {
    const w = container.clientWidth;
    const h = container.clientHeight;

    // 场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 12, 25);

    // 透视相机
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
    this.camera.position.set(0, 0, 5);

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
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 15;
    this.controls.maxPolarAngle = Math.PI * 0.85;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    // 场景分组
    this.photoGroup = new THREE.Group();
    this.photoGroup.name = 'photo-layer';
    this.scene.add(this.photoGroup);

    this.wallStructGroup = new THREE.Group();
    this.wallStructGroup.name = 'wall-struct-layer';
    this.scene.add(this.wallStructGroup);

    this.windowsGroup = new THREE.Group();
    this.windowsGroup.name = 'windows-layer';
    this.scene.add(this.windowsGroup);

    this.lightsGroup = new THREE.Group();
    this.lightsGroup.name = 'lights';
    this.scene.add(this.lightsGroup);

    this.environmentGroup = new THREE.Group();
    this.environmentGroup.name = 'environment';
    this.scene.add(this.environmentGroup);

    this.setupLighting(1.0);
    this.setupEnvironment();
  }

  /** 设置照片纹理 */
  setPhoto(texture: THREE.Texture): void {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    this.photoTexture = texture;

    const img = texture.image as HTMLImageElement;
    this.photoAspect = img.width / img.height;

    // 根据照片比例确定墙体尺寸（保持高度3m）
    this.wallHeight = 3;
    this.wallWidth = this.wallHeight * this.photoAspect;

    // 更新相机（让照片填满更多视口）
    const dist = Math.max(this.wallWidth, this.wallHeight) * 1.1;
    this.camera.position.set(0, 0, dist);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /**
   * 构建完整的3D场景
   * 
   * 分三层构建:
   * 1. 照片平面（贴在 z=0 位置）
   * 2. 墙体结构（窗洞内壁、墙体侧面边框，从 z=0 延伸到 z=-WALL_DEPTH）
   * 3. 门窗模型（放在 z=0 位置，即墙体正面）
   */
  buildScene(openings: WindowOpening[], products: OpeningProduct[]): void {
    this.currentOpenings = openings;

    // 清除旧场景
    disposeGroup(this.photoGroup);
    this.photoGroup.clear();
    disposeGroup(this.wallStructGroup);
    this.wallStructGroup.clear();
    disposeGroup(this.windowsGroup);
    this.windowsGroup.clear();

    const W = this.wallWidth;
    const H = this.wallHeight;
    const D = WALL_DEPTH;

    // ===== Layer 1: 照片平面 =====
    this.buildPhotoPlane(W, H);

    // ===== Layer 2: 墙体结构 =====
    this.buildWallStructure(W, H, D, openings);

    // ===== Layer 3: 3D门窗模型 =====
    for (const product of products) {
      if (!product.windowUnit) continue;
      const opening = openings.find(o => o.id === product.openingId);
      if (!opening) continue;
      this.addWindowModel(opening, product.windowUnit, product.materialConfig);
    }

    // 更新地面位置
    this.updateFloorPosition();
  }

  /** Layer 1: 构建照片平面 */
  private buildPhotoPlane(W: number, H: number): void {
    if (!this.photoTexture) return;

    // 简单的平面几何体 + 照片纹理 — 100%可靠
    // 使用 MeshBasicMaterial 避免光照影响照片原始色彩
    const planeGeo = new THREE.PlaneGeometry(W, H);
    const planeMat = new THREE.MeshBasicMaterial({
      map: this.photoTexture,
      side: THREE.FrontSide,
    });

    const photoMesh = new THREE.Mesh(planeGeo, planeMat);
    photoMesh.name = 'photo-plane';
    photoMesh.position.set(0, 0, 0); // 正面朝向相机（+Z方向）
    photoMesh.receiveShadow = false; // 照片平面不接收阴影，保持原始画面
    this.photoGroup.add(photoMesh);
  }

  /** Layer 2: 构建墙体立体结构 */
  private buildWallStructure(W: number, H: number, D: number, openings: WindowOpening[]): void {
    const cementColor = 0x5a5a5a;
    const cementMat = new THREE.MeshStandardMaterial({
      color: cementColor,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    const darkCementMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    // --- 墙体外边框（4面侧壁，给墙体厚度感） ---
    // 上边
    this.addBoxSide(0, H / 2, -D / 2, W, D, 0.001, cementMat, 'wall-top');
    // 下边
    this.addBoxSide(0, -H / 2, -D / 2, W, D, 0.001, cementMat, 'wall-bottom');
    // 左边
    this.addBoxSide(-W / 2, 0, -D / 2, 0.001, H, D, cementMat, 'wall-left');
    // 右边
    this.addBoxSide(W / 2, 0, -D / 2, 0.001, H, D, cementMat, 'wall-right');

    // 背面板（墙体背面）
    const backGeo = new THREE.PlaneGeometry(W, H);
    const backMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    const backMesh = new THREE.Mesh(backGeo, backMat);
    backMesh.position.set(0, 0, -D);
    backMesh.name = 'wall-back';
    backMesh.receiveShadow = true;
    this.wallStructGroup.add(backMesh);

    // --- 每个窗洞的立体内壁 ---
    for (const opening of openings) {
      this.buildOpeningFrame(opening, W, H, D, darkCementMat);
    }
  }

  /** 添加一个盒子侧面 */
  private addBoxSide(
    cx: number, cy: number, cz: number,
    sx: number, sy: number, sz: number,
    mat: THREE.Material, name: string,
  ): void {
    const geo = new THREE.BoxGeometry(
      Math.max(sx, 0.01),
      Math.max(sy, 0.01),
      Math.max(sz, 0.01),
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, cy, cz);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.wallStructGroup.add(mesh);
  }

  /** 构建窗洞的立体边框（4面内壁） */
  private buildOpeningFrame(
    opening: WindowOpening,
    W: number, H: number, D: number,
    mat: THREE.Material,
  ): void {
    const { topLeft, topRight, bottomLeft, bottomRight } = opening.corners;

    // 归一化坐标 → 3D世界坐标
    // 归一化: (0,0)=左上, (1,1)=右下
    // 3D: 中心在原点, x: [-W/2, W/2], y: [-H/2, H/2]
    const x1 = (Math.min(topLeft.x, bottomLeft.x) - 0.5) * W;
    const x2 = (Math.max(topRight.x, bottomRight.x) - 0.5) * W;
    const y1 = (0.5 - Math.max(bottomLeft.y, bottomRight.y)) * H; // bottom → 低y
    const y2 = (0.5 - Math.min(topLeft.y, topRight.y)) * H;       // top → 高y

    const openW = x2 - x1;
    const openH = y2 - y1;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    const frameId = `frame-${opening.id}`;

    // 窗洞上内壁
    const topGeo = new THREE.PlaneGeometry(openW, D);
    const topMesh = new THREE.Mesh(topGeo, mat);
    topMesh.position.set(cx, y2, -D / 2);
    topMesh.rotation.x = Math.PI / 2;
    topMesh.name = `${frameId}-top`;
    topMesh.receiveShadow = true;
    this.wallStructGroup.add(topMesh);

    // 窗洞下内壁（窗台）
    const bottomGeo = new THREE.PlaneGeometry(openW, D);
    const bottomMesh = new THREE.Mesh(bottomGeo, mat);
    bottomMesh.position.set(cx, y1, -D / 2);
    bottomMesh.rotation.x = -Math.PI / 2;
    bottomMesh.name = `${frameId}-bottom`;
    bottomMesh.receiveShadow = true;
    this.wallStructGroup.add(bottomMesh);

    // 窗洞左内壁
    const leftGeo = new THREE.PlaneGeometry(D, openH);
    const leftMesh = new THREE.Mesh(leftGeo, mat);
    leftMesh.position.set(x1, cy, -D / 2);
    leftMesh.rotation.y = Math.PI / 2;
    leftMesh.name = `${frameId}-left`;
    leftMesh.receiveShadow = true;
    this.wallStructGroup.add(leftMesh);

    // 窗洞右内壁
    const rightGeo = new THREE.PlaneGeometry(D, openH);
    const rightMesh = new THREE.Mesh(rightGeo, mat);
    rightMesh.position.set(x2, cy, -D / 2);
    rightMesh.rotation.y = -Math.PI / 2;
    rightMesh.name = `${frameId}-right`;
    rightMesh.receiveShadow = true;
    this.wallStructGroup.add(rightMesh);

    // 窗洞边缘线条（增强视觉轮廓）
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.6 });
    const edgePoints = [
      new THREE.Vector3(x1, y1, 0.001),
      new THREE.Vector3(x2, y1, 0.001),
      new THREE.Vector3(x2, y2, 0.001),
      new THREE.Vector3(x1, y2, 0.001),
      new THREE.Vector3(x1, y1, 0.001),
    ];
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edgeLine = new THREE.Line(edgeGeo, edgeMat);
    edgeLine.name = `${frameId}-edge`;
    this.wallStructGroup.add(edgeLine);

    // 背面边缘线条
    const backEdgePoints = edgePoints.map(p => new THREE.Vector3(p.x, p.y, -D));
    const backEdgeGeo = new THREE.BufferGeometry().setFromPoints(backEdgePoints);
    const backEdgeLine = new THREE.Line(backEdgeGeo, edgeMat);
    backEdgeLine.name = `${frameId}-back-edge`;
    this.wallStructGroup.add(backEdgeLine);

    // 4条深度连接线
    const corners2D = [
      [x1, y1], [x2, y1], [x2, y2], [x1, y2],
    ];
    for (let i = 0; i < corners2D.length; i++) {
      const [px, py] = corners2D[i];
      const depthPoints = [
        new THREE.Vector3(px, py, 0.001),
        new THREE.Vector3(px, py, -D),
      ];
      const depthGeo = new THREE.BufferGeometry().setFromPoints(depthPoints);
      const depthLine = new THREE.Line(depthGeo, edgeMat);
      depthLine.name = `${frameId}-depth-${i}`;
      this.wallStructGroup.add(depthLine);
    }
  }

  /** Layer 3: 在窗洞位置放入3D门窗模型 */
  addWindowModel(
    opening: WindowOpening,
    windowUnit: WindowUnit,
    materialConfig?: MaterialConfig,
  ): void {
    // 移除旧的
    const oldName = `window-model-${opening.id}`;
    const old = this.windowsGroup.getObjectByName(oldName);
    if (old) {
      this.windowsGroup.remove(old);
      disposeGroup(old);
    }

    const W = this.wallWidth;
    const H = this.wallHeight;
    const { topLeft, topRight, bottomLeft, bottomRight } = opening.corners;

    const x1 = (Math.min(topLeft.x, bottomLeft.x) - 0.5) * W;
    const x2 = (Math.max(topRight.x, bottomRight.x) - 0.5) * W;
    const y1 = (0.5 - Math.max(bottomLeft.y, bottomRight.y)) * H;
    const y2 = (0.5 - Math.min(topLeft.y, topRight.y)) * H;

    const openW = x2 - x1;
    const openH = y2 - y1;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    // 创建3D门窗模型
    const windowGroup = createWindow3DV2(windowUnit, 0, materialConfig);

    // 强制更新世界矩阵后再计算包围盒
    windowGroup.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(windowGroup);
    const modelSize = new THREE.Vector3();
    box.getSize(modelSize);
    const modelCenter = new THREE.Vector3();
    box.getCenter(modelCenter);

    // 避免零尺寸
    if (modelSize.x < 0.001) modelSize.x = 0.001;
    if (modelSize.y < 0.001) modelSize.y = 0.001;

    // 缩放模型以完全适配窗洞（留2%边距确保不溢出）
    const scaleX = openW / modelSize.x;
    const scaleY = openH / modelSize.y;
    const scale = Math.min(scaleX, scaleY) * 0.98;
    windowGroup.scale.set(scale, scale, scale);

    // 重新计算缩放后的包围盒中心（确保精确居中）
    windowGroup.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(windowGroup);
    const scaledCenter = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);

    // 创建容器组
    const container = new THREE.Group();
    container.name = oldName;

    // 将模型中心移到原点
    windowGroup.position.set(
      -scaledCenter.x,
      -scaledCenter.y,
      -scaledCenter.z,
    );
    container.add(windowGroup);

    // 容器定位到窗洞中心，z轴稍微往前避免z-fighting
    container.position.set(cx, cy, 0.02);

    this.windowsGroup.add(container);
  }

  /** 移除窗洞中的门窗模型 */
  removeWindowFromOpening(openingId: string): void {
    const obj = this.windowsGroup.getObjectByName(`window-model-${openingId}`);
    if (obj) {
      this.windowsGroup.remove(obj);
      disposeGroup(obj);
    }
  }

  /** 重建场景（窗洞位置变化后调用） */
  rebuildScene(openings: WindowOpening[], products: OpeningProduct[]): void {
    this.buildScene(openings, products);
  }

  /** 设置光照 */
  setupLighting(intensity: number = 1.0): void {
    disposeGroup(this.lightsGroup);
    this.lightsGroup.clear();

    // 环境光
    const ambient = new THREE.AmbientLight(0xffffff, 0.6 * intensity);
    this.lightsGroup.add(ambient);

    // 半球光
    const hemi = new THREE.HemisphereLight(0xb1e1ff, 0xb97a20, 0.3 * intensity);
    hemi.position.set(0, 5, 0);
    this.lightsGroup.add(hemi);

    // 主方向光（从前方偏上打光）
    const mainLight = new THREE.DirectionalLight(0xfff8f0, 0.8 * intensity);
    mainLight.position.set(2, 3, 5);
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

    // 背面补光（模拟窗外光线）
    const backLight = new THREE.DirectionalLight(0xe0f0ff, 0.5 * intensity);
    backLight.position.set(0, 1, -4);
    this.lightsGroup.add(backLight);

    // 侧面补光
    const sideLight = new THREE.DirectionalLight(0xfff0e0, 0.2 * intensity);
    sideLight.position.set(-3, 1, 2);
    this.lightsGroup.add(sideLight);
  }

  /** 设置环境 */
  private setupEnvironment(): void {
    // 地面
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a3a,
      roughness: 0.9,
      metalness: 0.0,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -this.wallHeight / 2;
    floor.receiveShadow = true;
    floor.name = 'floor';
    this.environmentGroup.add(floor);

    // 网格
    const gridHelper = new THREE.GridHelper(20, 40, 0x333333, 0x222222);
    gridHelper.position.y = -this.wallHeight / 2 + 0.001;
    gridHelper.name = 'grid';
    this.environmentGroup.add(gridHelper);
  }

  /** 更新地面位置 */
  private updateFloorPosition(): void {
    const floor = this.environmentGroup.getObjectByName('floor');
    if (floor) floor.position.y = -this.wallHeight / 2;
    const grid = this.environmentGroup.getObjectByName('grid');
    if (grid) grid.position.y = -this.wallHeight / 2 + 0.001;
  }

  /** 设置视角 */
  setViewAngle(angle: 'front' | 'left' | 'right' | 'top' | 'perspective' | 'back'): void {
    const dist = Math.max(this.wallWidth, this.wallHeight) * 1.1;

    switch (angle) {
      case 'front':
        this.camera.position.set(0, 0, dist);
        break;
      case 'left':
        this.camera.position.set(-dist, 0, -WALL_DEPTH / 2);
        break;
      case 'right':
        this.camera.position.set(dist, 0, -WALL_DEPTH / 2);
        break;
      case 'top':
        this.camera.position.set(0, dist, -WALL_DEPTH / 2);
        break;
      case 'back':
        this.camera.position.set(0, 0, -dist);
        break;
      case 'perspective':
        this.camera.position.set(dist * 0.6, dist * 0.3, dist * 0.7);
        break;
    }

    this.controls.target.set(0, 0, -WALL_DEPTH / 2);
    this.controls.update();
  }

  /** 调整大小 */
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

  /** 切换网格 */
  toggleGrid(show: boolean): void {
    const grid = this.environmentGroup.getObjectByName('grid');
    if (grid) grid.visible = show;
  }

  /** 释放资源 */
  dispose(): void {
    this.controls.dispose();
    disposeGroup(this.photoGroup);
    disposeGroup(this.wallStructGroup);
    disposeGroup(this.windowsGroup);
    disposeGroup(this.lightsGroup);
    disposeGroup(this.environmentGroup);
    this.renderer.dispose();
    const container = this.renderer.domElement.parentElement;
    if (container?.contains(this.renderer.domElement)) {
      container.removeChild(this.renderer.domElement);
    }
  }
}

// ===== 兼容旧接口 =====

export function buildScene3D(scene: THREE.Scene, config: Scene3DConfig): THREE.Group {
  return new THREE.Group();
}

export function updateOpeningWindow(
  scene: THREE.Scene, rootGroup: THREE.Group,
  opening: WindowOpening, windowUnit: WindowUnit | null,
  wallWidth: number, wallHeight: number, wallDepth: number,
  materialConfig?: MaterialConfig,
): void {}

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
    if (child instanceof THREE.Line) {
      child.geometry?.dispose();
      if (child.material instanceof THREE.Material) {
        child.material.dispose();
      }
    }
  });
}

export function disposeScene3D(scene: THREE.Scene): void {}
