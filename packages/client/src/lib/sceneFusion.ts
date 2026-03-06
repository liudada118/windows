// WindoorDesigner - 实景融合引擎
// 核心功能：AI门洞检测 + 透视变换 + 高质量图像合成
// Phase 1: OpenAI Vision API 自动检测门洞/窗洞位置
// Phase 2: Canvas 透视变换 + 多层合成 + 光照匹配

import * as THREE from 'three';
import type { WindowUnit } from './types';
import { DEFAULT_PROFILE_SERIES } from './types';
import { createWindow3DV2 } from './window3d-v2';
import type { MaterialConfig } from './window3d-v2';

// ===== 类型定义 =====

/** 四角坐标点（归一化 0-1） */
export interface NormalizedPoint {
  x: number; // 0-1, 相对于图片宽度
  y: number; // 0-1, 相对于图片高度
}

/** 门洞/窗洞检测结果 */
export interface WindowOpeningRegion {
  id: string;
  label: string;          // 如 "主窗洞", "左侧窗洞"
  corners: {              // 四角坐标（归一化）
    topLeft: NormalizedPoint;
    topRight: NormalizedPoint;
    bottomLeft: NormalizedPoint;
    bottomRight: NormalizedPoint;
  };
  confidence: number;     // 置信度 0-1
  estimatedWidth?: number;  // 估算宽度 mm
  estimatedHeight?: number; // 估算高度 mm
  wallColor?: string;     // 周围墙面颜色
  lightDirection?: string; // 光照方向
}

/** AI 检测结果 */
export interface SceneAnalysisResult {
  openings: WindowOpeningRegion[];
  sceneDescription: string;
  lightingCondition: 'bright' | 'normal' | 'dim';
  wallMaterial: string;
  suggestions: string[];
}

/** 合成参数 */
export interface CompositeParams {
  opacity: number;          // 门窗透明度 0-1
  brightness: number;       // 亮度匹配 0.5-1.5
  shadowIntensity: number;  // 阴影强度 0-1
  edgeBlend: number;        // 边缘羽化 0-1
  colorTemperature: number; // 色温偏移 -50 ~ 50
  perspectiveCorrection: boolean; // 是否启用透视校正
  reflectionIntensity: number; // 玻璃反射强度 0-1
}

/** 默认合成参数 */
export const DEFAULT_COMPOSITE_PARAMS: CompositeParams = {
  opacity: 0.95,
  brightness: 1.0,
  shadowIntensity: 0.4,
  edgeBlend: 0.3,
  colorTemperature: 0,
  perspectiveCorrection: true,
  reflectionIntensity: 0.2,
};

// ===== AI 门洞检测 =====

const SCENE_ANALYSIS_PROMPT = `你是一个专业的建筑场景分析师。用户会上传一张包含门洞或窗洞的室内/室外照片。

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
- 如果洞口有透视变形（不是正对镜头），四角坐标应反映实际的梯形形状

请以严格的 JSON 格式返回，不要包含任何其他文字：

{
  "openings": [
    {
      "id": "opening_1",
      "label": "洞口名称（如：主窗洞、左侧门洞）",
      "corners": {
        "topLeft": { "x": 0.0-1.0, "y": 0.0-1.0 },
        "topRight": { "x": 0.0-1.0, "y": 0.0-1.0 },
        "bottomLeft": { "x": 0.0-1.0, "y": 0.0-1.0 },
        "bottomRight": { "x": 0.0-1.0, "y": 0.0-1.0 }
      },
      "confidence": 0.0-1.0,
      "estimatedWidth": 宽度mm或null,
      "estimatedHeight": 高度mm或null,
      "wallColor": "周围墙面的大致颜色（如 #E8E0D8）",
      "lightDirection": "光照方向（left/right/top/front/back）"
    }
  ],
  "sceneDescription": "场景描述",
  "lightingCondition": "bright/normal/dim",
  "wallMaterial": "墙面材质描述（如：白色乳胶漆、灰色水泥、红砖等）",
  "suggestions": ["建议数组"]
}

注意：
- 精确标注洞口的四个角点，考虑透视变形
- 如果有多个洞口，全部标注
- 洞口可能是空的（未安装门窗），也可能已有旧门窗
- 估算尺寸时参考常见建筑尺寸（门高通常2000-2400mm，窗高通常1200-1800mm）`;

/**
 * 使用 AI 分析实景照片，检测门洞/窗洞位置
 */
export async function analyzeScenePhoto(
  imageBase64: string,
  apiKey: string,
  mimeType: string = 'image/jpeg'
): Promise<SceneAnalysisResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: SCENE_ANALYSIS_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '请分析这张照片，找出所有门洞和窗洞的精确位置。返回每个洞口的四角坐标。',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 3000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`AI分析失败: ${response.status} ${errorData?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI未返回有效结果');

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('无法从AI响应中提取JSON');
    const result = JSON.parse(jsonMatch[0]);

    return {
      openings: (result.openings || []).map((o: any, i: number) => ({
        id: o.id || `opening_${i + 1}`,
        label: o.label || `窗洞 ${i + 1}`,
        corners: {
          topLeft: { x: clamp(o.corners?.topLeft?.x ?? 0.2, 0, 1), y: clamp(o.corners?.topLeft?.y ?? 0.2, 0, 1) },
          topRight: { x: clamp(o.corners?.topRight?.x ?? 0.8, 0, 1), y: clamp(o.corners?.topRight?.y ?? 0.2, 0, 1) },
          bottomLeft: { x: clamp(o.corners?.bottomLeft?.x ?? 0.2, 0, 1), y: clamp(o.corners?.bottomLeft?.y ?? 0.8, 0, 1) },
          bottomRight: { x: clamp(o.corners?.bottomRight?.x ?? 0.8, 0, 1), y: clamp(o.corners?.bottomRight?.y ?? 0.8, 0, 1) },
        },
        confidence: o.confidence || 0.7,
        estimatedWidth: o.estimatedWidth || undefined,
        estimatedHeight: o.estimatedHeight || undefined,
        wallColor: o.wallColor || '#E0DCD8',
        lightDirection: o.lightDirection || 'front',
      })),
      sceneDescription: result.sceneDescription || '',
      lightingCondition: result.lightingCondition || 'normal',
      wallMaterial: result.wallMaterial || '未知',
      suggestions: result.suggestions || [],
    };
  } catch (e) {
    console.error('解析AI结果失败:', content);
    throw new Error(`解析场景分析结果失败: ${e instanceof Error ? e.message : '未知错误'}`);
  }
}

/** 模拟AI检测结果（演示模式） */
export function mockSceneAnalysis(): SceneAnalysisResult {
  return {
    openings: [
      {
        id: 'opening_1',
        label: '主窗洞',
        corners: {
          topLeft: { x: 0.25, y: 0.15 },
          topRight: { x: 0.75, y: 0.15 },
          bottomLeft: { x: 0.25, y: 0.78 },
          bottomRight: { x: 0.75, y: 0.78 },
        },
        confidence: 0.92,
        estimatedWidth: 2400,
        estimatedHeight: 1800,
        wallColor: '#E8E0D8',
        lightDirection: 'left',
      },
    ],
    sceneDescription: '室内场景，白色墙面，一个大型窗洞，自然光从左侧照入。',
    lightingCondition: 'bright',
    wallMaterial: '白色乳胶漆墙面',
    suggestions: [
      '建议正对窗洞拍摄以获得更好的融合效果',
      '光照条件良好，适合生成效果图',
    ],
  };
}

// ===== 3D 门窗渲染截图 =====

/**
 * 将 WindowUnit 渲染为透明背景的 PNG 截图
 * 使用正交相机确保无透视变形
 */
export function captureWindow3DSnapshot(
  windowUnit: WindowUnit,
  width: number = 1024,
  height: number = 1024,
  materialConfig?: MaterialConfig,
): string | null {
  try {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;

    const scene = new THREE.Scene();

    // 正交相机 - 正面视图，无透视变形
    const windowW = windowUnit.width / 1000;
    const windowH = windowUnit.height / 1000;
    const aspect = width / height;
    const padding = 1.05; // 5% padding
    const maxDim = Math.max(windowW, windowH) * padding;

    const camera = new THREE.OrthographicCamera(
      -maxDim * aspect / 2,
      maxDim * aspect / 2,
      maxDim / 2,
      -maxDim / 2,
      0.01,
      100
    );
    camera.position.set(0, windowH / 2, 3);
    camera.lookAt(0, windowH / 2, 0);

    // 光照 - 模拟自然光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(-3, 5, 4);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(3, 2, -2);
    scene.add(fillLight);

    // 创建3D门窗模型
    const config = materialConfig || { type: 'solid' as const, colorHex: '#B8B8B8' };
    const windowGroup = createWindow3DV2(windowUnit, 0, config);
    scene.add(windowGroup);

    // 渲染
    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png');

    // 清理
    renderer.dispose();
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    return dataUrl;
  } catch (err) {
    console.error('3D截图失败:', err);
    return null;
  }
}

// ===== 透视变换 =====

/**
 * 将矩形图像通过透视变换映射到四边形区域
 * 使用 Canvas 2D + 三角形分割实现
 */
export function perspectiveTransform(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement | HTMLCanvasElement,
  corners: WindowOpeningRegion['corners'],
  imgWidth: number,
  imgHeight: number,
  params: CompositeParams,
): void {
  const { topLeft, topRight, bottomLeft, bottomRight } = corners;

  // 将归一化坐标转为像素坐标
  const tl = { x: topLeft.x * imgWidth, y: topLeft.y * imgHeight };
  const tr = { x: topRight.x * imgWidth, y: topRight.y * imgHeight };
  const bl = { x: bottomLeft.x * imgWidth, y: bottomLeft.y * imgHeight };
  const br = { x: bottomRight.x * imgWidth, y: bottomRight.y * imgHeight };

  const sw = sourceImg.width || (sourceImg as HTMLCanvasElement).width;
  const sh = sourceImg.height || (sourceImg as HTMLCanvasElement).height;

  // 使用网格细分实现透视变换
  const gridSize = 20; // 网格密度

  ctx.save();
  ctx.globalAlpha = params.opacity;

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const u0 = gx / gridSize;
      const u1 = (gx + 1) / gridSize;
      const v0 = gy / gridSize;
      const v1 = (gy + 1) / gridSize;

      // 双线性插值计算目标四边形的四个角
      const p00 = bilinearInterp(tl, tr, bl, br, u0, v0);
      const p10 = bilinearInterp(tl, tr, bl, br, u1, v0);
      const p01 = bilinearInterp(tl, tr, bl, br, u0, v1);
      const p11 = bilinearInterp(tl, tr, bl, br, u1, v1);

      // 源图像上的对应区域
      const sx0 = u0 * sw;
      const sx1 = u1 * sw;
      const sy0 = v0 * sh;
      const sy1 = v1 * sh;

      // 绘制两个三角形
      drawTexturedTriangle(ctx, sourceImg,
        sx0, sy0, sx1, sy0, sx0, sy1,
        p00.x, p00.y, p10.x, p10.y, p01.x, p01.y
      );
      drawTexturedTriangle(ctx, sourceImg,
        sx1, sy0, sx1, sy1, sx0, sy1,
        p10.x, p10.y, p11.x, p11.y, p01.x, p01.y
      );
    }
  }

  ctx.restore();
}

/** 双线性插值 */
function bilinearInterp(
  tl: { x: number; y: number },
  tr: { x: number; y: number },
  bl: { x: number; y: number },
  br: { x: number; y: number },
  u: number,
  v: number
): { x: number; y: number } {
  const top = { x: tl.x + (tr.x - tl.x) * u, y: tl.y + (tr.y - tl.y) * u };
  const bottom = { x: bl.x + (br.x - bl.x) * u, y: bl.y + (br.y - bl.y) * u };
  return {
    x: top.x + (bottom.x - top.x) * v,
    y: top.y + (bottom.y - top.y) * v,
  };
}

/** 绘制纹理映射的三角形 */
function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  sx0: number, sy0: number,
  sx1: number, sy1: number,
  sx2: number, sy2: number,
  dx0: number, dy0: number,
  dx1: number, dy1: number,
  dx2: number, dy2: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(dx0, dy0);
  ctx.lineTo(dx1, dy1);
  ctx.lineTo(dx2, dy2);
  ctx.closePath();
  ctx.clip();

  // 计算仿射变换矩阵
  const denom = (sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1));
  if (Math.abs(denom) < 0.001) {
    ctx.restore();
    return;
  }

  const m11 = (dx0 * (sy1 - sy2) + dx1 * (sy2 - sy0) + dx2 * (sy0 - sy1)) / denom;
  const m12 = (dx0 * (sx2 - sx1) + dx1 * (sx0 - sx2) + dx2 * (sx1 - sx0)) / denom;
  const m13 = (dx0 * (sx1 * sy2 - sx2 * sy1) + dx1 * (sx2 * sy0 - sx0 * sy2) + dx2 * (sx0 * sy1 - sx1 * sy0)) / denom;
  const m21 = (dy0 * (sy1 - sy2) + dy1 * (sy2 - sy0) + dy2 * (sy0 - sy1)) / denom;
  const m22 = (dy0 * (sx2 - sx1) + dy1 * (sx0 - sx2) + dy2 * (sx1 - sx0)) / denom;
  const m23 = (dy0 * (sx1 * sy2 - sx2 * sy1) + dy1 * (sx2 * sy0 - sx0 * sy2) + dy2 * (sx0 * sy1 - sx1 * sy0)) / denom;

  ctx.setTransform(m11, m21, m12, m22, m13, m23);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// ===== 高质量图像合成 =====

/**
 * 将3D门窗渲染图合成到实景照片中
 */
export async function compositeWindowToScene(
  photoCanvas: HTMLCanvasElement,
  windowSnapshotUrl: string,
  region: WindowOpeningRegion,
  params: CompositeParams,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const windowImg = new Image();
    windowImg.crossOrigin = 'anonymous';
    windowImg.onload = () => {
      try {
        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = photoCanvas.width;
        resultCanvas.height = photoCanvas.height;
        const ctx = resultCanvas.getContext('2d')!;

        // Layer 1: 原始照片
        ctx.drawImage(photoCanvas, 0, 0);

        const imgW = photoCanvas.width;
        const imgH = photoCanvas.height;

        // Layer 2: 窗洞内阴影（模拟深度）
        drawInnerShadow(ctx, region, imgW, imgH, params.shadowIntensity);

        // Layer 3: 透视变换后的门窗渲染图
        if (params.perspectiveCorrection) {
          perspectiveTransform(ctx, windowImg, region.corners, imgW, imgH, params);
        } else {
          // 简单矩形叠加
          const tl = region.corners.topLeft;
          const br = region.corners.bottomRight;
          const rx = tl.x * imgW;
          const ry = tl.y * imgH;
          const rw = (br.x - tl.x) * imgW;
          const rh = (br.y - tl.y) * imgH;
          ctx.save();
          ctx.globalAlpha = params.opacity;
          ctx.drawImage(windowImg, rx, ry, rw, rh);
          ctx.restore();
        }

        // Layer 4: 边缘羽化
        if (params.edgeBlend > 0) {
          drawEdgeBlend(ctx, region, imgW, imgH, params.edgeBlend);
        }

        // Layer 5: 色温调节
        if (params.colorTemperature !== 0) {
          applyColorTemperature(ctx, region, imgW, imgH, params.colorTemperature);
        }

        // Layer 6: 玻璃反射效果
        if (params.reflectionIntensity > 0) {
          drawGlassReflection(ctx, region, imgW, imgH, params.reflectionIntensity);
        }

        // Layer 7: 亮度匹配
        if (params.brightness !== 1.0) {
          applyBrightnessMatch(ctx, region, imgW, imgH, params.brightness);
        }

        resolve(resultCanvas.toDataURL('image/jpeg', 0.95));
      } catch (err) {
        reject(err);
      }
    };
    windowImg.onerror = () => reject(new Error('加载门窗截图失败'));
    windowImg.src = windowSnapshotUrl;
  });
}

// ===== 合成辅助函数 =====

/** 绘制窗洞内阴影 */
function drawInnerShadow(
  ctx: CanvasRenderingContext2D,
  region: WindowOpeningRegion,
  imgW: number,
  imgH: number,
  intensity: number,
): void {
  if (intensity <= 0) return;

  const { topLeft, topRight, bottomLeft, bottomRight } = region.corners;
  const tl = { x: topLeft.x * imgW, y: topLeft.y * imgH };
  const tr = { x: topRight.x * imgW, y: topRight.y * imgH };
  const bl = { x: bottomLeft.x * imgW, y: bottomLeft.y * imgH };
  const br = { x: bottomRight.x * imgW, y: bottomRight.y * imgH };

  const regionW = Math.max(tr.x - tl.x, br.x - bl.x);
  const regionH = Math.max(bl.y - tl.y, br.y - tr.y);
  const shadowSize = Math.min(regionW, regionH) * 0.04;

  ctx.save();

  // 创建路径
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.clip();

  // 上边阴影
  const topGrad = ctx.createLinearGradient(0, tl.y, 0, tl.y + shadowSize);
  topGrad.addColorStop(0, `rgba(0,0,0,${intensity * 0.6})`);
  topGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(tl.x - 5, tl.y, regionW + 10, shadowSize);

  // 左边阴影
  const leftGrad = ctx.createLinearGradient(tl.x, 0, tl.x + shadowSize, 0);
  leftGrad.addColorStop(0, `rgba(0,0,0,${intensity * 0.4})`);
  leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(tl.x, tl.y, shadowSize, regionH);

  // 右边阴影
  const rightGrad = ctx.createLinearGradient(tr.x, 0, tr.x - shadowSize, 0);
  rightGrad.addColorStop(0, `rgba(0,0,0,${intensity * 0.3})`);
  rightGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rightGrad;
  ctx.fillRect(tr.x - shadowSize, tr.y, shadowSize, regionH);

  // 下边阴影
  const bottomGrad = ctx.createLinearGradient(0, bl.y, 0, bl.y - shadowSize);
  bottomGrad.addColorStop(0, `rgba(0,0,0,${intensity * 0.2})`);
  bottomGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(bl.x - 5, bl.y - shadowSize, regionW + 10, shadowSize);

  ctx.restore();
}

/** 边缘羽化 */
function drawEdgeBlend(
  ctx: CanvasRenderingContext2D,
  region: WindowOpeningRegion,
  imgW: number,
  imgH: number,
  blendAmount: number,
): void {
  const { topLeft, topRight, bottomLeft, bottomRight } = region.corners;
  const tl = { x: topLeft.x * imgW, y: topLeft.y * imgH };
  const tr = { x: topRight.x * imgW, y: topRight.y * imgH };
  const bl = { x: bottomLeft.x * imgW, y: bottomLeft.y * imgH };
  const br = { x: bottomRight.x * imgW, y: bottomRight.y * imgH };

  const regionW = Math.max(tr.x - tl.x, br.x - bl.x);
  const regionH = Math.max(bl.y - tl.y, br.y - tr.y);
  const featherSize = Math.min(regionW, regionH) * 0.02 * blendAmount;

  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';

  // 在门窗边缘绘制柔和的过渡
  const cx = (tl.x + tr.x + bl.x + br.x) / 4;
  const cy = (tl.y + tr.y + bl.y + br.y) / 4;
  const maxR = Math.max(regionW, regionH) / 2 + featherSize;

  const radGrad = ctx.createRadialGradient(cx, cy, maxR - featherSize, cx, cy, maxR);
  radGrad.addColorStop(0, 'rgba(0,0,0,0)');
  radGrad.addColorStop(1, `rgba(0,0,0,${blendAmount * 0.15})`);
  ctx.fillStyle = radGrad;
  ctx.fillRect(tl.x - featherSize, tl.y - featherSize, regionW + featherSize * 2, regionH + featherSize * 2);

  ctx.restore();
}

/** 色温调节 */
function applyColorTemperature(
  ctx: CanvasRenderingContext2D,
  region: WindowOpeningRegion,
  imgW: number,
  imgH: number,
  temperature: number,
): void {
  const { topLeft, bottomRight } = region.corners;
  const rx = topLeft.x * imgW;
  const ry = topLeft.y * imgH;
  const rw = (bottomRight.x - topLeft.x) * imgW;
  const rh = (bottomRight.y - topLeft.y) * imgH;

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = Math.abs(temperature) / 200;

  if (temperature > 0) {
    // 暖色调
    ctx.fillStyle = 'rgba(255, 180, 100, 1)';
  } else {
    // 冷色调
    ctx.fillStyle = 'rgba(100, 150, 255, 1)';
  }
  ctx.fillRect(rx, ry, rw, rh);
  ctx.restore();
}

/** 玻璃反射效果 */
function drawGlassReflection(
  ctx: CanvasRenderingContext2D,
  region: WindowOpeningRegion,
  imgW: number,
  imgH: number,
  intensity: number,
): void {
  const { topLeft, topRight, bottomLeft } = region.corners;
  const tl = { x: topLeft.x * imgW, y: topLeft.y * imgH };
  const tr = { x: topRight.x * imgW, y: topRight.y * imgH };
  const bl = { x: bottomLeft.x * imgW, y: bottomLeft.y * imgH };

  const regionW = tr.x - tl.x;
  const regionH = bl.y - tl.y;

  ctx.save();

  // 对角线高光
  const grad = ctx.createLinearGradient(
    tl.x, tl.y,
    tl.x + regionW * 0.7, tl.y + regionH * 0.7
  );
  grad.addColorStop(0, `rgba(255,255,255,${intensity * 0.15})`);
  grad.addColorStop(0.3, `rgba(255,255,255,${intensity * 0.05})`);
  grad.addColorStop(0.5, 'rgba(255,255,255,0)');
  grad.addColorStop(0.7, `rgba(255,255,255,${intensity * 0.03})`);
  grad.addColorStop(1, `rgba(255,255,255,${intensity * 0.1})`);

  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, topRight.y * imgH);
  ctx.lineTo(region.corners.bottomRight.x * imgW, region.corners.bottomRight.y * imgH);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = grad;
  ctx.fillRect(tl.x, tl.y, regionW, regionH);

  ctx.restore();
}

/** 亮度匹配 */
function applyBrightnessMatch(
  ctx: CanvasRenderingContext2D,
  region: WindowOpeningRegion,
  imgW: number,
  imgH: number,
  brightness: number,
): void {
  const { topLeft, bottomRight } = region.corners;
  const rx = topLeft.x * imgW;
  const ry = topLeft.y * imgH;
  const rw = (bottomRight.x - topLeft.x) * imgW;
  const rh = (bottomRight.y - topLeft.y) * imgH;

  ctx.save();
  if (brightness > 1) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (brightness - 1) * 0.3;
    ctx.fillStyle = 'white';
  } else {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.3;
    const v = Math.round(brightness * 255);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
  }
  ctx.fillRect(rx, ry, rw, rh);
  ctx.restore();
}

// ===== 工具函数 =====

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 从手动框选的矩形区域创建 WindowOpeningRegion */
export function createRegionFromRect(
  x: number,
  y: number,
  width: number,
  height: number,
  canvasWidth: number,
  canvasHeight: number,
): WindowOpeningRegion {
  return {
    id: `manual_${Date.now()}`,
    label: '手动框选区域',
    corners: {
      topLeft: { x: x / canvasWidth, y: y / canvasHeight },
      topRight: { x: (x + width) / canvasWidth, y: y / canvasHeight },
      bottomLeft: { x: x / canvasWidth, y: (y + height) / canvasHeight },
      bottomRight: { x: (x + width) / canvasWidth, y: (y + height) / canvasHeight },
    },
    confidence: 1.0,
    wallColor: '#E0DCD8',
    lightDirection: 'front',
  };
}

/** 计算区域的像素边界框 */
export function getRegionBBox(
  region: WindowOpeningRegion,
  imgW: number,
  imgH: number,
): { x: number; y: number; width: number; height: number } {
  const { topLeft, topRight, bottomLeft, bottomRight } = region.corners;
  const minX = Math.min(topLeft.x, bottomLeft.x) * imgW;
  const maxX = Math.max(topRight.x, bottomRight.x) * imgW;
  const minY = Math.min(topLeft.y, topRight.y) * imgH;
  const maxY = Math.max(bottomLeft.y, bottomRight.y) * imgH;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
