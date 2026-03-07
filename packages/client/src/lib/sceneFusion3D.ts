// sceneFusion3D.ts — 3D 实景融合核心服务 V2
// 方案: 照片作为全屏正交背景 + 3D门窗模型在窗洞位置精确叠加
// 核心思路: 不做3D墙面贴图（避免变形），而是照片保持原始比例显示，
//          3D门窗模型根据窗洞归一化坐标精确定位在照片上方
// 技术: Three.js 双场景渲染（背景场景 + 3D模型场景）

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

/** 演示模式 - 模拟AI检测结果（单个正面窗洞） */
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

// ===== 3D 场景构建 V2 =====

/**
 * 融合渲染器 — 管理双场景（背景照片 + 3D门窗模型）
 * 
 * 渲染流程:
 * 1. 先渲染背景层（照片全屏显示，正交相机）
 * 2. 清除深度缓冲
 * 3. 再渲染3D层（门窗模型 + 光照，透视相机）
 * 
 * 这样3D门窗模型会叠加在照片上方，看起来像是嵌入在照片中
 */
export class FusionRenderer {
  // 背景层
  bgScene: THREE.Scene;
  bgCamera: THREE.OrthographicCamera;
  bgMesh: THREE.Mesh | null = null;

  // 3D 模型层
  modelScene: THREE.Scene;
  modelCamera: THREE.OrthographicCamera;

  // 渲染器
  renderer: THREE.WebGLRenderer;

  // 视口信息
  viewWidth = 1;
  viewHeight = 1;
  photoAspect = 1;

  // 场景根组
  rootGroup: THREE.Group;

  constructor(container: HTMLElement) {
    // 背景场景
    this.bgScene = new THREE.Scene();
    this.bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    this.bgCamera.position.z = 1;

    // 3D 模型场景 — 使用正交相机，坐标系与照片归一化坐标对齐
    // 正交相机范围: x: [0, 1], y: [0, 1]，与照片归一化坐标一致
    this.modelScene = new THREE.Scene();
    this.modelCamera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
    this.modelCamera.position.z = 5;

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'fusion-root';
    this.modelScene.add(this.rootGroup);

    // 渲染器
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.autoClear = false; // 关键：不自动清除，手动控制渲染顺序

    this.viewWidth = container.clientWidth;
    this.viewHeight = container.clientHeight;
    this.renderer.setSize(this.viewWidth, this.viewHeight);
    container.appendChild(this.renderer.domElement);
  }

  /** 设置背景照片 */
  setPhoto(texture: THREE.Texture): void {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const img = texture.image as HTMLImageElement;
    this.photoAspect = img.width / img.height;

    // 移除旧背景
    if (this.bgMesh) {
      this.bgScene.remove(this.bgMesh);
      this.bgMesh.geometry.dispose();
      (this.bgMesh.material as THREE.Material).dispose();
    }

    // 创建全屏背景平面
    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      depthWrite: false,
    });
    this.bgMesh = new THREE.Mesh(geo, mat);
    this.bgScene.add(this.bgMesh);

    this.updateLayout();
  }

  /** 在窗洞位置添加3D门窗模型 */
  addWindowAtOpening(
    opening: WindowOpening,
    windowUnit: WindowUnit,
    materialConfig?: MaterialConfig,
  ): void {
    // 移除旧的
    const old = this.rootGroup.getObjectByName(`window-${opening.id}`);
    if (old) {
      this.rootGroup.remove(old);
      disposeGroup(old as THREE.Group);
    }

    const group = new THREE.Group();
    group.name = `window-${opening.id}`;

    // 计算窗洞在归一化坐标中的位置和尺寸
    const { topLeft, topRight, bottomLeft, bottomRight } = opening.corners;
    const cx = (topLeft.x + topRight.x + bottomLeft.x + bottomRight.x) / 4;
    const cy = (topLeft.y + topRight.y + bottomLeft.y + bottomRight.y) / 4;
    const w = ((topRight.x - topLeft.x) + (bottomRight.x - bottomLeft.x)) / 2;
    const h = ((bottomLeft.y - topLeft.y) + (bottomRight.y - topRight.y)) / 2;

    // 1. 窗洞遮罩（半透明深色，模拟洞口深度）
    const maskGeo = new THREE.PlaneGeometry(w, h);
    const maskMat = new THREE.MeshBasicMaterial({
      color: 0x1a1a1a,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    const mask = new THREE.Mesh(maskGeo, maskMat);
    mask.position.set(cx, 1 - cy, -0.01); // y 翻转（归一化坐标y向下，Three.js y向上）
    group.add(mask);

    // 2. 创建3D门窗模型
    const windowGroup = createWindow3DV2(windowUnit, 0, materialConfig);

    // 计算门窗模型的包围盒
    const box = new THREE.Box3().setFromObject(windowGroup);
    const modelSize = new THREE.Vector3();
    box.getSize(modelSize);
    const modelCenter = new THREE.Vector3();
    box.getCenter(modelCenter);

    // 缩放门窗模型以适配窗洞（在归一化坐标空间中）
    // 留一点内边距让窗框不超出窗洞
    const padding = 0.005;
    const targetW = w - padding * 2;
    const targetH = h - padding * 2;
    const scaleX = targetW / modelSize.x;
    const scaleY = targetH / modelSize.y;
    const scale = Math.min(scaleX, scaleY);
    windowGroup.scale.set(scale, scale, scale);

    // 居中定位到窗洞中心
    windowGroup.position.set(
      cx - modelCenter.x * scale,
      (1 - cy) - modelCenter.y * scale,
      0,
    );

    group.add(windowGroup);

    // 3. 窗洞边框（模拟窗框与墙体的交接线）
    const borderGeo = new THREE.EdgesGeometry(
      new THREE.PlaneGeometry(w + 0.005, h + 0.005)
    );
    const borderMat = new THREE.LineBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.4,
    });
    const border = new THREE.LineSegments(borderGeo, borderMat);
    border.position.set(cx, 1 - cy, 0.01);
    group.add(border);

    this.rootGroup.add(group);
  }

  /** 移除窗洞中的门窗模型 */
  removeWindowFromOpening(openingId: string): void {
    const obj = this.rootGroup.getObjectByName(`window-${openingId}`);
    if (obj) {
      this.rootGroup.remove(obj);
      disposeGroup(obj as THREE.Group);
    }
  }

  /** 设置光照 */
  setupLighting(intensity: number = 1.0): void {
    // 清除旧灯光
    const oldLights = this.modelScene.getObjectByName('fusion-lights');
    if (oldLights) {
      this.modelScene.remove(oldLights);
    }

    const lightsGroup = new THREE.Group();
    lightsGroup.name = 'fusion-lights';

    // 环境光 — 保证模型整体亮度
    const ambient = new THREE.AmbientLight(0xffffff, 0.6 * intensity);
    lightsGroup.add(ambient);

    // 正面主光（从相机方向打光，模拟室内光照）
    const frontLight = new THREE.DirectionalLight(0xfff8f0, 0.8 * intensity);
    frontLight.position.set(0, 2, 5);
    lightsGroup.add(frontLight);

    // 顶部补光
    const topLight = new THREE.DirectionalLight(0xffffff, 0.4 * intensity);
    topLight.position.set(0, 5, 0);
    lightsGroup.add(topLight);

    // 侧面补光
    const sideLight = new THREE.DirectionalLight(0xe8e0d8, 0.3 * intensity);
    sideLight.position.set(3, 1, 2);
    lightsGroup.add(sideLight);

    this.modelScene.add(lightsGroup);
  }

  /** 更新布局（窗口大小变化时调用） */
  updateLayout(): void {
    const container = this.renderer.domElement.parentElement;
    if (!container) return;

    this.viewWidth = container.clientWidth;
    this.viewHeight = container.clientHeight;
    this.renderer.setSize(this.viewWidth, this.viewHeight);

    // 更新背景相机（让照片保持比例居中显示）
    const viewAspect = this.viewWidth / this.viewHeight;
    if (this.photoAspect > viewAspect) {
      // 照片更宽 — 上下留黑边
      const scale = viewAspect / this.photoAspect;
      this.bgCamera.left = -1;
      this.bgCamera.right = 1;
      this.bgCamera.top = scale;
      this.bgCamera.bottom = -scale;
    } else {
      // 照片更高 — 左右留黑边
      const scale = this.photoAspect / viewAspect;
      this.bgCamera.left = -scale;
      this.bgCamera.right = scale;
      this.bgCamera.top = 1;
      this.bgCamera.bottom = -1;
    }
    this.bgCamera.updateProjectionMatrix();

    // 更新模型正交相机（与背景对齐）
    // 模型相机的范围需要与背景照片的可见区域一致
    this.modelCamera.left = 0;
    this.modelCamera.right = 1;
    this.modelCamera.top = 1;
    this.modelCamera.bottom = 0;
    this.modelCamera.updateProjectionMatrix();
  }

  /** 渲染一帧 */
  render(): void {
    this.renderer.clear();

    // 1. 渲染背景照片
    this.renderer.render(this.bgScene, this.bgCamera);

    // 2. 清除深度缓冲（让3D模型不被背景遮挡）
    this.renderer.clearDepth();

    // 3. 渲染3D门窗模型
    this.renderer.render(this.modelScene, this.modelCamera);
  }

  /** 截图 */
  screenshot(): string {
    this.render();
    return this.renderer.domElement.toDataURL('image/png');
  }

  /** 释放资源 */
  dispose(): void {
    // 释放背景
    if (this.bgMesh) {
      this.bgMesh.geometry.dispose();
      (this.bgMesh.material as THREE.Material).dispose();
    }

    // 释放模型
    disposeGroup(this.rootGroup);

    // 释放渲染器
    this.renderer.dispose();
    const container = this.renderer.domElement.parentElement;
    if (container && container.contains(this.renderer.domElement)) {
      container.removeChild(this.renderer.domElement);
    }
  }
}

// ===== 旧接口兼容（保留 buildScene3D 等供其他地方使用） =====

const SCALE = 0.001;

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
