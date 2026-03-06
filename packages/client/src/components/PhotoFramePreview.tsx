// WindoorDesigner - 拍照识别 3D 框架预览组件
// 根据识别结果生成 3D 线框示意图
// 支持单窗和组合窗（L形/U形/凸窗）的透视展示

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { PhotoRecognitionResult } from '@/lib/photoRecognition';
import { createCompositeFromRecognition, createWindowFromRecognition, isCompositeWindow } from '@/lib/photoWindowFactory';
import { createWindow3D, createSceneEnvironment, createWallBackground } from '@/lib/window3d';
import type { CompositeWindow, WindowUnit } from '@/lib/types';
import { DEFAULT_PROFILE_SERIES } from '@/lib/types';
import { RotateCcw, Maximize2, Eye, Grid3x3, Box } from 'lucide-react';

interface PhotoFramePreviewProps {
  result: PhotoRecognitionResult | null;
  className?: string;
}

const SCALE = 0.001; // mm -> Three.js units

type ViewAngle = 'front' | 'perspective' | 'top' | 'left' | 'right';

// 创建组合窗3D模型
function createComposite3D(composite: CompositeWindow): THREE.Group {
  const group = new THREE.Group();
  group.name = `composite-${composite.id}`;

  let offsetX = 0;
  let offsetZ = 0;
  let currentAngle = 0; // 累计角度 (弧度)

  for (let i = 0; i < composite.panels.length; i++) {
    const panel = composite.panels[i];
    const win = panel.windowUnit;
    const w = win.width * SCALE;
    const h = win.height * SCALE;

    // 创建单面板的3D模型
    const windowGroup = createWindow3D(win, 0);

    // 计算面板位置和旋转
    if (i === 0) {
      // 第一个面板（正面）
      windowGroup.position.set(0, 0, 0);
    } else {
      // 后续面板根据角度放置
      const angleRad = (panel.angle * Math.PI) / 180;
      currentAngle += angleRad;

      // 计算连接点位置
      const prevPanel = composite.panels[i - 1];
      const prevW = prevPanel.windowUnit.width * SCALE;

      if (panel.angle > 0) {
        // 右侧面
        offsetX += prevW / 2;
        windowGroup.position.set(offsetX + w / 2, 0, 0);
        windowGroup.rotation.y = -currentAngle;
        // 调整位置使边缘对齐
        const cosA = Math.cos(currentAngle);
        const sinA = Math.sin(currentAngle);
        windowGroup.position.set(
          offsetX + (w / 2) * cosA,
          0,
          offsetZ - (w / 2) * sinA
        );
      } else {
        // 左侧面
        offsetX -= prevW / 2;
        windowGroup.position.set(offsetX - w / 2, 0, 0);
        windowGroup.rotation.y = -currentAngle;
        const cosA = Math.cos(currentAngle);
        const sinA = Math.sin(currentAngle);
        windowGroup.position.set(
          offsetX - (w / 2) * cosA,
          0,
          offsetZ + (w / 2) * sinA
        );
      }
    }

    group.add(windowGroup);
  }

  return group;
}

// 创建尺寸标注线（3D空间中的标注）
function createDimensionAnnotations(result: PhotoRecognitionResult): THREE.Group {
  const group = new THREE.Group();
  const lineColor = 0xff4444;
  const lineMat = new THREE.LineBasicMaterial({ color: lineColor, linewidth: 2 });

  let offsetX = 0;

  for (let i = 0; i < result.panels.length; i++) {
    const panel = result.panels[i];
    const w = panel.width * SCALE;
    const h = panel.height * SCALE;

    // 底部宽度标注线
    const bottomY = -h / 2 - 0.08;
    const points = [
      new THREE.Vector3(offsetX - w / 2, bottomY, 0),
      new THREE.Vector3(offsetX + w / 2, bottomY, 0),
    ];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(lineGeo, lineMat);
    group.add(line);

    // 端点标记
    const endMarkSize = 0.03;
    for (const pt of points) {
      const markPoints = [
        new THREE.Vector3(pt.x, pt.y - endMarkSize, pt.z),
        new THREE.Vector3(pt.x, pt.y + endMarkSize, pt.z),
      ];
      const markGeo = new THREE.BufferGeometry().setFromPoints(markPoints);
      group.add(new THREE.Line(markGeo, lineMat));
    }

    // 右侧高度标注线（仅第一个面板）
    if (i === 0) {
      const rightX = offsetX + w / 2 + 0.08;
      const hPoints = [
        new THREE.Vector3(rightX, -h / 2, 0),
        new THREE.Vector3(rightX, h / 2, 0),
      ];
      const hLineGeo = new THREE.BufferGeometry().setFromPoints(hPoints);
      group.add(new THREE.Line(hLineGeo, lineMat));

      for (const pt of hPoints) {
        const markPoints = [
          new THREE.Vector3(pt.x - endMarkSize, pt.y, pt.z),
          new THREE.Vector3(pt.x + endMarkSize, pt.y, pt.z),
        ];
        const markGeo = new THREE.BufferGeometry().setFromPoints(markPoints);
        group.add(new THREE.Line(markGeo, lineMat));
      }
    }

    offsetX += w + 0.02; // 面板间距
  }

  return group;
}

// 创建Canvas文字纹理用于3D标注
function createTextSprite(text: string, fontSize: number = 48, color: string = '#ff4444'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 256;
  canvas.height = 64;

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = `bold ${fontSize}px Arial`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(0.4, 0.1, 1);

  return sprite;
}

export default function PhotoFramePreview({ result, className }: PhotoFramePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);
  const modelGroupRef = useRef<THREE.Group | null>(null);

  const [showGrid, setShowGrid] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [currentView, setCurrentView] = useState<ViewAngle>('perspective');

  // Initialize Three.js
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.01,
      100
    );
    camera.position.set(0, 0.5, 3);
    cameraRef.current = camera;

    // Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'default',
      });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch {
      return;
    }

    // Lights
    createSceneEnvironment(scene);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.5;
    controls.maxDistance = 10;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Grid helper
    const gridHelper = new THREE.GridHelper(10, 20, 0x444466, 0x333355);
    gridHelper.visible = false;
    gridHelper.name = 'grid';
    scene.add(gridHelper);

    // Animate
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update model when result changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !result) return;

    // Remove old model
    if (modelGroupRef.current) {
      scene.remove(modelGroupRef.current);
      modelGroupRef.current = null;
    }

    // Create new model
    const modelGroup = new THREE.Group();

    if (isCompositeWindow(result)) {
      // 组合窗
      const composite = createCompositeFromRecognition(result);
      const composite3D = createComposite3D(composite);
      modelGroup.add(composite3D);
    } else {
      // 单窗
      const windowUnit = createWindowFromRecognition(result);
      const window3D = createWindow3D(windowUnit, 0);
      modelGroup.add(window3D);

      // 墙体背景
      const wall = createWallBackground(windowUnit.width, windowUnit.height);
      modelGroup.add(wall);
    }

    // 尺寸标注
    if (showAnnotations) {
      const annotations = createDimensionAnnotations(result);
      annotations.name = 'annotations';
      modelGroup.add(annotations);

      // 文字标注
      result.panels.forEach((panel, i) => {
        // 宽度标注
        const wSprite = createTextSprite(`${panel.width}mm`);
        wSprite.position.set(
          i * (panel.width * SCALE + 0.02),
          -panel.height * SCALE / 2 - 0.15,
          0
        );
        modelGroup.add(wSprite);

        // 高度标注（仅第一个面板）
        if (i === 0) {
          const hSprite = createTextSprite(`${panel.height}mm`);
          hSprite.position.set(
            panel.width * SCALE / 2 + 0.15,
            0,
            0
          );
          modelGroup.add(hSprite);
        }
      });
    }

    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    // Auto-fit camera
    const box = new THREE.Box3().setFromObject(modelGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cameraRef.current!.fov * (Math.PI / 180);
    let cameraZ = maxDim / (2 * Math.tan(fov / 2));
    cameraZ *= 1.5;

    if (controlsRef.current) {
      controlsRef.current.target.copy(center);
    }
    if (cameraRef.current) {
      cameraRef.current.position.set(
        center.x + cameraZ * 0.3,
        center.y + cameraZ * 0.3,
        center.z + cameraZ
      );
      cameraRef.current.lookAt(center);
    }
  }, [result, showAnnotations]);

  // Toggle grid
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const grid = scene.getObjectByName('grid');
    if (grid) grid.visible = showGrid;
  }, [showGrid]);

  // View angle presets
  const handleSetView = useCallback((view: ViewAngle) => {
    if (!cameraRef.current || !controlsRef.current || !modelGroupRef.current) return;

    const box = new THREE.Box3().setFromObject(modelGroupRef.current);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = maxDim * 2;

    controlsRef.current.target.copy(center);

    switch (view) {
      case 'front':
        cameraRef.current.position.set(center.x, center.y, center.z + dist);
        break;
      case 'perspective':
        cameraRef.current.position.set(
          center.x + dist * 0.5,
          center.y + dist * 0.3,
          center.z + dist * 0.8
        );
        break;
      case 'top':
        cameraRef.current.position.set(center.x, center.y + dist, center.z + 0.01);
        break;
      case 'left':
        cameraRef.current.position.set(center.x - dist, center.y, center.z);
        break;
      case 'right':
        cameraRef.current.position.set(center.x + dist, center.y, center.z);
        break;
    }

    controlsRef.current.update();
    setCurrentView(view);
  }, []);

  // Reset view
  const handleReset = useCallback(() => {
    handleSetView('perspective');
  }, [handleSetView]);

  return (
    <div className={`relative ${className || ''}`}>
      {/* 3D Canvas */}
      <div ref={containerRef} className="w-full h-full min-h-[300px]" />

      {/* Controls overlay */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5">
        <button
          onClick={handleReset}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-all"
          title="重置视角"
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={() => handleSetView('front')}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
            currentView === 'front'
              ? 'bg-amber-500/30 text-amber-400 ring-1 ring-amber-500/50'
              : 'bg-black/50 text-white/70 hover:text-white hover:bg-black/70'
          }`}
          title="正视图"
        >
          <Maximize2 size={14} />
        </button>
        <button
          onClick={() => handleSetView('perspective')}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
            currentView === 'perspective'
              ? 'bg-amber-500/30 text-amber-400 ring-1 ring-amber-500/50'
              : 'bg-black/50 text-white/70 hover:text-white hover:bg-black/70'
          }`}
          title="透视图"
        >
          <Box size={14} />
        </button>
        <button
          onClick={() => handleSetView('top')}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
            currentView === 'top'
              ? 'bg-amber-500/30 text-amber-400 ring-1 ring-amber-500/50'
              : 'bg-black/50 text-white/70 hover:text-white hover:bg-black/70'
          }`}
          title="俯视图"
        >
          <Eye size={14} />
        </button>
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
            showGrid
              ? 'bg-amber-500/30 text-amber-400 ring-1 ring-amber-500/50'
              : 'bg-black/50 text-white/70 hover:text-white hover:bg-black/70'
          }`}
          title="网格"
        >
          <Grid3x3 size={14} />
        </button>
      </div>

      {/* Window type badge */}
      {result && (
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium border border-amber-500/30">
            {result.windowTypeName}
          </span>
          <span className="px-2 py-1 rounded-lg bg-white/10 text-white/60 text-xs">
            置信度: {Math.round(result.confidence * 100)}%
          </span>
        </div>
      )}

      {/* Empty state */}
      {!result && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white/40">
            <Box size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">上传照片后将生成3D框架预览</p>
          </div>
        </div>
      )}
    </div>
  );
}
