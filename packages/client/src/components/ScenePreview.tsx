// WindoorDesigner - 实景融合预览 V2.0
// 功能: 上传实景照片 → AI自动检测窗洞 / 手动框选 → 3D门窗透视变换叠加 → 高质量效果图
// 支持: AI门洞检测、四角透视校正、阴影融合、边缘羽化、色温匹配、玻璃反射
// 双模式: AI自动检测 + 手动框选

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { WindowUnit } from '@/lib/types';
import { DEFAULT_PROFILE_SERIES } from '@/lib/types';
import {
  analyzeScenePhoto,
  mockSceneAnalysis,
  captureWindow3DSnapshot,
  compositeWindowToScene,
  createRegionFromRect,
  getRegionBBox,
  DEFAULT_COMPOSITE_PARAMS,
} from '@/lib/sceneFusion';
import type {
  SceneAnalysisResult,
  WindowOpeningRegion,
  CompositeParams,
} from '@/lib/sceneFusion';
import { fileToBase64 } from '@/lib/photoRecognition';
import { toast } from 'sonner';
import {
  Upload,
  ImageIcon,
  Move,
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Check,
  X,
  Sun,
  Layers,
  Eye,
  EyeOff,
  Trash2,
  Sparkles,
  Settings,
  Loader2,
  MousePointer,
  ScanLine,
  Maximize2,
  Sliders,
  Palette,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
  Wand2,
  Camera,
  Clipboard,
  FolderOpen,
} from 'lucide-react';

interface ScenePreviewProps {
  windows: WindowUnit[];
  selectedWindowId: string | null;
}

type Step = 'upload' | 'detecting' | 'select-region' | 'adjusting' | 'result';
type DetectMode = 'ai' | 'manual';

// API Key 管理
const API_KEY_STORAGE_KEY = 'windoor_openai_api_key';
function getStoredApiKey(): string {
  try { return localStorage.getItem(API_KEY_STORAGE_KEY) || ''; } catch { return ''; }
}
function storeApiKey(key: string) {
  try { localStorage.setItem(API_KEY_STORAGE_KEY, key); } catch { /* ignore */ }
}

export default function ScenePreview({ windows, selectedWindowId }: ScenePreviewProps) {
  // 步骤状态
  const [step, setStep] = useState<Step>('upload');
  const [detectMode, setDetectMode] = useState<DetectMode>('ai');

  // 照片
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>('');

  // AI 检测结果
  const [analysisResult, setAnalysisResult] = useState<SceneAnalysisResult | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 手动框选
  const [isDrawingRegion, setIsDrawingRegion] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [drawCurrent, setDrawCurrent] = useState({ x: 0, y: 0 });
  const [manualRegion, setManualRegion] = useState<WindowOpeningRegion | null>(null);

  // 四角编辑
  const [editingCorners, setEditingCorners] = useState<WindowOpeningRegion['corners'] | null>(null);
  const [draggingCorner, setDraggingCorner] = useState<string | null>(null);

  // 合成参数
  const [params, setParams] = useState<CompositeParams>({ ...DEFAULT_COMPOSITE_PARAMS });

  // 合成结果
  const [compositeUrl, setCompositeUrl] = useState<string>('');
  const [isCompositing, setIsCompositing] = useState(false);

  // API Key
  const [apiKey, setApiKey] = useState(getStoredApiKey());
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 拖拽上传状态
  const [isDragOver, setIsDragOver] = useState(false);

  // 显示尺寸
  const [displaySize, setDisplaySize] = useState({ width: 800, height: 600 });

  // 选择要融合的窗口
  const targetWindow = useMemo(() => {
    if (selectedWindowId) return windows.find(w => w.id === selectedWindowId);
    return windows[0];
  }, [windows, selectedWindowId]);

  // 当前活跃的区域
  const activeRegion = useMemo((): WindowOpeningRegion | null => {
    if (detectMode === 'manual' && manualRegion) return manualRegion;
    if (analysisResult && selectedRegionId) {
      return analysisResult.openings.find(o => o.id === selectedRegionId) || null;
    }
    if (analysisResult && analysisResult.openings.length > 0) {
      return analysisResult.openings[0];
    }
    return null;
  }, [detectMode, manualRegion, analysisResult, selectedRegionId]);

  // ========== 通用图片加载 ==========
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
    const img = new Image();
    img.onload = () => {
      setPhoto(img);
      setPhotoUrl(url);
      setStep('select-region');
      setAnalysisResult(null);
      setManualRegion(null);
      setCompositeUrl('');
      setEditingCorners(null);
      setIsDragOver(false);
      toast.success('照片已加载，请选择窗洞区域');
    };
    img.onerror = () => {
      toast.error('图片加载失败，请重试');
    };
    img.src = url;
  }, []);

  // ========== 从相册/文件选择 ==========
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadImageFile(file);
    // 重置 input 以允许重复选择同一文件
    e.target.value = '';
  }, [loadImageFile]);

  // ========== 拍照上传 ==========
  const handleCameraCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadImageFile(file);
    e.target.value = '';
  }, [loadImageFile]);

  // ========== 拖拽上传 ==========
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    loadImageFile(file);
  }, [loadImageFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  // ========== 粘贴上传 ==========
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (step !== 'upload') return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          loadImageFile(file);
          toast.success('已从剪贴板粘贴图片');
          break;
        }
      }
    }
  }, [step, loadImageFile]);

  // 监听全局粘贴事件
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // ========== AI 自动检测 ==========
  const handleAIDetect = useCallback(async () => {
    if (!photoFile) return;
    setIsAnalyzing(true);
    setStep('detecting');

    try {
      let result: SceneAnalysisResult;
      if (apiKey) {
        storeApiKey(apiKey);
        const base64 = await fileToBase64(photoFile);
        result = await analyzeScenePhoto(base64, apiKey, photoFile.type);
      } else {
        await new Promise(r => setTimeout(r, 2000));
        result = mockSceneAnalysis();
        toast.info('未配置API Key，使用演示数据');
      }

      setAnalysisResult(result);
      if (result.openings.length > 0) {
        setSelectedRegionId(result.openings[0].id);
        setEditingCorners({ ...result.openings[0].corners });
      }
      setDetectMode('ai');
      setStep('adjusting');
      toast.success(`检测到 ${result.openings.length} 个窗洞`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '检测失败';
      toast.error(msg);
      setStep('select-region');
    } finally {
      setIsAnalyzing(false);
    }
  }, [photoFile, apiKey]);

  // ========== 手动框选 ==========
  const getCanvasCoords = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (step !== 'select-region' || detectMode !== 'manual') return;

    // 检查是否点击了角点
    if (editingCorners && photo) {
      const coords = getCanvasCoords(e);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scaleX = canvas.width / canvas.clientWidth;
      const scaleY = canvas.height / canvas.clientHeight;
      const cx = coords.x * scaleX;
      const cy = coords.y * scaleY;

      const cornerNames = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;
      for (const name of cornerNames) {
        const corner = editingCorners[name];
        const px = corner.x * canvas.width;
        const py = corner.y * canvas.height;
        if (Math.abs(cx - px) < 15 && Math.abs(cy - py) < 15) {
          setDraggingCorner(name);
          return;
        }
      }
    }

    // 开始框选
    e.preventDefault();
    const coords = getCanvasCoords(e);
    setIsDrawingRegion(true);
    setDrawStart(coords);
    setDrawCurrent(coords);
  }, [step, detectMode, editingCorners, photo, getCanvasCoords]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingCorner && editingCorners) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const coords = getCanvasCoords(e);
      const scaleX = canvas.width / canvas.clientWidth;
      const scaleY = canvas.height / canvas.clientHeight;
      const nx = (coords.x * scaleX) / canvas.width;
      const ny = (coords.y * scaleY) / canvas.height;

      setEditingCorners(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          [draggingCorner]: { x: Math.max(0, Math.min(1, nx)), y: Math.max(0, Math.min(1, ny)) },
        };
      });
      return;
    }

    if (!isDrawingRegion) return;
    const coords = getCanvasCoords(e);
    setDrawCurrent(coords);
  }, [isDrawingRegion, draggingCorner, editingCorners, getCanvasCoords]);

  const handleCanvasMouseUp = useCallback(() => {
    if (draggingCorner) {
      setDraggingCorner(null);
      return;
    }

    if (!isDrawingRegion) return;
    setIsDrawingRegion(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const scaleX = canvas.width / canvas.clientWidth;
    const scaleY = canvas.height / canvas.clientHeight;
    const x = Math.min(drawStart.x, drawCurrent.x) * scaleX;
    const y = Math.min(drawStart.y, drawCurrent.y) * scaleY;
    const width = Math.abs(drawCurrent.x - drawStart.x) * scaleX;
    const height = Math.abs(drawCurrent.y - drawStart.y) * scaleY;

    if (width < 30 || height < 30) return;

    const region = createRegionFromRect(x, y, width, height, canvas.width, canvas.height);
    setManualRegion(region);
    setEditingCorners({ ...region.corners });
    setDetectMode('manual');
    setStep('adjusting');
  }, [isDrawingRegion, drawStart, drawCurrent, draggingCorner]);

  // ========== 生成效果图 ==========
  const handleComposite = useCallback(async () => {
    if (!photo || !targetWindow) return;

    const region = activeRegion;
    if (!region) {
      toast.error('请先选择窗洞区域');
      return;
    }

    // 如果有编辑过的角点，使用编辑后的
    const finalRegion = editingCorners ? { ...region, corners: editingCorners } : region;

    setIsCompositing(true);

    try {
      // 1. 生成3D门窗截图
      const snapshot = captureWindow3DSnapshot(targetWindow, 1024, 1024);
      if (!snapshot) {
        toast.error('3D渲染失败');
        return;
      }

      // 2. 创建原始照片Canvas
      const photoCanvas = document.createElement('canvas');
      photoCanvas.width = photo.naturalWidth;
      photoCanvas.height = photo.naturalHeight;
      const pCtx = photoCanvas.getContext('2d')!;
      pCtx.drawImage(photo, 0, 0);

      // 3. 合成
      const resultUrl = await compositeWindowToScene(photoCanvas, snapshot, finalRegion, params);
      setCompositeUrl(resultUrl);
      setStep('result');
      toast.success('效果图生成成功');
    } catch (err) {
      toast.error(`合成失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsCompositing(false);
    }
  }, [photo, targetWindow, activeRegion, editingCorners, params]);

  // ========== Canvas 绘制 ==========
  useEffect(() => {
    if (!photo || !canvasRef.current) return;
    if (step === 'upload' || step === 'detecting') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    // 计算显示尺寸（保持纵横比）
    const maxW = container.clientWidth;
    const maxH = container.clientHeight;
    const photoAspect = photo.naturalWidth / photo.naturalHeight;
    let dw = maxW;
    let dh = maxW / photoAspect;
    if (dh > maxH) {
      dh = maxH;
      dw = maxH * photoAspect;
    }

    canvas.width = dw;
    canvas.height = dh;
    canvas.style.width = `${dw}px`;
    canvas.style.height = `${dh}px`;
    setDisplaySize({ width: dw, height: dh });

    // 清空
    ctx.clearRect(0, 0, dw, dh);

    if (step === 'result' && compositeUrl) {
      // 结果模式：显示合成图
      const resultImg = new Image();
      resultImg.onload = () => {
        ctx.drawImage(resultImg, 0, 0, dw, dh);
      };
      resultImg.src = compositeUrl;
      return;
    }

    // 绘制照片
    ctx.drawImage(photo, 0, 0, dw, dh);

    // 绘制 AI 检测到的所有区域
    if (analysisResult && detectMode === 'ai') {
      for (const opening of analysisResult.openings) {
        const isSelected = opening.id === selectedRegionId;
        drawRegionOverlay(ctx, opening, dw, dh, isSelected);
      }
    }

    // 绘制编辑中的角点
    if (editingCorners && step === 'adjusting') {
      drawCornerHandles(ctx, editingCorners, dw, dh);
    }

    // 绘制手动框选区域
    if (manualRegion && detectMode === 'manual' && step !== 'result') {
      drawRegionOverlay(ctx, manualRegion, dw, dh, true);
    }

    // 绘制正在框选的区域
    if (isDrawingRegion) {
      const scaleX = canvas.width / canvas.clientWidth;
      const scaleY = canvas.height / canvas.clientHeight;
      const x = Math.min(drawStart.x, drawCurrent.x) * scaleX;
      const y = Math.min(drawStart.y, drawCurrent.y) * scaleY;
      const w = Math.abs(drawCurrent.x - drawStart.x) * scaleX;
      const h = Math.abs(drawCurrent.y - drawStart.y) * scaleY;

      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
      ctx.fillRect(x, y, w, h);

      // 十字准星
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w / 2, y + h);
      ctx.moveTo(x, y + h / 2);
      ctx.lineTo(x + w, y + h / 2);
      ctx.stroke();
      ctx.restore();
    }
  }, [photo, step, compositeUrl, analysisResult, selectedRegionId, detectMode,
    manualRegion, editingCorners, isDrawingRegion, drawStart, drawCurrent]);

  // ========== 下载 ==========
  const handleDownload = useCallback(() => {
    if (!compositeUrl) return;
    const a = document.createElement('a');
    a.href = compositeUrl;
    a.download = `windoor-scene-fusion-${Date.now()}.jpg`;
    a.click();
    toast.success('效果图已下载');
  }, [compositeUrl]);

  // ========== 重置 ==========
  const handleReset = useCallback(() => {
    setStep('upload');
    setPhoto(null);
    setPhotoFile(null);
    setPhotoUrl('');
    setAnalysisResult(null);
    setManualRegion(null);
    setCompositeUrl('');
    setEditingCorners(null);
    setSelectedRegionId('');
    setParams({ ...DEFAULT_COMPOSITE_PARAMS });
  }, []);

  const handleReselect = useCallback(() => {
    setStep('select-region');
    setManualRegion(null);
    setCompositeUrl('');
    setEditingCorners(null);
  }, []);

  // ========== 无窗口提示 ==========
  if (!targetWindow) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[oklch(0.10_0.02_260)]">
        <div className="text-center px-8">
          <ImageIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-300 mb-2">请先创建门窗</h3>
          <p className="text-sm text-slate-500 max-w-sm">
            在2D编辑器中创建门窗设计后，切换到实景模式即可将门窗融合到现场照片中。
          </p>
        </div>
      </div>
    );
  }

  // ========== 渲染 ==========
  return (
    <div className="flex-1 flex flex-col bg-[oklch(0.10_0.02_260)] overflow-hidden">
      {/* 顶部步骤指示器 */}
      <div className="h-12 bg-[oklch(0.13_0.022_260)] border-b border-[oklch(0.25_0.035_260)] flex items-center px-4 gap-3 shrink-0">
        {[
          { key: 'upload', label: '上传照片', icon: Upload },
          { key: 'select-region', label: '选择窗洞', icon: Crosshair },
          { key: 'adjusting', label: '调整位置', icon: Sliders },
          { key: 'result', label: '效果图', icon: ImageIcon },
        ].map((s, i) => {
          const stepOrder = ['upload', 'detecting', 'select-region', 'adjusting', 'result'];
          const isActive = step === s.key || (step === 'detecting' && s.key === 'select-region');
          const isPast = stepOrder.indexOf(step) > stepOrder.indexOf(s.key);
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <div className={`w-6 h-px ${isPast ? 'bg-amber-500' : 'bg-slate-700'}`} />}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all ${
                isActive ? 'bg-amber-500/20 text-amber-400 font-medium'
                  : isPast ? 'text-amber-500/60' : 'text-slate-600'
              }`}>
                {isPast ? <Check size={12} /> : <Icon size={12} />}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            </div>
          );
        })}

        <div className="flex-1" />

        {/* API 设置 */}
        <button
          onClick={() => setShowApiSettings(!showApiSettings)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 rounded-md hover:bg-white/5 transition-colors"
        >
          <Settings size={12} />
          <span className="hidden sm:inline">API</span>
        </button>

        {step !== 'upload' && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 rounded-md hover:bg-white/5 transition-colors"
          >
            <RotateCcw size={12} />
            <span className="hidden sm:inline">重新开始</span>
          </button>
        )}
      </div>

      {/* API Key 设置面板 */}
      {showApiSettings && (
        <div className="bg-[oklch(0.15_0.025_260)] border-b border-[oklch(0.25_0.035_260)] px-4 py-3">
          <div className="max-w-xl mx-auto flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">OpenAI API Key:</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-black/30 border border-slate-700 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
            <button
              onClick={() => { storeApiKey(apiKey); setShowApiSettings(false); toast.success('已保存'); }}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs hover:bg-amber-500/30"
            >
              保存
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 max-w-xl mx-auto">
            配置后可使用AI自动检测窗洞位置。不配置则使用演示数据或手动框选。
          </p>
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧: 画布区域 */}
        <div ref={containerRef} className="flex-1 overflow-hidden relative">
          {step === 'upload' ? (
            <div
              className="absolute inset-0 flex items-center justify-center p-8"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* 拖拽覆盖层 */}
              {isDragOver && (
                <div className="absolute inset-4 border-3 border-dashed border-amber-400 rounded-3xl bg-amber-500/10 flex items-center justify-center z-50 pointer-events-none">
                  <div className="text-center">
                    <Upload className="w-16 h-16 text-amber-400 mx-auto mb-3 animate-bounce" />
                    <p className="text-lg font-semibold text-amber-300">松开即可上传</p>
                  </div>
                </div>
              )}

              <div className="w-full max-w-lg">
                {/* 主上传区域 */}
                <div className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
                  isDragOver
                    ? 'border-amber-400 bg-amber-500/10'
                    : 'border-slate-600 hover:border-amber-500/50 hover:bg-amber-500/5'
                }`}>
                  <div className="w-20 h-20 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-5">
                    <Layers className="w-10 h-10 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-200 mb-2">上传现场照片</h3>
                  <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                    拍摄或选择窗洞位置的照片，系统将把您设计的 <span className="text-amber-400 font-medium">{targetWindow.name}</span> 融合到照片中。
                  </p>

                  {/* 三个上传按钮 */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
                    {/* 从相册选择 */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400 transition-all w-full sm:w-auto justify-center"
                    >
                      <FolderOpen size={16} />
                      从相册选择
                    </button>

                    {/* 拍照上传 */}
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[oklch(0.20_0.03_260)] border border-slate-600 text-slate-200 rounded-xl text-sm font-medium hover:bg-[oklch(0.25_0.03_260)] transition-all w-full sm:w-auto justify-center"
                    >
                      <Camera size={16} />
                      拍照上传
                    </button>
                  </div>

                  {/* 提示信息 */}
                  <div className="flex items-center justify-center gap-4 text-xs text-slate-600">
                    <span>拖拽图片到此处</span>
                    <span className="text-slate-700">|</span>
                    <span>Ctrl+V 粘贴截图</span>
                    <span className="text-slate-700">|</span>
                    <span>JPG / PNG ≤ 20MB</span>
                  </div>
                </div>

                {/* 建议提示 */}
                <div className="mt-4 bg-[oklch(0.14_0.02_260)] rounded-xl p-4 border border-[oklch(0.22_0.03_260)]">
                  <h4 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                    <Info size={12} />
                    拍摄建议
                  </h4>
                  <ul className="text-xs text-slate-500 space-y-1">
                    <li>• 建议正对窗洞拍摄，避免过大的透视角度</li>
                    <li>• 保证光线充足，窗洞区域清晰可见</li>
                    <li>• 尽量包含完整的窗洞和周围墙面</li>
                  </ul>
                </div>

                {/* 隐藏的 file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFileSelect}
                />
                {/* 拍照专用 input（移动端会调起摄像头） */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={handleCameraCapture}
                />
              </div>
            </div>
          ) : step === 'detecting' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative w-48 h-48 mb-6">
                {photoUrl && (
                  <img src={photoUrl} alt="" className="w-full h-full rounded-2xl object-cover opacity-50" />
                )}
                <div className="absolute inset-0 rounded-2xl overflow-hidden">
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-bounce" style={{ animationDuration: '1.5s' }} />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-black/70 flex items-center justify-center backdrop-blur-sm">
                    <Loader2 size={28} className="text-amber-400 animate-spin" />
                  </div>
                </div>
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">AI 正在分析照片...</h2>
              <p className="text-sm text-slate-400">正在识别窗洞位置、分析光照条件</p>
              <div className="mt-4 space-y-1.5">
                {['扫描墙面结构', '识别窗洞轮廓', '计算透视角度', '分析光照条件'].map((text, i) => (
                  <div key={text} className="flex items-center gap-2 text-xs text-slate-500">
                    <div className={`w-1.5 h-1.5 rounded-full ${i < 2 ? 'bg-amber-400' : 'bg-slate-600'} animate-pulse`} />
                    {text}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 overflow-auto flex items-center justify-center bg-[oklch(0.08_0.01_260)]">
              <canvas
                ref={canvasRef}
                className={`max-w-full max-h-full ${
                  step === 'select-region' && detectMode === 'manual' ? 'cursor-crosshair' :
                  draggingCorner ? 'cursor-grabbing' : 'cursor-default'
                }`}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={() => {
                  if (isDrawingRegion) setIsDrawingRegion(false);
                  if (draggingCorner) setDraggingCorner(null);
                }}
              />
            </div>
          )}
        </div>

        {/* 右侧: 控制面板 */}
        {step !== 'upload' && step !== 'detecting' && (
          <div className="w-72 bg-[oklch(0.13_0.022_260)] border-l border-[oklch(0.25_0.035_260)] overflow-y-auto shrink-0">
            <div className="p-4 space-y-4">
              {/* 门窗信息 */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">融合门窗</h4>
                <div className="bg-[oklch(0.17_0.028_260)] rounded-lg p-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">名称</span>
                    <span className="text-slate-300">{targetWindow.name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">尺寸</span>
                    <span className="text-amber-400 font-mono">{targetWindow.width} x {targetWindow.height} mm</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">型材</span>
                    <span className="text-slate-300">{DEFAULT_PROFILE_SERIES.find(s => s.id === targetWindow.profileSeriesId)?.name || '70系列'}</span>
                  </div>
                </div>
              </div>

              {/* 检测模式选择 */}
              {step === 'select-region' && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">选择窗洞</h4>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      onClick={handleAIDetect}
                      disabled={isAnalyzing}
                      className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-gradient-to-b from-purple-500/20 to-purple-500/10 border border-purple-500/30 text-purple-300 hover:from-purple-500/30 hover:to-purple-500/20 transition-all disabled:opacity-50"
                    >
                      <Wand2 size={18} />
                      <span className="text-[10px] font-medium">AI 自动检测</span>
                    </button>
                    <button
                      onClick={() => { setDetectMode('manual'); toast.info('请在照片上拖拽框选窗洞区域'); }}
                      className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border transition-all ${
                        detectMode === 'manual'
                          ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                          : 'bg-white/5 border-slate-700 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      <Crosshair size={18} />
                      <span className="text-[10px] font-medium">手动框选</span>
                    </button>
                  </div>

                  {detectMode === 'manual' && !manualRegion && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                      <p className="text-xs text-amber-400/80">
                        在照片上拖拽鼠标，框选出窗洞的位置和大小
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* AI 检测结果 */}
              {analysisResult && step !== 'result' && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    <Sparkles size={11} className="inline mr-1" />
                    AI 检测结果
                  </h4>
                  <div className="space-y-2">
                    {analysisResult.openings.map((opening) => (
                      <button
                        key={opening.id}
                        onClick={() => {
                          setSelectedRegionId(opening.id);
                          setEditingCorners({ ...opening.corners });
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                          selectedRegionId === opening.id
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                            : 'bg-white/5 border-slate-700/50 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">{opening.label}</span>
                          <span className="text-[10px] text-slate-500">{Math.round(opening.confidence * 100)}%</span>
                        </div>
                        {opening.estimatedWidth && opening.estimatedHeight && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            约 {opening.estimatedWidth} x {opening.estimatedHeight} mm
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  {analysisResult.sceneDescription && (
                    <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                      {analysisResult.sceneDescription}
                    </p>
                  )}
                </div>
              )}

              {/* 调整模式 */}
              {step === 'adjusting' && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">位置调整</h4>
                  <p className="text-[10px] text-slate-500 mb-3">
                    拖拽四个角点可精确调整窗洞位置和透视角度
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleComposite}
                      disabled={isCompositing || !activeRegion}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-semibold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                    >
                      {isCompositing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {isCompositing ? '生成中...' : '生成效果图'}
                    </button>
                    <button
                      onClick={handleReselect}
                      className="flex items-center justify-center px-3 py-2 bg-slate-700 text-slate-300 rounded-xl text-xs hover:bg-slate-600 transition-colors"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* 结果模式 */}
              {step === 'result' && (
                <div className="space-y-4">
                  {/* 效果调节 */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">效果调节</h4>

                    {/* 透明度 */}
                    <ParamSlider
                      label="门窗透明度"
                      value={params.opacity}
                      min={0.3} max={1} step={0.01}
                      onChange={(v) => setParams(p => ({ ...p, opacity: v }))}
                      format={(v) => `${Math.round(v * 100)}%`}
                    />

                    {/* 亮度 */}
                    <ParamSlider
                      label="亮度匹配"
                      value={params.brightness}
                      min={0.5} max={1.5} step={0.01}
                      onChange={(v) => setParams(p => ({ ...p, brightness: v }))}
                      format={(v) => `${Math.round(v * 100)}%`}
                    />

                    {/* 阴影 */}
                    <ParamSlider
                      label="阴影融合"
                      value={params.shadowIntensity}
                      min={0} max={1} step={0.01}
                      onChange={(v) => setParams(p => ({ ...p, shadowIntensity: v }))}
                      format={(v) => `${Math.round(v * 100)}%`}
                    />

                    {/* 高级参数 */}
                    <button
                      onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                      className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 mt-2 transition-colors"
                    >
                      {showAdvancedParams ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      高级参数
                    </button>

                    {showAdvancedParams && (
                      <div className="mt-2 space-y-0">
                        <ParamSlider
                          label="边缘羽化"
                          value={params.edgeBlend}
                          min={0} max={1} step={0.01}
                          onChange={(v) => setParams(p => ({ ...p, edgeBlend: v }))}
                          format={(v) => `${Math.round(v * 100)}%`}
                        />
                        <ParamSlider
                          label="色温偏移"
                          value={params.colorTemperature}
                          min={-50} max={50} step={1}
                          onChange={(v) => setParams(p => ({ ...p, colorTemperature: v }))}
                          format={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}`}
                        />
                        <ParamSlider
                          label="玻璃反射"
                          value={params.reflectionIntensity}
                          min={0} max={1} step={0.01}
                          onChange={(v) => setParams(p => ({ ...p, reflectionIntensity: v }))}
                          format={(v) => `${Math.round(v * 100)}%`}
                        />
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-[10px] text-slate-500">透视校正</span>
                          <button
                            onClick={() => setParams(p => ({ ...p, perspectiveCorrection: !p.perspectiveCorrection }))}
                            className={`w-8 h-4 rounded-full transition-colors ${
                              params.perspectiveCorrection ? 'bg-amber-500' : 'bg-slate-600'
                            }`}
                          >
                            <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                              params.perspectiveCorrection ? 'translate-x-4.5 ml-[18px]' : 'ml-[2px]'
                            }`} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 重新生成 */}
                  <button
                    onClick={handleComposite}
                    disabled={isCompositing}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[oklch(0.17_0.028_260)] text-slate-300 rounded-lg text-xs hover:bg-[oklch(0.20_0.028_260)] transition-colors border border-[oklch(0.25_0.035_260)]"
                  >
                    {isCompositing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    {isCompositing ? '生成中...' : '重新生成'}
                  </button>

                  {/* 操作按钮 */}
                  <div className="space-y-2">
                    <button
                      onClick={handleDownload}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-semibold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
                    >
                      <Download size={14} />
                      下载效果图
                    </button>
                    <button
                      onClick={() => { setStep('adjusting'); setCompositeUrl(''); }}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-xs hover:bg-slate-600 transition-colors"
                    >
                      <Crosshair size={12} />
                      调整窗洞位置
                    </button>
                    <button
                      onClick={handleReselect}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <RotateCcw size={12} />
                      重新选择区域
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 辅助组件 =====

/** 参数滑块 */
function ParamSlider({
  label, value, min, max, step, onChange, format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-400 font-mono">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-slate-700 rounded-full appearance-none cursor-pointer accent-amber-500"
      />
    </div>
  );
}

// ===== Canvas 绘制辅助函数 =====

/** 绘制区域叠加层 */
function drawRegionOverlay(
  ctx: CanvasRenderingContext2D,
  region: WindowOpeningRegion,
  canvasW: number,
  canvasH: number,
  isSelected: boolean,
): void {
  const { topLeft, topRight, bottomLeft, bottomRight } = region.corners;
  const tl = { x: topLeft.x * canvasW, y: topLeft.y * canvasH };
  const tr = { x: topRight.x * canvasW, y: topRight.y * canvasH };
  const bl = { x: bottomLeft.x * canvasW, y: bottomLeft.y * canvasH };
  const br = { x: bottomRight.x * canvasW, y: bottomRight.y * canvasH };

  ctx.save();

  // 半透明遮罩（仅选中时）
  if (isSelected) {
    // 绘制全屏半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 清除窗洞区域的遮罩
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 边框
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();

  ctx.strokeStyle = isSelected ? '#f59e0b' : 'rgba(245, 158, 11, 0.5)';
  ctx.lineWidth = isSelected ? 2.5 : 1.5;
  ctx.setLineDash(isSelected ? [] : [6, 4]);
  ctx.stroke();

  // 标签
  ctx.fillStyle = isSelected ? '#f59e0b' : 'rgba(245, 158, 11, 0.7)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(region.label, tl.x + 4, tl.y - 6);

  // 置信度
  if (region.confidence < 1) {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.5)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(region.confidence * 100)}%`, tr.x - 4, tl.y - 6);
  }

  ctx.restore();
}

/** 绘制可拖拽的角点手柄 */
function drawCornerHandles(
  ctx: CanvasRenderingContext2D,
  corners: WindowOpeningRegion['corners'],
  canvasW: number,
  canvasH: number,
): void {
  const handleSize = 10;
  const cornerEntries = [
    { key: 'topLeft', point: corners.topLeft },
    { key: 'topRight', point: corners.topRight },
    { key: 'bottomLeft', point: corners.bottomLeft },
    { key: 'bottomRight', point: corners.bottomRight },
  ];

  ctx.save();
  for (const { point } of cornerEntries) {
    const px = point.x * canvasW;
    const py = point.y * canvasH;

    // 外圈
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(px, py, handleSize / 2 + 2, 0, Math.PI * 2);
    ctx.fill();

    // 内圈
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, handleSize / 2, 0, Math.PI * 2);
    ctx.fill();

    // 中心点
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 连接线
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(corners.topLeft.x * canvasW, corners.topLeft.y * canvasH);
  ctx.lineTo(corners.topRight.x * canvasW, corners.topRight.y * canvasH);
  ctx.lineTo(corners.bottomRight.x * canvasW, corners.bottomRight.y * canvasH);
  ctx.lineTo(corners.bottomLeft.x * canvasW, corners.bottomLeft.y * canvasH);
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}
