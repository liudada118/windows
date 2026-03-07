// SceneFusion3D.tsx — 3D 实景融合组件
// 功能: 上传照片 → AI检测窗洞 → 自由选择产品 → 3D场景预览（照片贴到3D墙面，窗洞放入3D门窗模型）
// 支持: 旋转/缩放/平移查看、每个窗洞独立选择产品、材质切换

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { WindowUnit } from '@/lib/types';
import { DEFAULT_PROFILE_SERIES } from '@/lib/types';
import {
  analyzeScene3D,
  mockScene3DAnalysis,
  buildScene3D,
  loadPhotoTexture,
  updateOpeningWindow,
  disposeScene3D,
} from '@/lib/sceneFusion3D';
import type {
  WindowOpening,
  OpeningProduct,
  Scene3DConfig,
} from '@/lib/sceneFusion3D';
import { WINDOW_TEMPLATES } from '@/lib/window-factory';
import { fileToBase64 } from '@/lib/photoRecognition';
import { createWindow3DV2 } from '@/lib/window3d-v2';
import type { MaterialConfig } from '@/lib/window3d-v2';
import { SOLID_COLORS, WOOD_GRAINS } from '@/lib/textures';
import { getAllColorOptions, getAllWoodGrainOptions } from '@/lib/window3d-v2';
import { toast } from 'sonner';
import {
  Upload, Loader2, Camera, FolderOpen, Info, Sparkles, Wand2,
  RotateCcw, ZoomIn, ZoomOut, Sun, Moon, Eye, EyeOff,
  ChevronDown, ChevronUp, Settings, Download, Layers,
  Plus, X, Check, Package, Palette, Box, Grid3x3,
  Move3d, Maximize2, RefreshCw,
} from 'lucide-react';

interface SceneFusion3DProps {
  windows: WindowUnit[];
  selectedWindowId: string | null;
}

type Step = 'upload' | 'detecting' | 'assign-products' | '3d-preview';

// API Key 管理
const API_KEY_STORAGE_KEY = 'windoor_openai_api_key';
function getStoredApiKey(): string {
  try { return localStorage.getItem(API_KEY_STORAGE_KEY) || ''; } catch { return ''; }
}
function storeApiKey(key: string): void {
  try { localStorage.setItem(API_KEY_STORAGE_KEY, key); } catch { /* ignore */ }
}

export default function SceneFusion3D({ windows, selectedWindowId }: SceneFusion3DProps) {
  // ===== 状态 =====
  const [step, setStep] = useState<Step>('upload');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [openings, setOpenings] = useState<WindowOpening[]>([]);
  const [products, setProducts] = useState<OpeningProduct[]>([]);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [sceneDescription, setSceneDescription] = useState('');

  // 3D 状态
  const [is3DReady, setIs3DReady] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showWireframe, setShowWireframe] = useState(false);
  const [lightIntensity, setLightIntensity] = useState(1.0);

  // API 设置
  const [apiKey, setApiKey] = useState(getStoredApiKey());
  const [showApiSettings, setShowApiSettings] = useState(false);

  // 拖拽上传
  const [isDragOver, setIsDragOver] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);
  const rootGroupRef = useRef<THREE.Group | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 3D 场景配置
  const sceneConfigRef = useRef<Scene3DConfig>({
    wallWidth: 4,
    wallHeight: 3,
    wallDepth: 0.2,
    photoTexture: null,
    openings: [],
    products: [],
    lightIntensity: 1.0,
    ambientIntensity: 0.6,
  });

  // ===== 文件上传 =====
  const loadImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('请上传图片文件（JPG、PNG 等）');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('图片大小不能超过20MB');
      return;
    }
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    toast.success('照片已加载');
    // 自动开始AI检测
    handleAIDetect(file);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImageFile(file);
    e.target.value = '';
  }, [loadImageFile]);

  const handleCameraCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImageFile(file);
    e.target.value = '';
  }, [loadImageFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadImageFile(file);
  }, [loadImageFile]);

  // 粘贴上传
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (step !== 'upload') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) { loadImageFile(file); break; }
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [step, loadImageFile]);

  // ===== AI 检测 =====
  const handleAIDetect = useCallback(async (file?: File) => {
    const targetFile = file || photoFile;
    if (!targetFile) return;

    setStep('detecting');

    try {
      let result;
      if (apiKey) {
        const base64 = await fileToBase64(targetFile);
        result = await analyzeScene3D(base64, apiKey);
      } else {
        // 演示模式
        await new Promise(r => setTimeout(r, 1500));
        result = mockScene3DAnalysis();
      }

      setOpenings(result.openings);
      setSceneDescription(result.sceneDescription);

      // 初始化产品绑定（全部为空）
      const initialProducts: OpeningProduct[] = result.openings.map(o => ({
        openingId: o.id,
        windowUnit: null,
      }));
      setProducts(initialProducts);
      setStep('assign-products');

      toast.success(`检测到 ${result.openings.length} 个窗洞`);
    } catch (err: any) {
      toast.error(`检测失败: ${err.message}`);
      setStep('upload');
    }
  }, [photoFile, apiKey]);

  // ===== 产品选择 =====
  const handleAssignProduct = useCallback((openingId: string, template: typeof WINDOW_TEMPLATES[0]) => {
    const opening = openings.find(o => o.id === openingId);
    if (!opening) return;

    const series = DEFAULT_PROFILE_SERIES[2]; // 默认70系列
    const windowUnit = template.create(
      `scene-${openingId}`,
      0, 0,
      series,
    );

    // 如果有估算尺寸，调整窗户尺寸
    if (opening.estimatedWidth && opening.estimatedHeight) {
      windowUnit.width = opening.estimatedWidth;
      windowUnit.height = opening.estimatedHeight;
    }

    setProducts(prev => prev.map(p =>
      p.openingId === openingId ? { ...p, windowUnit } : p
    ));
    setShowProductPicker(false);
    toast.success(`已为 ${opening.label} 添加 ${template.name}`);
  }, [openings]);

  const handleRemoveProduct = useCallback((openingId: string) => {
    setProducts(prev => prev.map(p =>
      p.openingId === openingId ? { ...p, windowUnit: null } : p
    ));
  }, []);

  // 使用已有设计的窗户
  const handleAssignExistingWindow = useCallback((openingId: string, window: WindowUnit) => {
    const opening = openings.find(o => o.id === openingId);
    if (!opening) return;

    // 克隆窗户数据
    const clonedWindow = JSON.parse(JSON.stringify(window));
    clonedWindow.id = `scene-${openingId}`;

    // 如果有估算尺寸，调整
    if (opening.estimatedWidth && opening.estimatedHeight) {
      clonedWindow.width = opening.estimatedWidth;
      clonedWindow.height = opening.estimatedHeight;
    }

    setProducts(prev => prev.map(p =>
      p.openingId === openingId ? { ...p, windowUnit: clonedWindow } : p
    ));
    setShowProductPicker(false);
    toast.success(`已为 ${opening.label} 添加 ${window.name}`);
  }, [openings]);

  // ===== 进入3D预览 =====
  const handleEnter3D = useCallback(() => {
    const hasAnyProduct = products.some(p => p.windowUnit !== null);
    if (!hasAnyProduct) {
      toast.error('请至少为一个窗洞选择门窗产品');
      return;
    }
    setStep('3d-preview');
  }, [products]);

  // ===== 3D 场景初始化 =====
  useEffect(() => {
    if (step !== '3d-preview') return;
    const container = containerRef.current;
    if (!container) return;

    // 创建场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDarkMode ? 0x1a1a2e : 0xf0f0f0);
    sceneRef.current = scene;

    // 相机
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.01,
      100,
    );
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    // 渲染器
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
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
      toast.error('WebGL 初始化失败');
      return;
    }

    // 轨道控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1;
    controls.maxDistance = 20;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 加载照片纹理并构建场景
    const initScene = async () => {
      try {
        let photoTexture: THREE.Texture | null = null;
        if (photoUrl) {
          photoTexture = await loadPhotoTexture(photoUrl);
          // 根据照片比例计算墙面尺寸
          const img = photoTexture.image as HTMLImageElement;
          const aspect = img.width / img.height;
          const wallHeight = 3;
          const wallWidth = wallHeight * aspect;
          sceneConfigRef.current.wallWidth = wallWidth;
          sceneConfigRef.current.wallHeight = wallHeight;
          sceneConfigRef.current.photoTexture = photoTexture;
        }

        sceneConfigRef.current.openings = openings;
        sceneConfigRef.current.products = products;
        sceneConfigRef.current.lightIntensity = lightIntensity;

        const rootGroup = buildScene3D(scene, sceneConfigRef.current);
        rootGroupRef.current = rootGroup;

        // 添加地面
        const groundGeo = new THREE.PlaneGeometry(20, 20);
        const groundMat = new THREE.MeshStandardMaterial({
          color: isDarkMode ? 0x2a2a35 : 0xcccccc,
          roughness: 0.9,
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -sceneConfigRef.current.wallHeight / 2 - 0.01;
        ground.receiveShadow = true;
        ground.name = 'ground';
        scene.add(ground);

        // 添加环境贴图
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        const envScene = new THREE.Scene();
        envScene.background = new THREE.Color(isDarkMode ? 0x1a1a2e : 0x87ceeb);
        const envMap = pmremGenerator.fromScene(envScene).texture;
        scene.environment = envMap;
        pmremGenerator.dispose();

        setIs3DReady(true);
      } catch (err: any) {
        toast.error(`3D 场景构建失败: ${err.message}`);
      }
    };

    initScene();

    // 动画循环
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 窗口大小变化
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      disposeScene3D(scene);
    };
  }, [step, photoUrl, openings, products, isDarkMode, lightIntensity]);

  // ===== 3D 视角控制 =====
  const resetCamera = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 0, 5);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  }, []);

  const handleScreenshot = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;

    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `实景融合3D_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    toast.success('截图已下载');
  }, []);

  // ===== 渲染 =====
  const assignedCount = products.filter(p => p.windowUnit !== null).length;

  return (
    <div className="h-full flex flex-col bg-[oklch(0.12_0.02_260)]">
      {/* 顶部步骤条 */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[oklch(0.14_0.025_260)] border-b border-[oklch(0.20_0.03_260)]">
        {/* 步骤指示器 */}
        <div className="flex items-center gap-1 text-xs">
          <StepIndicator
            number={1}
            label="上传照片"
            active={step === 'upload'}
            done={step !== 'upload'}
          />
          <span className="text-slate-600 mx-1">—</span>
          <StepIndicator
            number={2}
            label="AI检测"
            active={step === 'detecting'}
            done={step === 'assign-products' || step === '3d-preview'}
          />
          <span className="text-slate-600 mx-1">—</span>
          <StepIndicator
            number={3}
            label="选择产品"
            active={step === 'assign-products'}
            done={step === '3d-preview'}
          />
          <span className="text-slate-600 mx-1">—</span>
          <StepIndicator
            number={4}
            label="3D预览"
            active={step === '3d-preview'}
            done={false}
          />
        </div>

        <div className="flex-1" />

        {/* API 设置 */}
        <button
          onClick={() => setShowApiSettings(!showApiSettings)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Settings size={12} />
          API
        </button>

        {/* 重新开始 */}
        <button
          onClick={() => {
            setStep('upload');
            setPhotoFile(null);
            setPhotoUrl('');
            setOpenings([]);
            setProducts([]);
            setIs3DReady(false);
          }}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RotateCcw size={12} />
          重新开始
        </button>
      </div>

      {/* API Key 设置面板 */}
      {showApiSettings && (
        <div className="px-4 py-3 bg-[oklch(0.13_0.02_260)] border-b border-[oklch(0.20_0.03_260)]">
          <div className="flex items-center gap-2 max-w-lg">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); storeApiKey(e.target.value); }}
              placeholder="输入 OpenAI API Key（留空使用演示模式）"
              className="flex-1 px-3 py-1.5 bg-[oklch(0.10_0.02_260)] border border-[oklch(0.25_0.03_260)] rounded-lg text-xs text-slate-300 placeholder-slate-600"
            />
            <button
              onClick={() => setShowApiSettings(false)}
              className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs"
            >
              确定
            </button>
          </div>
          {!apiKey && (
            <p className="text-[10px] text-amber-500/70 mt-1">未设置 API Key，将使用演示模式（模拟检测结果）</p>
          )}
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* ========== 步骤1: 上传照片 ========== */}
        {step === 'upload' && (
          <div
            className="flex-1 flex items-center justify-center p-8"
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
            onDrop={handleDrop}
          >
            {isDragOver && (
              <div className="absolute inset-4 border-3 border-dashed border-amber-400 rounded-3xl bg-amber-500/10 flex items-center justify-center z-50 pointer-events-none">
                <div className="text-center">
                  <Upload className="w-16 h-16 text-amber-400 mx-auto mb-3 animate-bounce" />
                  <p className="text-lg font-semibold text-amber-300">松开即可上传</p>
                </div>
              </div>
            )}

            <div className="w-full max-w-lg">
              <div className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
                isDragOver ? 'border-amber-400 bg-amber-500/10' : 'border-slate-600 hover:border-amber-500/50 hover:bg-amber-500/5'
              }`}>
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-5">
                  <Move3d className="w-10 h-10 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-200 mb-2">3D 实景融合</h3>
                <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                  上传现场照片，AI 自动检测窗洞，自由选择门窗产品，在 <span className="text-amber-400 font-medium">3D 场景</span> 中预览安装效果
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400 transition-all w-full sm:w-auto justify-center"
                  >
                    <FolderOpen size={16} />
                    从相册选择
                  </button>
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[oklch(0.20_0.03_260)] border border-slate-600 text-slate-200 rounded-xl text-sm font-medium hover:bg-[oklch(0.25_0.03_260)] transition-all w-full sm:w-auto justify-center"
                  >
                    <Camera size={16} />
                    拍照上传
                  </button>
                </div>

                <div className="flex items-center justify-center gap-4 text-xs text-slate-600">
                  <span>拖拽图片到此处</span>
                  <span className="text-slate-700">|</span>
                  <span>Ctrl+V 粘贴</span>
                  <span className="text-slate-700">|</span>
                  <span>JPG / PNG</span>
                </div>
              </div>

              <div className="mt-4 bg-[oklch(0.14_0.02_260)] rounded-xl p-4 border border-[oklch(0.22_0.03_260)]">
                <h4 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                  <Info size={12} />
                  功能说明
                </h4>
                <ul className="text-xs text-slate-500 space-y-1">
                  <li>1. AI 自动识别照片中的所有窗洞位置</li>
                  <li>2. 为每个窗洞自由选择不同的门窗产品</li>
                  <li>3. 照片映射到 3D 墙面，窗洞中放入 3D 门窗模型</li>
                  <li>4. 可旋转、缩放、平移查看 3D 效果</li>
                </ul>
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileSelect} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleCameraCapture} />
            </div>
          </div>
        )}

        {/* ========== 步骤2: AI 检测中 ========== */}
        {step === 'detecting' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="relative w-48 h-48 mb-6 mx-auto">
                {photoUrl && (
                  <img src={photoUrl} alt="" className="w-full h-full rounded-2xl object-cover opacity-50" />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-black/70 flex items-center justify-center backdrop-blur-sm">
                    <Loader2 size={28} className="text-amber-400 animate-spin" />
                  </div>
                </div>
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">AI 正在分析照片...</h2>
              <p className="text-sm text-slate-400">正在识别窗洞位置、分析场景信息</p>
              <div className="mt-4 space-y-1.5">
                {['扫描墙面结构', '识别窗洞轮廓', '计算窗洞尺寸', '分析光照条件'].map((text, i) => (
                  <div key={text} className="flex items-center gap-2 text-xs text-slate-500 justify-center">
                    <div className={`w-1.5 h-1.5 rounded-full ${i < 2 ? 'bg-amber-400' : 'bg-slate-600'} animate-pulse`} />
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========== 步骤3: 选择产品 ========== */}
        {step === 'assign-products' && (
          <>
            {/* 左侧: 照片预览 + 窗洞标注 */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
              <div className="relative max-w-full max-h-full">
                {photoUrl && (
                  <img
                    src={photoUrl}
                    alt="现场照片"
                    className="max-w-full max-h-[calc(100vh-120px)] rounded-xl object-contain"
                  />
                )}
                {/* 窗洞标注覆盖层 */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {openings.map((opening) => {
                    const product = products.find(p => p.openingId === opening.id);
                    const hasProduct = product?.windowUnit !== null;
                    const isSelected = selectedOpeningId === opening.id;

                    const { topLeft, topRight, bottomLeft, bottomRight } = opening.corners;
                    const points = `${topLeft.x * 100}%,${topLeft.y * 100}% ${topRight.x * 100}%,${topRight.y * 100}% ${bottomRight.x * 100}%,${bottomRight.y * 100}% ${bottomLeft.x * 100}%,${bottomLeft.y * 100}%`;

                    const centerX = (topLeft.x + topRight.x + bottomLeft.x + bottomRight.x) / 4 * 100;
                    const centerY = (topLeft.y + topRight.y + bottomLeft.y + bottomRight.y) / 4 * 100;

                    return (
                      <g key={opening.id}>
                        <polygon
                          points={points}
                          fill={hasProduct ? 'rgba(245, 158, 11, 0.15)' : 'rgba(100, 116, 139, 0.15)'}
                          stroke={isSelected ? '#f59e0b' : hasProduct ? '#f59e0b' : '#64748b'}
                          strokeWidth={isSelected ? '3' : '2'}
                          strokeDasharray={hasProduct ? '' : '6 4'}
                          className="pointer-events-auto cursor-pointer"
                          onClick={() => {
                            setSelectedOpeningId(opening.id);
                            setShowProductPicker(true);
                          }}
                        />
                        <text
                          x={`${centerX}%`}
                          y={`${centerY - 3}%`}
                          textAnchor="middle"
                          fill={hasProduct ? '#f59e0b' : '#94a3b8'}
                          fontSize="12"
                          fontWeight="600"
                        >
                          {opening.label}
                        </text>
                        {hasProduct && (
                          <text
                            x={`${centerX}%`}
                            y={`${centerY + 3}%`}
                            textAnchor="middle"
                            fill="#fbbf24"
                            fontSize="10"
                          >
                            {product?.windowUnit?.name}
                          </text>
                        )}
                        {!hasProduct && (
                          <text
                            x={`${centerX}%`}
                            y={`${centerY + 3}%`}
                            textAnchor="middle"
                            fill="#64748b"
                            fontSize="10"
                            className="pointer-events-auto cursor-pointer"
                            onClick={() => {
                              setSelectedOpeningId(opening.id);
                              setShowProductPicker(true);
                            }}
                          >
                            + 点击添加产品
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* 右侧: 窗洞列表 + 产品选择 */}
            <div className="w-80 bg-[oklch(0.13_0.02_260)] border-l border-[oklch(0.20_0.03_260)] overflow-y-auto flex flex-col">
              <div className="p-4 border-b border-[oklch(0.20_0.03_260)]">
                <h3 className="text-sm font-semibold text-slate-200 mb-1">窗洞产品配置</h3>
                <p className="text-xs text-slate-500">{sceneDescription}</p>
                <p className="text-xs text-amber-500 mt-1">
                  已配置 {assignedCount}/{openings.length} 个窗洞
                </p>
              </div>

              {/* 窗洞列表 */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {openings.map((opening) => {
                  const product = products.find(p => p.openingId === opening.id);
                  const hasProduct = product?.windowUnit !== null;
                  const isSelected = selectedOpeningId === opening.id;

                  return (
                    <div
                      key={opening.id}
                      className={`rounded-xl p-3 border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10'
                          : hasProduct
                          ? 'border-[oklch(0.25_0.03_260)] bg-[oklch(0.15_0.02_260)]'
                          : 'border-dashed border-slate-600 bg-[oklch(0.12_0.02_260)]'
                      }`}
                      onClick={() => {
                        setSelectedOpeningId(opening.id);
                        if (!hasProduct) setShowProductPicker(true);
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-300">{opening.label}</span>
                        <span className="text-[10px] text-slate-500">{Math.round(opening.confidence * 100)}%</span>
                      </div>

                      {opening.estimatedWidth && opening.estimatedHeight && (
                        <p className="text-[10px] text-slate-500 mb-2">
                          估算尺寸: {opening.estimatedWidth} x {opening.estimatedHeight} mm
                        </p>
                      )}

                      {hasProduct ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Package size={14} className="text-amber-400" />
                            <span className="text-xs text-amber-300">{product?.windowUnit?.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOpeningId(opening.id);
                                setShowProductPicker(true);
                              }}
                              className="p-1 text-slate-500 hover:text-amber-400 transition-colors"
                              title="更换产品"
                            >
                              <RefreshCw size={12} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveProduct(opening.id);
                              }}
                              className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                              title="移除产品"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOpeningId(opening.id);
                            setShowProductPicker(true);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-slate-600 rounded-lg text-xs text-slate-500 hover:text-amber-400 hover:border-amber-500/50 transition-colors"
                        >
                          <Plus size={12} />
                          添加门窗产品
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 进入3D预览按钮 */}
              <div className="p-4 border-t border-[oklch(0.20_0.03_260)]">
                <button
                  onClick={handleEnter3D}
                  disabled={assignedCount === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Box size={16} />
                  进入 3D 预览
                </button>
              </div>
            </div>

            {/* 产品选择弹窗 */}
            {showProductPicker && selectedOpeningId && (
              <ProductPickerModal
                opening={openings.find(o => o.id === selectedOpeningId)!}
                existingWindows={windows}
                onSelectTemplate={(template) => handleAssignProduct(selectedOpeningId, template)}
                onSelectExisting={(win) => handleAssignExistingWindow(selectedOpeningId, win)}
                onClose={() => setShowProductPicker(false)}
              />
            )}
          </>
        )}

        {/* ========== 步骤4: 3D 预览 ========== */}
        {step === '3d-preview' && (
          <>
            {/* 3D 画布 */}
            <div ref={containerRef} className="flex-1 relative overflow-hidden">
              {!is3DReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-[oklch(0.10_0.02_260)]">
                  <div className="text-center">
                    <Loader2 size={32} className="text-amber-400 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-slate-400">正在构建 3D 场景...</p>
                  </div>
                </div>
              )}
            </div>

            {/* 右侧控制面板 */}
            <div className="w-72 bg-[oklch(0.13_0.02_260)] border-l border-[oklch(0.20_0.03_260)] overflow-y-auto flex flex-col">
              {/* 场景信息 */}
              <div className="p-4 border-b border-[oklch(0.20_0.03_260)]">
                <h3 className="text-sm font-semibold text-slate-200 mb-1">3D 实景预览</h3>
                <p className="text-xs text-slate-500">{sceneDescription}</p>
              </div>

              {/* 已安装的产品列表 */}
              <div className="p-3 border-b border-[oklch(0.20_0.03_260)]">
                <h4 className="text-xs font-semibold text-slate-400 mb-2">已安装产品</h4>
                <div className="space-y-1.5">
                  {products.filter(p => p.windowUnit).map((product) => {
                    const opening = openings.find(o => o.id === product.openingId);
                    return (
                      <div key={product.openingId} className="flex items-center gap-2 p-2 bg-[oklch(0.15_0.02_260)] rounded-lg">
                        <Package size={12} className="text-amber-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-slate-500 truncate">{opening?.label}</p>
                          <p className="text-xs text-slate-300 truncate">{product.windowUnit?.name}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 视角控制 */}
              <div className="p-3 border-b border-[oklch(0.20_0.03_260)]">
                <h4 className="text-xs font-semibold text-slate-400 mb-2">视角控制</h4>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: '正面', pos: [0, 0, 5] },
                    { label: '左侧', pos: [-5, 0, 0] },
                    { label: '右侧', pos: [5, 0, 0] },
                    { label: '俯视', pos: [0, 5, 2] },
                    { label: '透视', pos: [3, 2, 4] },
                    { label: '重置', pos: [0, 0, 5], reset: true },
                  ].map(({ label, pos, reset }) => (
                    <button
                      key={label}
                      onClick={() => {
                        if (!cameraRef.current || !controlsRef.current) return;
                        cameraRef.current.position.set(pos[0], pos[1], pos[2]);
                        controlsRef.current.target.set(0, 0, 0);
                        controlsRef.current.update();
                      }}
                      className="px-2 py-1.5 bg-[oklch(0.17_0.02_260)] text-slate-400 rounded-lg text-[10px] hover:bg-[oklch(0.22_0.03_260)] hover:text-slate-200 transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 光照控制 */}
              <div className="p-3 border-b border-[oklch(0.20_0.03_260)]">
                <h4 className="text-xs font-semibold text-slate-400 mb-2">场景设置</h4>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-500">光照强度</span>
                      <span className="text-slate-400 font-mono">{Math.round(lightIntensity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={2}
                      step={0.1}
                      value={lightIntensity}
                      onChange={(e) => setLightIntensity(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-700 rounded-full appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="p-4 mt-auto space-y-2">
                <button
                  onClick={handleScreenshot}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-semibold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
                >
                  <Download size={14} />
                  下载截图
                </button>
                <button
                  onClick={() => setStep('assign-products')}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-xs hover:bg-slate-600 transition-colors"
                >
                  <RefreshCw size={12} />
                  修改产品配置
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===== 辅助组件 =====

/** 步骤指示器 */
function StepIndicator({ number, label, active, done }: {
  number: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${active ? 'text-amber-400' : done ? 'text-green-400' : 'text-slate-600'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
        active ? 'bg-amber-500 text-white' :
        done ? 'bg-green-500/20 text-green-400' :
        'bg-slate-700 text-slate-500'
      }`}>
        {done ? <Check size={10} /> : number}
      </div>
      <span className="text-[11px] font-medium hidden sm:inline">{label}</span>
    </div>
  );
}

/** 产品选择弹窗 */
function ProductPickerModal({
  opening,
  existingWindows,
  onSelectTemplate,
  onSelectExisting,
  onClose,
}: {
  opening: WindowOpening;
  existingWindows: WindowUnit[];
  onSelectTemplate: (template: typeof WINDOW_TEMPLATES[0]) => void;
  onSelectExisting: (win: WindowUnit) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'templates' | 'existing'>('templates');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[oklch(0.14_0.02_260)] rounded-2xl border border-[oklch(0.22_0.03_260)] w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-[oklch(0.20_0.03_260)]">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">选择门窗产品</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              为 <span className="text-amber-400">{opening.label}</span> 选择门窗
              {opening.estimatedWidth && opening.estimatedHeight && (
                <span className="ml-1">（{opening.estimatedWidth} x {opening.estimatedHeight} mm）</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-[oklch(0.20_0.03_260)]">
          <button
            onClick={() => setTab('templates')}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
              tab === 'templates' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Grid3x3 size={12} className="inline mr-1.5" />
            窗型模板
          </button>
          <button
            onClick={() => setTab('existing')}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
              tab === 'existing' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Layers size={12} className="inline mr-1.5" />
            已有设计 ({existingWindows.length})
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'templates' ? (
            <div className="grid grid-cols-2 gap-3">
              {WINDOW_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => onSelectTemplate(template)}
                  className="flex flex-col items-center gap-2 p-4 bg-[oklch(0.12_0.02_260)] rounded-xl border border-[oklch(0.22_0.03_260)] hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-center"
                >
                  <span className="text-2xl">{template.icon}</span>
                  <span className="text-xs font-medium text-slate-300">{template.name}</span>
                  <span className="text-[10px] text-slate-500">{template.description}</span>
                  <span className="text-[10px] text-slate-600">{template.width} x {template.height}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {existingWindows.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  <Layers size={24} className="mx-auto mb-2 opacity-50" />
                  暂无已有设计，请先在 2D 编辑器中创建窗户
                </div>
              ) : (
                existingWindows.map((win) => (
                  <button
                    key={win.id}
                    onClick={() => onSelectExisting(win)}
                    className="w-full flex items-center gap-3 p-3 bg-[oklch(0.12_0.02_260)] rounded-xl border border-[oklch(0.22_0.03_260)] hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Package size={18} className="text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-300 truncate">{win.name}</p>
                      <p className="text-[10px] text-slate-500">{win.width} x {win.height} mm</p>
                    </div>
                    <ChevronDown size={14} className="text-slate-600 -rotate-90" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
