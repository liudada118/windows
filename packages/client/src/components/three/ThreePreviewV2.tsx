// WindoorDesigner - 3D预览组件 v2.0
// 增强功能: 颜色/木纹实时切换、爆炸视图、开启动画、增强光照
// 基于 ThreePreview.tsx 重构，使用 window3d-v2 + textures 模块

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { WindowUnit } from '@/lib/types';
import { DEFAULT_PROFILE_SERIES } from '@/lib/types';
import { createWindow3DV2, updateMaterialColor, getAllColorOptions, getAllWoodGrainOptions } from '@/lib/window3d-v2';
import type { MaterialConfig } from '@/lib/window3d-v2';
import { createSceneEnvironment, createWallBackground } from '@/lib/window3d';
import { applyExplodedView, resetExplodedView, disposeObject } from '@/lib/three-utils';
import { SOLID_COLORS, WOOD_GRAINS } from '@/lib/textures';
import {
  RotateCcw, Sun, Moon, DoorOpen, DoorClosed, Maximize2, Eye,
  Grid3x3, AlertTriangle, Palette, TreePine, Layers, ChevronDown,
} from 'lucide-react';

interface ThreePreviewV2Props {
  windows: WindowUnit[];
  selectedWindowId: string | null;
}

type ViewAngle = 'front' | 'back' | 'left' | 'right' | 'top' | 'perspective';

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch { return false; }
}

export default function ThreePreviewV2({ windows, selectedWindowId }: ThreePreviewV2Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);
  const windowGroupRef = useRef<THREE.Group | null>(null);
  const isContextLostRef = useRef(false);

  const [openAngle, setOpenAngle] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [showWall, setShowWall] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Phase 2 新增状态
  const [materialConfig, setMaterialConfig] = useState<MaterialConfig>({ type: 'solid', colorHex: '#B8B8B8' });
  const [explodeFactor, setExplodeFactor] = useState(0);
  const [showColorPanel, setShowColorPanel] = useState(false);
  const [colorTab, setColorTab] = useState<'solid' | 'woodgrain'>('solid');

  const displayWindows = selectedWindowId
    ? windows.filter(w => w.id === selectedWindowId)
    : windows;

  const colorOptions = useMemo(() => getAllColorOptions(), []);
  const woodGrainOptions = useMemo(() => getAllWoodGrainOptions(), []);

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!isWebGLAvailable()) {
      setWebglError('您的浏览器或设备不支持 WebGL，无法使用 3D 预览功能。');
      return;
    }

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.01, 100);
    camera.position.set(0, 0.5, 3);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default', failIfMajorPerformanceCaveat: false });
    } catch {
      setWebglError('WebGL 渲染器初始化失败，请尝试刷新页面或使用其他浏览器。');
      return;
    }

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // WebGL context lost/restored
    const canvas = renderer.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      isContextLostRef.current = true;
      cancelAnimationFrame(animFrameRef.current);
    };
    const handleContextRestored = () => {
      isContextLostRef.current = false;
      renderer.setSize(container.clientWidth, container.clientHeight);
      const animate = () => {
        if (isContextLostRef.current) return;
        animFrameRef.current = requestAnimationFrame(animate);
        if (controlsRef.current) controlsRef.current.update();
        renderer.render(scene, camera);
      };
      animate();
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.5;
    controls.maxDistance = 15;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.target.set(0, 0.3, 0);
    controlsRef.current = controls;

    // Enhanced environment
    createSceneEnvironment(scene);

    // 增强光照 - 添加环境光探针效果
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    // Animation loop
    const animate = () => {
      if (isContextLostRef.current) return;
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const handleResize = () => {
      if (!container || isContextLostRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Dark/Light mode
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (isDarkMode) {
      scene.background = new THREE.Color(0x1a1a2e);
      scene.fog = new THREE.FogExp2(0x1a1a2e, 0.15);
    } else {
      scene.background = new THREE.Color(0xe8e4e0);
      scene.fog = new THREE.FogExp2(0xe8e4e0, 0.08);
    }
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.PlaneGeometry) {
        if (obj.geometry.parameters.width === 20) {
          (obj.material as THREE.MeshStandardMaterial).color.set(isDarkMode ? 0x2a2a35 : 0xd0ccc8);
        }
      }
    });
  }, [isDarkMode]);

  // Grid
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const existingGrid = scene.getObjectByName('grid-helper');
    if (existingGrid) scene.remove(existingGrid);
    if (showGrid) {
      const gridHelper = new THREE.GridHelper(10, 50, 0x444466, 0x333355);
      gridHelper.name = 'grid-helper';
      gridHelper.position.y = -0.005;
      scene.add(gridHelper);
    }
  }, [showGrid]);

  // Rebuild 3D models - 使用 v2 生成器
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || isContextLostRef.current) return;

    // 清理旧模型
    if (windowGroupRef.current) {
      scene.remove(windowGroupRef.current);
      disposeObject(windowGroupRef.current);
    }

    const masterGroup = new THREE.Group();
    masterGroup.name = 'windows-group';

    if (displayWindows.length === 0) {
      windowGroupRef.current = masterGroup;
      scene.add(masterGroup);
      return;
    }

    let totalWidth = 0;
    const gaps = 0.3;
    const windowWidths = displayWindows.map(w => w.width * 0.001);
    totalWidth = windowWidths.reduce((sum, w) => sum + w, 0) + (displayWindows.length - 1) * gaps;
    let currentX = -totalWidth / 2;

    for (const win of displayWindows) {
      // 使用 v2 生成器 - 支持材质配置
      const w3d = createWindow3DV2(win, openAngle, materialConfig);
      const winW = win.width * 0.001;
      const winH = win.height * 0.001;
      w3d.position.x += currentX + winW / 2;
      w3d.position.y += winH / 2;
      masterGroup.add(w3d);

      if (showWall) {
        const series = DEFAULT_PROFILE_SERIES.find(s => s.id === win.profileSeriesId) || DEFAULT_PROFILE_SERIES[2];
        const wall = createWallBackground(win.width, win.height, series.frameDepth);
        wall.position.x = currentX + winW / 2;
        wall.position.y = winH / 2;
        masterGroup.add(wall);
      }
      currentX += winW + gaps;
    }

    windowGroupRef.current = masterGroup;
    scene.add(masterGroup);

    // Auto-fit camera
    if (cameraRef.current && controlsRef.current) {
      const maxH = Math.max(...displayWindows.map(w => w.height * 0.001));
      const dist = Math.max(totalWidth, maxH) * 1.5 + 1;
      cameraRef.current.position.set(0, maxH / 2 + 0.3, dist);
      controlsRef.current.target.set(0, maxH / 2, 0);
      controlsRef.current.update();
    }
  }, [displayWindows, openAngle, showWall, materialConfig]);

  // 爆炸视图
  useEffect(() => {
    if (!windowGroupRef.current) return;
    if (explodeFactor > 0) {
      applyExplodedView(windowGroupRef.current, explodeFactor);
    } else {
      resetExplodedView(windowGroupRef.current);
    }
  }, [explodeFactor]);

  // Toggle open/close
  const toggleOpen = useCallback(() => {
    const targetAngle = isOpen ? 0 : Math.PI / 6;
    const startAngle = openAngle;
    const startTime = performance.now();
    const duration = 600;
    const animateAngle = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setOpenAngle(startAngle + (targetAngle - startAngle) * eased);
      if (progress < 1) requestAnimationFrame(animateAngle);
    };
    requestAnimationFrame(animateAngle);
    setIsOpen(!isOpen);
  }, [isOpen, openAngle]);

  // View angle presets
  const setViewAngle = useCallback((view: ViewAngle) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const maxH = displayWindows.length > 0 ? Math.max(...displayWindows.map(w => w.height * 0.001)) : 1.5;
    const centerY = maxH / 2;
    const dist = 3;
    const positions: Record<ViewAngle, [number, number, number]> = {
      front: [0, centerY, dist],
      back: [0, centerY, -dist],
      left: [-dist, centerY, 0],
      right: [dist, centerY, 0],
      top: [0, dist + centerY, 0.01],
      perspective: [dist * 0.7, centerY + 0.5, dist * 0.7],
    };
    const [px, py, pz] = positions[view];
    const startPos = camera.position.clone();
    const endPos = new THREE.Vector3(px, py, pz);
    const startTime = performance.now();
    const dur = 500;
    const animateCamera = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / dur, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      camera.position.lerpVectors(startPos, endPos, eased);
      controls.target.set(0, centerY, 0);
      controls.update();
      if (progress < 1) requestAnimationFrame(animateCamera);
    };
    requestAnimationFrame(animateCamera);
  }, [displayWindows]);

  // 颜色切换
  const handleColorSelect = useCallback((hex: string, name: string) => {
    setMaterialConfig({ type: 'solid', colorHex: hex, colorName: name });
  }, []);

  // 木纹切换
  const handleWoodGrainSelect = useCallback((grainName: string) => {
    setMaterialConfig({ type: 'woodgrain', grainName });
  }, []);

  if (webglError) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-[oklch(0.10_0.02_260)]">
        <div className="text-center px-6">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <p className="text-sm text-slate-300 mb-2">{webglError}</p>
          <p className="text-xs text-slate-500">请尝试使用 Chrome 或 Firefox 浏览器</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0" />

      {/* 左侧控制面板 - 视角 */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
        <div className="bg-[oklch(0.14_0.025_260)]/90 backdrop-blur rounded-xl border border-[oklch(0.30_0.04_260)] p-1.5 flex flex-col gap-1">
          {(['front', 'back', 'left', 'right', 'top', 'perspective'] as ViewAngle[]).map((v) => (
            <button key={v} onClick={() => setViewAngle(v)}
              className="px-2.5 py-1.5 text-[10px] text-slate-300 hover:text-amber-400 hover:bg-white/10 rounded-lg transition-colors font-medium"
              title={`${v}视图`}
            >
              {{ front: '正面', back: '背面', left: '左侧', right: '右侧', top: '俯视', perspective: '透视' }[v]}
            </button>
          ))}
        </div>
      </div>

      {/* 右侧控制面板 */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        <div className="bg-[oklch(0.14_0.025_260)]/90 backdrop-blur rounded-xl border border-[oklch(0.30_0.04_260)] p-1.5 flex flex-col gap-1">
          <button onClick={toggleOpen}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${isOpen ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'}`}
            title={isOpen ? '关闭窗户' : '打开窗户'}
          >
            {isOpen ? <DoorOpen size={18} /> : <DoorClosed size={18} />}
          </button>
          <button onClick={() => setShowWall(!showWall)}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${showWall ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'}`}
            title={showWall ? '隐藏墙体' : '显示墙体'}
          >
            <Maximize2 size={16} />
          </button>
          <button onClick={() => setShowGrid(!showGrid)}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${showGrid ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'}`}
            title={showGrid ? '隐藏网格' : '显示网格'}
          >
            <Grid3x3 size={16} />
          </button>
          <button onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all"
            title={isDarkMode ? '切换亮色' : '切换暗色'}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={() => setViewAngle('perspective')}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all"
            title="重置视角"
          >
            <RotateCcw size={16} />
          </button>

          {/* 爆炸视图 */}
          <div className="border-t border-[oklch(0.30_0.04_260)] pt-1 mt-1">
            <button onClick={() => setExplodeFactor(f => f > 0 ? 0 : 0.5)}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${explodeFactor > 0 ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'}`}
              title="爆炸视图"
            >
              <Layers size={16} />
            </button>
          </div>

          {/* 颜色/木纹切换 */}
          <div className="border-t border-[oklch(0.30_0.04_260)] pt-1 mt-1">
            <button onClick={() => setShowColorPanel(!showColorPanel)}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${showColorPanel ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'}`}
              title="颜色/木纹"
            >
              <Palette size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 颜色/木纹面板 */}
      {showColorPanel && (
        <div className="absolute top-3 right-16 z-20 w-56 bg-[oklch(0.14_0.025_260)]/95 backdrop-blur rounded-xl border border-[oklch(0.30_0.04_260)] p-3 shadow-xl">
          {/* Tab 切换 */}
          <div className="flex gap-1 mb-3">
            <button onClick={() => setColorTab('solid')}
              className={`flex-1 py-1.5 text-[11px] rounded-lg font-medium transition-all ${colorTab === 'solid' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Palette size={12} className="inline mr-1" />纯色
            </button>
            <button onClick={() => setColorTab('woodgrain')}
              className={`flex-1 py-1.5 text-[11px] rounded-lg font-medium transition-all ${colorTab === 'woodgrain' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <TreePine size={12} className="inline mr-1" />木纹
            </button>
          </div>

          {/* 纯色网格 */}
          {colorTab === 'solid' && (
            <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {colorOptions.map(({ name, hex }) => (
                <button key={name} onClick={() => handleColorSelect(hex, name)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${materialConfig.type === 'solid' && materialConfig.colorHex === hex ? 'border-amber-400 ring-1 ring-amber-400/50' : 'border-transparent'}`}
                  style={{ backgroundColor: hex }}
                  title={name}
                />
              ))}
            </div>
          )}

          {/* 木纹列表 */}
          {colorTab === 'woodgrain' && (
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
              {woodGrainOptions.map((name) => {
                const grain = WOOD_GRAINS[name];
                return (
                  <button key={name} onClick={() => handleWoodGrainSelect(name)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] transition-all ${materialConfig.type === 'woodgrain' && materialConfig.grainName === name ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                  >
                    <div className="w-6 h-6 rounded flex-shrink-0" style={{
                      background: `linear-gradient(135deg, ${grain.baseColor}, ${grain.grainColor})`
                    }} />
                    <span>{name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 当前选择 */}
          <div className="mt-2 pt-2 border-t border-[oklch(0.30_0.04_260)]">
            <span className="text-[10px] text-slate-500">
              当前: {materialConfig.type === 'solid' ? (materialConfig.colorName || '铝合金') : materialConfig.grainName}
            </span>
          </div>
        </div>
      )}

      {/* 爆炸视图滑块 */}
      {explodeFactor > 0 && (
        <div className="absolute bottom-16 left-3 z-10 bg-[oklch(0.14_0.025_260)]/90 backdrop-blur rounded-xl border border-[oklch(0.30_0.04_260)] p-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">分离</span>
            <input type="range" min="0" max="100" value={explodeFactor * 100}
              onChange={(e) => setExplodeFactor(Number(e.target.value) / 100)}
              className="w-24 h-1 accent-amber-400"
            />
            <span className="text-[10px] text-slate-400 w-8">{Math.round(explodeFactor * 100)}%</span>
          </div>
        </div>
      )}

      {/* 底部信息栏 */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-[oklch(0.14_0.025_260)]/90 backdrop-blur rounded-xl border border-[oklch(0.30_0.04_260)] px-4 py-2 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Eye size={12} className="text-amber-400" />
            <span className="text-[10px] text-slate-400 font-mono">
              {displayWindows.length === 0 ? '无窗口可预览'
                : selectedWindowId ? `预览: ${displayWindows[0]?.name || '选中窗口'}`
                : `全部 ${displayWindows.length} 个窗口`}
            </span>
          </div>
          {displayWindows.length > 0 && (
            <>
              <div className="w-px h-3 bg-[oklch(0.30_0.04_260)]" />
              <span className="text-[10px] text-slate-500 font-mono">
                鼠标拖拽旋转 · 滚轮缩放 · 右键平移
              </span>
            </>
          )}
        </div>
      </div>

      {/* Empty state */}
      {displayWindows.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-center">
            <div className="text-5xl mb-4 opacity-20">🪟</div>
            <p className="text-sm text-slate-500">请先在2D编辑器中创建窗口</p>
            <p className="text-xs text-slate-600 mt-1">然后切换到3D预览查看效果</p>
          </div>
        </div>
      )}
    </div>
  );
}
