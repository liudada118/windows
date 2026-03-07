// SceneFusion3D.tsx — 3D 实景融合组件 V3
// 真正的3D房间场景：照片贴到墙面 + 墙面挖窗洞 + 3D门窗模型 + OrbitControls旋转查看
// 流程: 上传照片 → AI检测窗洞 → 选择产品 → 3D场景预览（可旋转缩放）

import { useState, useRef, useCallback, useEffect } from 'react';
import type { WindowUnit } from '@/lib/types';
import { DEFAULT_PROFILE_SERIES } from '@/lib/types';
import {
  analyzeScene3D,
  mockScene3DAnalysis,
  loadPhotoTexture,
  SceneBuilder,
} from '@/lib/sceneFusion3D';
import type {
  WindowOpening,
  OpeningProduct,
} from '@/lib/sceneFusion3D';
import { WINDOW_TEMPLATES } from '@/lib/window-factory';
import { fileToBase64 } from '@/lib/photoRecognition';
import { toast } from 'sonner';
import {
  Upload, Loader2, Camera, FolderOpen, Info, Sparkles,
  RotateCcw, Settings, Download, Layers,
  Plus, X, Check, Package, Box, Grid3x3,
  Move3d, RefreshCw, ChevronDown, Sun,
  Eye, EyeOff, RotateCw, Maximize2,
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
  const [lightIntensity, setLightIntensity] = useState(1.0);
  const [showGrid, setShowGrid] = useState(true);
  const [currentView, setCurrentView] = useState<string>('front');

  // API 设置
  const [apiKey, setApiKey] = useState(getStoredApiKey());
  const [showApiSettings, setShowApiSettings] = useState(false);

  // 拖拽上传
  const [isDragOver, setIsDragOver] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const builderRef = useRef<SceneBuilder | null>(null);
  const animFrameRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
        await new Promise(r => setTimeout(r, 1500));
        result = mockScene3DAnalysis();
      }

      setOpenings(result.openings);
      setSceneDescription(result.sceneDescription);

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

    const series = DEFAULT_PROFILE_SERIES[2];
    const windowUnit = template.create(`scene-${openingId}`, 0, 0, series);

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

  const handleAssignExistingWindow = useCallback((openingId: string, win: WindowUnit) => {
    const opening = openings.find(o => o.id === openingId);
    if (!opening) return;

    const clonedWindow = JSON.parse(JSON.stringify(win));
    clonedWindow.id = `scene-${openingId}`;

    if (opening.estimatedWidth && opening.estimatedHeight) {
      clonedWindow.width = opening.estimatedWidth;
      clonedWindow.height = opening.estimatedHeight;
    }

    setProducts(prev => prev.map(p =>
      p.openingId === openingId ? { ...p, windowUnit: clonedWindow } : p
    ));
    setShowProductPicker(false);
    toast.success(`已为 ${opening.label} 添加 ${win.name}`);
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

  // ===== 3D 场景初始化（使用 SceneBuilder） =====
  useEffect(() => {
    if (step !== '3d-preview') return;
    const container = containerRef.current;
    if (!container) return;

    let builder: SceneBuilder;
    try {
      builder = new SceneBuilder(container);
      builderRef.current = builder;
    } catch (err: any) {
      toast.error('WebGL 初始化失败: ' + err.message);
      return;
    }

    // 加载照片并构建场景
    const initScene = async () => {
      try {
        // 1. 加载照片纹理
        if (photoUrl) {
          const photoTexture = await loadPhotoTexture(photoUrl);
          builder.setPhoto(photoTexture);
        }

        // 2. 构建墙体（带窗洞）
        builder.buildWall(openings);

        // 3. 在每个窗洞位置放入3D门窗模型
        for (const product of products) {
          if (!product.windowUnit) continue;
          const opening = openings.find(o => o.id === product.openingId);
          if (!opening) continue;
          builder.addWindowAtOpening(opening, product.windowUnit, product.materialConfig);
        }

        // 4. 设置初始视角
        builder.setViewAngle('front');

        setIs3DReady(true);
        toast.success('3D 场景构建完成，可拖拽旋转查看');
      } catch (err: any) {
        toast.error(`3D 场景构建失败: ${err.message}`);
      }
    };

    initScene();

    // 动画循环
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      builder.render();
    };
    animate();

    // 窗口大小变化
    const handleResize = () => {
      builder.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameRef.current);
      builder.dispose();
      builderRef.current = null;
      setIs3DReady(false);
    };
  }, [step]); // 只在进入3d-preview时初始化

  // ===== 光照变化 =====
  useEffect(() => {
    if (builderRef.current && is3DReady) {
      builderRef.current.setupLighting(lightIntensity);
    }
  }, [lightIntensity, is3DReady]);

  // ===== 网格显示 =====
  useEffect(() => {
    if (builderRef.current && is3DReady) {
      builderRef.current.toggleGrid(showGrid);
    }
  }, [showGrid, is3DReady]);

  // ===== 视角切换 =====
  const handleViewChange = useCallback((view: 'front' | 'left' | 'right' | 'top' | 'perspective' | 'back') => {
    if (builderRef.current) {
      builderRef.current.setViewAngle(view);
      setCurrentView(view);
    }
  }, []);

  // ===== 截图 =====
  const handleScreenshot = useCallback(() => {
    const builder = builderRef.current;
    if (!builder) return;

    const dataUrl = builder.screenshot();
    const link = document.createElement('a');
    link.download = `3D实景融合_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    toast.success('截图已下载');
  }, []);

  // ===== 重新开始 =====
  const handleReset = useCallback(() => {
    setStep('upload');
    setPhotoFile(null);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl('');
    setOpenings([]);
    setProducts([]);
    setSelectedOpeningId(null);
    setSceneDescription('');
    setIs3DReady(false);
  }, [photoUrl]);

  // ===== 渲染 =====
  const assignedCount = products.filter(p => p.windowUnit !== null).length;

  return (
    <div className="h-full flex flex-col bg-[oklch(0.12_0.02_260)]">
      {/* 顶部步骤条 */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[oklch(0.14_0.025_260)] border-b border-[oklch(0.20_0.03_260)]">
        <div className="flex items-center gap-1 text-xs">
          <StepIndicator number={1} label="上传照片" active={step === 'upload'} done={step !== 'upload'} />
          <span className="text-slate-600 mx-1">—</span>
          <StepIndicator number={2} label="AI检测" active={step === 'detecting'} done={step === 'assign-products' || step === '3d-preview'} />
          <span className="text-slate-600 mx-1">—</span>
          <StepIndicator number={3} label="选择产品" active={step === 'assign-products'} done={step === '3d-preview'} />
          <span className="text-slate-600 mx-1">—</span>
          <StepIndicator number={4} label="3D预览" active={step === '3d-preview'} done={false} />
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setShowApiSettings(!showApiSettings)}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Settings size={12} />
          API
        </button>

        <button
          onClick={handleReset}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RotateCcw size={12} />
          重新开始
        </button>
      </div>

      {/* API Key 设置 */}
      {showApiSettings && (
        <div className="px-4 py-2 bg-[oklch(0.11_0.02_260)] border-b border-[oklch(0.20_0.03_260)]">
          <div className="flex items-center gap-2">
            <input
              type="password"
              placeholder="输入 OpenAI API Key（留空使用演示模式）"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                storeApiKey(e.target.value);
              }}
              className="flex-1 px-3 py-1.5 bg-[oklch(0.15_0.02_260)] border border-[oklch(0.25_0.03_260)] rounded-lg text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
            />
            <button
              onClick={() => setShowApiSettings(false)}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">

        {/* ========== 步骤1: 上传照片 ========== */}
        {step === 'upload' && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div
              className={`w-full max-w-lg rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
                isDragOver
                  ? 'border-amber-400 bg-amber-500/10 scale-[1.02]'
                  : 'border-slate-600 bg-[oklch(0.13_0.02_260)] hover:border-slate-500'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <Upload size={28} className="text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">上传现场照片</h3>
              <p className="text-sm text-slate-500 mb-6">
                拍摄或上传包含窗洞/门洞的照片，AI 将自动识别洞口位置
              </p>

              <div className="flex items-center justify-center gap-3 mb-4">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraCapture} />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
                >
                  <FolderOpen size={16} />
                  选择图片
                </button>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-600 transition-all"
                >
                  <Camera size={16} />
                  拍照
                </button>
              </div>

              <p className="text-[10px] text-slate-600">
                支持拖拽上传 / Ctrl+V 粘贴 / JPG、PNG 格式 / 最大 20MB
              </p>
            </div>
          </div>
        )}

        {/* ========== 步骤2: AI 检测中 ========== */}
        {step === 'detecting' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles size={32} className="text-amber-400 animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">AI 正在分析场景...</h3>
              <p className="text-sm text-slate-500">识别照片中的窗洞位置和尺寸</p>
              <Loader2 size={20} className="text-amber-400 animate-spin mx-auto mt-4" />
            </div>
          </div>
        )}

        {/* ========== 步骤3: 选择产品 ========== */}
        {step === 'assign-products' && (
          <>
            {/* 左侧: 照片预览 + 窗洞标注 */}
            <div className="flex-1 flex items-center justify-center p-4 bg-[oklch(0.10_0.02_260)]">
              <div className="relative max-w-full max-h-full">
                {photoUrl && (
                  <img
                    src={photoUrl}
                    alt="场景照片"
                    className="max-w-full max-h-[calc(100vh-120px)] object-contain rounded-lg"
                  />
                )}
                {/* 窗洞标注覆盖层 */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {openings.map((opening) => {
                    const { topLeft, bottomRight } = opening.corners;
                    const x = topLeft.x * 100;
                    const y = topLeft.y * 100;
                    const w = (bottomRight.x - topLeft.x) * 100;
                    const h = (bottomRight.y - topLeft.y) * 100;
                    const centerX = x + w / 2;
                    const centerY = y + h / 2;
                    const product = products.find(p => p.openingId === opening.id);
                    const hasProduct = product?.windowUnit !== null;

                    return (
                      <g key={opening.id}>
                        <rect
                          x={`${x}%`} y={`${y}%`} width={`${w}%`} height={`${h}%`}
                          fill={hasProduct ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.1)'}
                          stroke={hasProduct ? '#f59e0b' : '#64748b'}
                          strokeWidth="0.5"
                          strokeDasharray={hasProduct ? 'none' : '2,2'}
                          rx="0.3"
                          className="pointer-events-auto cursor-pointer"
                          onClick={() => {
                            setSelectedOpeningId(opening.id);
                            setShowProductPicker(true);
                          }}
                        />
                        <text
                          x={`${centerX}%`} y={`${centerY - 3}%`}
                          textAnchor="middle"
                          fill={hasProduct ? '#f59e0b' : '#94a3b8'}
                          fontSize="3" fontWeight="600"
                        >
                          {opening.label}
                        </text>
                        {hasProduct && (
                          <text
                            x={`${centerX}%`} y={`${centerY + 3}%`}
                            textAnchor="middle" fill="#fbbf24" fontSize="2.5"
                          >
                            {product?.windowUnit?.name}
                          </text>
                        )}
                        {!hasProduct && (
                          <text
                            x={`${centerX}%`} y={`${centerY + 3}%`}
                            textAnchor="middle" fill="#64748b" fontSize="2.5"
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
            <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[oklch(0.08_0.02_260)]">
              {!is3DReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-[oklch(0.10_0.02_260)]">
                  <div className="text-center">
                    <Loader2 size={32} className="text-amber-400 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-slate-400">正在构建 3D 场景...</p>
                    <p className="text-xs text-slate-600 mt-1">照片映射到墙面 + 窗洞挖空 + 放入门窗模型</p>
                  </div>
                </div>
              )}

              {/* 3D 操作提示 */}
              {is3DReady && (
                <div className="absolute bottom-4 left-4 flex items-center gap-3 px-3 py-2 bg-black/50 backdrop-blur-sm rounded-lg text-[10px] text-slate-400">
                  <span>左键拖拽旋转</span>
                  <span className="text-slate-600">|</span>
                  <span>滚轮缩放</span>
                  <span className="text-slate-600">|</span>
                  <span>右键平移</span>
                </div>
              )}
            </div>

            {/* 右侧控制面板 */}
            <div className="w-72 bg-[oklch(0.13_0.02_260)] border-l border-[oklch(0.20_0.03_260)] overflow-y-auto flex flex-col">
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
                    { key: 'front', label: '正面' },
                    { key: 'left', label: '左侧' },
                    { key: 'right', label: '右侧' },
                    { key: 'top', label: '俯视' },
                    { key: 'perspective', label: '透视' },
                    { key: 'back', label: '背面' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => handleViewChange(key as any)}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                        currentView === key
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-[oklch(0.15_0.02_260)] text-slate-500 border border-transparent hover:text-slate-300 hover:bg-[oklch(0.18_0.02_260)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 场景设置 */}
              <div className="p-3 border-b border-[oklch(0.20_0.03_260)]">
                <h4 className="text-xs font-semibold text-slate-400 mb-2">场景设置</h4>
                <div className="space-y-3">
                  {/* 光照强度 */}
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-500 flex items-center gap-1"><Sun size={10} /> 光照强度</span>
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

                  {/* 网格显示 */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Grid3x3 size={10} /> 地面网格
                    </span>
                    <button
                      onClick={() => setShowGrid(!showGrid)}
                      className={`p-1 rounded transition-colors ${showGrid ? 'text-amber-400' : 'text-slate-600'}`}
                    >
                      {showGrid ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 操作说明 */}
              <div className="p-3 border-b border-[oklch(0.20_0.03_260)]">
                <h4 className="text-xs font-semibold text-slate-400 mb-2">操作说明</h4>
                <ul className="text-[10px] text-slate-500 space-y-1">
                  <li className="flex items-start gap-1.5">
                    <RotateCw size={10} className="shrink-0 mt-0.5" />
                    <span>鼠标左键拖拽旋转 3D 场景</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Maximize2 size={10} className="shrink-0 mt-0.5" />
                    <span>滚轮缩放，右键拖拽平移</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Move3d size={10} className="shrink-0 mt-0.5" />
                    <span>照片贴在墙面上，窗洞位置放入 3D 门窗</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Eye size={10} className="shrink-0 mt-0.5" />
                    <span>切换视角查看不同角度的安装效果</span>
                  </li>
                </ul>
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
                  onClick={() => {
                    setIs3DReady(false);
                    setStep('assign-products');
                  }}
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
