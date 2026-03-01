// WindoorDesigner - 3D预览组件
// Three.js渲染器，支持轨道控制、开启动画、多窗口展示
// 工业蓝图美学: 深色场景 + 铝合金质感 + 半透明玻璃
// 修复: WebGL上下文丢失恢复 + 降级渲染策略

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { WindowUnit } from '@/lib/types';
import { createWindow3D, createSceneEnvironment, createWallBackground } from '@/lib/window3d';
import {
  RotateCcw,
  Sun,
  Moon,
  DoorOpen,
  DoorClosed,
  Maximize2,
  Eye,
  Grid3x3,
  AlertTriangle,
} from 'lucide-react';

interface ThreePreviewProps {
  windows: WindowUnit[];
  selectedWindowId: string | null;
}

type ViewAngle = 'front' | 'back' | 'left' | 'right' | 'top' | 'perspective';

// 检测WebGL是否可用
function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

export default function ThreePreview({ windows, selectedWindowId }: ThreePreviewProps) {
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
  const [contextLostCount, setContextLostCount] = useState(0);

  // Determine which windows to show
  const displayWindows = selectedWindowId
    ? windows.filter(w => w.id === selectedWindowId)
    : windows;

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check WebGL availability
    if (!isWebGLAvailable()) {
      setWebglError('您的浏览器或设备不支持 WebGL，无法使用 3D 预览功能。');
      return;
    }

    // Scene
    const scene = new THREE.Scene();
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

    // Renderer - 使用降级策略提高兼容性
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'default', // 改为default，避免请求高性能GPU
        failIfMajorPerformanceCaveat: false, // 即使性能差也不失败
      });
    } catch (e) {
      setWebglError('WebGL 渲染器初始化失败，请尝试刷新页面或使用其他浏览器。');
      return;
    }

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // 降低像素比
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // 使用非弃用的阴影类型
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // WebGL上下文丢失/恢复事件处理
    const canvas = renderer.domElement;

    const handleContextLost = (event: Event) => {
      event.preventDefault(); // 必须调用preventDefault以允许恢复
      isContextLostRef.current = true;
      cancelAnimationFrame(animFrameRef.current);
      setContextLostCount(prev => prev + 1);
      console.warn('WebGL context lost, waiting for restoration...');
    };

    const handleContextRestored = () => {
      isContextLostRef.current = false;
      console.log('WebGL context restored, reinitializing...');

      // 重新设置渲染器
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;

      // 重新启动动画循环
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

    // Environment
    createSceneEnvironment(scene);

    // Animation loop
    const animate = () => {
      if (isContextLostRef.current) return;
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!container || isContextLostRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return; // 避免0尺寸
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

  // 上下文丢失后自动重试
  useEffect(() => {
    if (contextLostCount > 0 && contextLostCount <= 3) {
      // 延迟重建整个场景
      const timer = setTimeout(() => {
        const container = containerRef.current;
        const renderer = rendererRef.current;
        if (!container || !renderer || !isContextLostRef.current) return;

        // 强制重建：移除旧canvas，触发重新初始化
        console.log(`Attempting recovery #${contextLostCount}...`);

        // 尝试通过WEBGL_lose_context扩展恢复
        const gl = renderer.getContext();
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) {
          ext.restoreContext();
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [contextLostCount]);

  // Update dark/light mode
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

    // Update ground color
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.PlaneGeometry) {
        if (obj.geometry.parameters.width === 20) {
          (obj.material as THREE.MeshStandardMaterial).color.set(
            isDarkMode ? 0x2a2a35 : 0xd0ccc8
          );
        }
      }
    });
  }, [isDarkMode]);

  // Update grid
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove existing grid
    const existingGrid = scene.getObjectByName('grid-helper');
    if (existingGrid) scene.remove(existingGrid);

    if (showGrid) {
      const gridHelper = new THREE.GridHelper(10, 50, 0x444466, 0x333355);
      gridHelper.name = 'grid-helper';
      gridHelper.position.y = -0.005;
      scene.add(gridHelper);
    }
  }, [showGrid]);

  // Rebuild 3D models when windows or openAngle change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || isContextLostRef.current) return;

    // Remove old window group
    if (windowGroupRef.current) {
      scene.remove(windowGroupRef.current);
      windowGroupRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }

    const masterGroup = new THREE.Group();
    masterGroup.name = 'windows-group';

    if (displayWindows.length === 0) {
      windowGroupRef.current = masterGroup;
      scene.add(masterGroup);
      return;
    }

    // Layout multiple windows side by side
    let totalWidth = 0;
    const gaps = 0.3; // 300mm gap between windows
    const windowWidths = displayWindows.map(w => w.width * 0.001);
    totalWidth = windowWidths.reduce((sum, w) => sum + w, 0) + (displayWindows.length - 1) * gaps;

    let currentX = -totalWidth / 2;

    for (const win of displayWindows) {
      const w3d = createWindow3D(win, openAngle);
      const winW = win.width * 0.001;
      const winH = win.height * 0.001;

      // Re-center: createWindow3D already offsets by -w/2, -h/2
      // We need to shift X for side-by-side layout
      w3d.position.x += currentX + winW / 2;
      w3d.position.y += winH / 2;
      masterGroup.add(w3d);

      // Wall background
      if (showWall) {
        const wall = createWallBackground(win.width, win.height);
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
  }, [displayWindows, openAngle, showWall]);

  // Toggle open/close animation
  const toggleOpen = useCallback(() => {
    const targetAngle = isOpen ? 0 : Math.PI / 6; // 30 degrees
    const startAngle = openAngle;
    const startTime = performance.now();
    const duration = 600; // ms

    const animateAngle = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startAngle + (targetAngle - startAngle) * eased;
      setOpenAngle(current);

      if (progress < 1) {
        requestAnimationFrame(animateAngle);
      }
    };
    requestAnimationFrame(animateAngle);
    setIsOpen(!isOpen);
  }, [isOpen, openAngle]);

  // View angle presets
  const setViewAngle = useCallback((view: ViewAngle) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const maxH = displayWindows.length > 0
      ? Math.max(...displayWindows.map(w => w.height * 0.001))
      : 1.5;
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

    // Smooth transition
    const startPos = camera.position.clone();
    const endPos = new THREE.Vector3(px, py, pz);
    const startTime = performance.now();
    const duration = 500;

    const animateCamera = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      camera.position.lerpVectors(startPos, endPos, eased);
      controls.target.set(0, centerY, 0);
      controls.update();

      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      }
    };
    requestAnimationFrame(animateCamera);
  }, [displayWindows]);

  // Reset view
  const resetView = useCallback(() => {
    setViewAngle('perspective');
  }, [setViewAngle]);

  // WebGL不可用时的降级UI
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
      {/* Three.js canvas container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Context lost overlay */}
      {isContextLostRef.current && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
          <div className="text-center px-6">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <p className="text-sm text-slate-300 mb-2">3D 渲染上下文丢失</p>
            <p className="text-xs text-slate-500 mb-3">正在尝试恢复...</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
            >
              刷新页面
            </button>
          </div>
        </div>
      )}

      {/* Controls overlay - top left */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
        {/* View angle buttons */}
        <div className="bg-[oklch(0.14_0.025_260)]/90 backdrop-blur rounded-xl border border-[oklch(0.30_0.04_260)] p-1.5 flex flex-col gap-1">
          <button
            onClick={() => setViewAngle('front')}
            className="px-2.5 py-1.5 text-[10px] text-slate-300 hover:text-amber-400 hover:bg-white/10 rounded-lg transition-colors font-medium"
            title="正面视图"
          >
            正面
          </button>
          <button
            onClick={() => setViewAngle('back')}
            className="px-2.5 py-1.5 text-[10px] text-slate-300 hover:text-amber-400 hover:bg-white/10 rounded-lg transition-colors font-medium"
            title="背面视图"
          >
            背面
          </button>
          <button
            onClick={() => setViewAngle('left')}
            className="px-2.5 py-1.5 text-[10px] text-slate-300 hover:text-amber-400 hover:bg-white/10 rounded-lg transition-colors font-medium"
            title="左侧视图"
          >
            左侧
          </button>
          <button
            onClick={() => setViewAngle('right')}
            className="px-2.5 py-1.5 text-[10px] text-slate-300 hover:text-amber-400 hover:bg-white/10 rounded-lg transition-colors font-medium"
            title="右侧视图"
          >
            右侧
          </button>
          <button
            onClick={() => setViewAngle('top')}
            className="px-2.5 py-1.5 text-[10px] text-slate-300 hover:text-amber-400 hover:bg-white/10 rounded-lg transition-colors font-medium"
            title="俯视图"
          >
            俯视
          </button>
          <button
            onClick={() => setViewAngle('perspective')}
            className="px-2.5 py-1.5 text-[10px] text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors font-medium"
            title="透视图"
          >
            透视
          </button>
        </div>
      </div>

      {/* Controls overlay - top right */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        <div className="bg-[oklch(0.14_0.025_260)]/90 backdrop-blur rounded-xl border border-[oklch(0.30_0.04_260)] p-1.5 flex flex-col gap-1">
          {/* Open/Close toggle */}
          <button
            onClick={toggleOpen}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
              isOpen
                ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
            }`}
            title={isOpen ? '关闭窗户' : '打开窗户'}
          >
            {isOpen ? <DoorOpen size={18} /> : <DoorClosed size={18} />}
          </button>

          {/* Wall toggle */}
          <button
            onClick={() => setShowWall(!showWall)}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
              showWall
                ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
            }`}
            title={showWall ? '隐藏墙体' : '显示墙体'}
          >
            <Maximize2 size={16} />
          </button>

          {/* Grid toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
              showGrid
                ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
            }`}
            title={showGrid ? '隐藏网格' : '显示网格'}
          >
            <Grid3x3 size={16} />
          </button>

          {/* Dark/Light mode */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all"
            title={isDarkMode ? '切换亮色背景' : '切换暗色背景'}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Reset view */}
          <button
            onClick={resetView}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all"
            title="重置视角"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Bottom info bar */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-[oklch(0.14_0.025_260)]/90 backdrop-blur rounded-xl border border-[oklch(0.30_0.04_260)] px-4 py-2 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Eye size={12} className="text-amber-400" />
            <span className="text-[10px] text-slate-400 font-mono">
              {displayWindows.length === 0
                ? '无窗口可预览'
                : selectedWindowId
                  ? `预览: ${displayWindows[0]?.name || '选中窗口'}`
                  : `全部 ${displayWindows.length} 个窗口`
              }
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
