// WindoorDesigner - 实景照片融合预览
// 功能: 用户上传现场照片 → 框选窗洞区域 → 3D门窗截图叠加 → 输出效果图
// Phase 1: 纯前端Canvas合成，零API依赖

import { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import type { WindowUnit } from '@/lib/types';
import { DEFAULT_PROFILE_SERIES } from '@/lib/types';
import { createWindow3D, createSceneEnvironment } from '@/lib/window3d';
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
} from 'lucide-react';

interface ScenePreviewProps {
  windows: WindowUnit[];
  selectedWindowId: string | null;
}

type Step = 'upload' | 'select-region' | 'preview' | 'result';

interface WindowRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function ScenePreview({ windows, selectedWindowId }: ScenePreviewProps) {
  // 步骤状态
  const [step, setStep] = useState<Step>('upload');
  
  // 照片相关
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>('');
  
  // 窗洞框选
  const [region, setRegion] = useState<WindowRegion | null>(null);
  const [isDrawingRegion, setIsDrawingRegion] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [drawCurrent, setDrawCurrent] = useState({ x: 0, y: 0 });
  
  // 门窗截图
  const [windowSnapshot, setWindowSnapshot] = useState<string>('');
  
  // 合成结果
  const [compositeUrl, setCompositeUrl] = useState<string>('');
  
  // 调节参数
  const [opacity, setOpacity] = useState(0.92);
  const [brightness, setBrightness] = useState(1.0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [shadowIntensity, setShadowIntensity] = useState(0.3);
  
  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 缩放和平移
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // 选择要融合的窗口
  const targetWindow = selectedWindowId
    ? windows.find(w => w.id === selectedWindowId)
    : windows[0];

  // ========== 第1步: 上传照片 ==========
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }
    
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setPhoto(img);
      setPhotoUrl(url);
      setStep('select-region');
      setRegion(null);
      setCompositeUrl('');
    };
    img.src = url;
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setPhoto(img);
      setPhotoUrl(url);
      setStep('select-region');
      setRegion(null);
      setCompositeUrl('');
    };
    img.src = url;
  }, []);

  // ========== 第2步: 框选窗洞 ==========
  const getCanvasCoords = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom - pan.x / zoom,
      y: (e.clientY - rect.top) / zoom - pan.y / zoom,
    };
  }, [zoom, pan]);

  const handleRegionMouseDown = useCallback((e: React.MouseEvent) => {
    if (step !== 'select-region') return;
    e.preventDefault();
    const coords = getCanvasCoords(e);
    setIsDrawingRegion(true);
    setDrawStart(coords);
    setDrawCurrent(coords);
  }, [step, getCanvasCoords]);

  const handleRegionMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawingRegion) return;
    const coords = getCanvasCoords(e);
    setDrawCurrent(coords);
  }, [isDrawingRegion, getCanvasCoords]);

  const handleRegionMouseUp = useCallback(() => {
    if (!isDrawingRegion) return;
    setIsDrawingRegion(false);
    
    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const width = Math.abs(drawCurrent.x - drawStart.x);
    const height = Math.abs(drawCurrent.y - drawStart.y);
    
    if (width < 20 || height < 20) return; // 太小忽略
    
    setRegion({ x, y, width, height });
  }, [isDrawingRegion, drawStart, drawCurrent]);

  // ========== 第3步: 生成门窗3D截图 ==========
  const captureWindow3D = useCallback((): string | null => {
    if (!targetWindow) return null;
    
    const w = 800;
    const h = 800;
    
    // 创建离屏渲染器
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true, // 透明背景
      preserveDrawingBuffer: true,
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0); // 完全透明
    
    // 创建场景
    const scene = new THREE.Scene();
    
    // 创建相机 - 正面视图
    const windowW = targetWindow.width;
    const windowH = targetWindow.height;
    const aspect = w / h;
    const maxDim = Math.max(windowW, windowH) / 1000;
    const camera = new THREE.OrthographicCamera(
      -maxDim * aspect * 0.6,
      maxDim * aspect * 0.6,
      maxDim * 0.6,
      -maxDim * 0.6,
      0.01,
      100
    );
    camera.position.set(0, 0, 2);
    camera.lookAt(0, 0, 0);
    
    // 添加光照
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(2, 3, 4);
    scene.add(dirLight);
    
    // 创建3D门窗模型
    const profileSeries = targetWindow.profileSeries || DEFAULT_PROFILE_SERIES[2];
    const windowGroup = createWindow3D(targetWindow, profileSeries);
    scene.add(windowGroup);
    
    // 渲染
    renderer.render(scene, camera);
    
    // 截图
    const dataUrl = renderer.domElement.toDataURL('image/png');
    
    // 清理
    renderer.dispose();
    scene.clear();
    
    return dataUrl;
  }, [targetWindow]);

  // ========== 第4步: Canvas合成 ==========
  const compositeImage = useCallback(() => {
    if (!photo || !region || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Canvas尺寸设为照片原始尺寸
    canvas.width = photo.naturalWidth;
    canvas.height = photo.naturalHeight;
    
    // 绘制原始照片
    ctx.drawImage(photo, 0, 0);
    
    // 获取门窗截图
    const snapshot = captureWindow3D();
    if (!snapshot) return;
    
    // 加载门窗截图并叠加
    const windowImg = new Image();
    windowImg.onload = () => {
      // 计算缩放比例（照片显示尺寸 vs 原始尺寸）
      const container = containerRef.current;
      if (!container) return;
      const displayW = container.clientWidth;
      const scaleX = photo.naturalWidth / (displayW * zoom);
      const scaleY = photo.naturalHeight / ((displayW * photo.naturalHeight / photo.naturalWidth) * zoom);
      
      // 窗洞区域在原始照片上的位置
      const rx = region.x * scaleX;
      const ry = region.y * scaleY;
      const rw = region.width * scaleX;
      const rh = region.height * scaleY;
      
      // 在窗洞区域绘制半透明阴影（模拟窗洞深度）
      if (shadowIntensity > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${shadowIntensity * 0.5})`;
        // 内阴影效果
        const shadowSize = Math.min(rw, rh) * 0.03;
        ctx.fillRect(rx, ry, rw, shadowSize); // 上
        ctx.fillRect(rx, ry + rh - shadowSize, rw, shadowSize); // 下
        ctx.fillRect(rx, ry, shadowSize, rh); // 左
        ctx.fillRect(rx + rw - shadowSize, ry, shadowSize, rh); // 右
        ctx.restore();
      }
      
      // 绘制门窗截图到窗洞区域
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.drawImage(windowImg, rx, ry, rw, rh);
      ctx.restore();
      
      // 添加边框阴影效果（让门窗与墙面更融合）
      ctx.save();
      const gradient = ctx.createLinearGradient(rx, ry, rx, ry + rh);
      gradient.addColorStop(0, `rgba(0,0,0,${shadowIntensity * 0.2})`);
      gradient.addColorStop(0.1, 'rgba(0,0,0,0)');
      gradient.addColorStop(0.9, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, `rgba(0,0,0,${shadowIntensity * 0.3})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.restore();
      
      // 亮度调节
      if (brightness !== 1.0) {
        ctx.save();
        ctx.globalCompositeOperation = brightness > 1 ? 'lighter' : 'multiply';
        const alpha = brightness > 1 ? (brightness - 1) * 0.3 : 1;
        ctx.fillStyle = brightness > 1 
          ? `rgba(255,255,255,${alpha})`
          : `rgba(${Math.round(brightness * 255)},${Math.round(brightness * 255)},${Math.round(brightness * 255)},0.3)`;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.restore();
      }
      
      // 生成结果
      const resultUrl = canvas.toDataURL('image/jpeg', 0.95);
      setCompositeUrl(resultUrl);
      setWindowSnapshot(snapshot);
      setStep('result');
    };
    windowImg.src = snapshot;
  }, [photo, region, captureWindow3D, opacity, brightness, shadowIntensity, zoom]);

  // ========== 渲染照片和框选区域 ==========
  useEffect(() => {
    if (!photo || !canvasRef.current || step === 'upload') return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const displayW = container.clientWidth;
    const displayH = displayW * photo.naturalHeight / photo.naturalWidth;
    
    canvas.width = displayW;
    canvas.height = displayH;
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;
    
    // 清空
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制照片
    ctx.drawImage(photo, 0, 0, displayW, displayH);
    
    // 绘制已确认的窗洞区域
    if (region && step === 'select-region') {
      ctx.save();
      // 半透明遮罩
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // 清除窗洞区域的遮罩
      ctx.clearRect(region.x, region.y, region.width, region.height);
      // 重新绘制窗洞区域的照片
      const scaleX = photo.naturalWidth / displayW;
      const scaleY = photo.naturalHeight / displayH;
      ctx.drawImage(
        photo,
        region.x * scaleX, region.y * scaleY,
        region.width * scaleX, region.height * scaleY,
        region.x, region.y,
        region.width, region.height
      );
      // 窗洞边框
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(region.x, region.y, region.width, region.height);
      // 尺寸标注
      ctx.fillStyle = '#f59e0b';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${Math.round(region.width)} × ${Math.round(region.height)} px`,
        region.x + region.width / 2,
        region.y - 8
      );
      // 四角拖拽手柄
      const handleSize = 8;
      ctx.fillStyle = '#f59e0b';
      [
        [region.x, region.y],
        [region.x + region.width, region.y],
        [region.x, region.y + region.height],
        [region.x + region.width, region.y + region.height],
      ].forEach(([hx, hy]) => {
        ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
      });
      ctx.restore();
    }
    
    // 绘制正在框选的区域
    if (isDrawingRegion) {
      ctx.save();
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const w = Math.abs(drawCurrent.x - drawStart.x);
      const h = Math.abs(drawCurrent.y - drawStart.y);
      
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);
      
      // 半透明填充
      ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
      ctx.fillRect(x, y, w, h);
      
      // 十字准星
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y + h);
      ctx.moveTo(x, cy);
      ctx.lineTo(x + w, cy);
      ctx.stroke();
      
      ctx.restore();
    }
    
    // 结果模式：绘制合成后的图片
    if (step === 'result' && compositeUrl) {
      const resultImg = new Image();
      resultImg.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(resultImg, 0, 0, displayW, displayH);
        
        // 如果显示叠加层，绘制窗洞区域指示
        if (showOverlay && region) {
          ctx.save();
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(region.x, region.y, region.width, region.height);
          ctx.restore();
        }
      };
      resultImg.src = compositeUrl;
    }
  }, [photo, region, step, isDrawingRegion, drawStart, drawCurrent, compositeUrl, showOverlay, zoom, pan]);

  // ========== 下载结果 ==========
  const handleDownload = useCallback(() => {
    if (!compositeUrl) return;
    const a = document.createElement('a');
    a.href = compositeUrl;
    a.download = `windoor-scene-${Date.now()}.jpg`;
    a.click();
  }, [compositeUrl]);

  // ========== 重新开始 ==========
  const handleReset = useCallback(() => {
    setStep('upload');
    setPhoto(null);
    setPhotoUrl('');
    setRegion(null);
    setCompositeUrl('');
    setWindowSnapshot('');
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // ========== 重新框选 ==========
  const handleReselect = useCallback(() => {
    setStep('select-region');
    setRegion(null);
    setCompositeUrl('');
  }, []);

  // ========== 渲染 ==========
  
  // 无窗口时的提示
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

  return (
    <div className="flex-1 flex flex-col bg-[oklch(0.10_0.02_260)] overflow-hidden">
      {/* 顶部步骤指示器 */}
      <div className="h-12 bg-[oklch(0.13_0.022_260)] border-b border-[oklch(0.25_0.035_260)] flex items-center px-4 gap-4 shrink-0">
        {[
          { key: 'upload', label: '上传照片', icon: Upload },
          { key: 'select-region', label: '框选窗洞', icon: Crosshair },
          { key: 'result', label: '生成效果图', icon: ImageIcon },
        ].map((s, i) => {
          const isActive = step === s.key || (step === 'preview' && s.key === 'result');
          const isPast = ['upload', 'select-region', 'preview', 'result'].indexOf(step) > 
                         ['upload', 'select-region', 'preview', 'result'].indexOf(s.key as Step);
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <div className={`w-8 h-px ${isPast ? 'bg-amber-500' : 'bg-slate-700'}`} />}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all ${
                isActive
                  ? 'bg-amber-500/20 text-amber-400 font-medium'
                  : isPast
                    ? 'text-amber-500/60'
                    : 'text-slate-600'
              }`}>
                {isPast ? <Check size={12} /> : <Icon size={12} />}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            </div>
          );
        })}
        
        <div className="flex-1" />
        
        {/* 操作按钮 */}
        {step !== 'upload' && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 rounded-md hover:bg-white/5 transition-colors"
          >
            <RotateCcw size={12} />
            重新开始
          </button>
        )}
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧: 画布区域 */}
        <div ref={containerRef} className="flex-1 overflow-hidden relative">
          {step === 'upload' ? (
            /* 上传区域 */
            <div
              className="absolute inset-0 flex items-center justify-center p-8"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={handleDrop}
            >
              <label
                htmlFor="scene-photo-upload"
                className="w-full max-w-lg border-2 border-dashed border-slate-600 rounded-2xl p-12 text-center cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/5 transition-all block"
              >
                <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-300 mb-2">上传现场照片</h3>
                <p className="text-sm text-slate-500 mb-4">
                  拍摄窗洞位置的照片，系统将把您设计的门窗融合到照片中
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm font-medium">
                  <ImageIcon size={16} />
                  选择图片
                </div>
                <p className="text-xs text-slate-600 mt-3">支持 JPG、PNG 格式，建议拍摄清晰的正面照片</p>
                <input
                  id="scene-photo-upload"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFileSelect}
                />
              </label>
            </div>
          ) : (
            /* 照片画布 */
            <div className="absolute inset-0 overflow-auto flex items-center justify-center bg-[oklch(0.08_0.01_260)]">
              <canvas
                ref={canvasRef}
                className={`max-w-full ${step === 'select-region' ? 'cursor-crosshair' : 'cursor-default'}`}
                onMouseDown={handleRegionMouseDown}
                onMouseMove={handleRegionMouseMove}
                onMouseUp={handleRegionMouseUp}
                onMouseLeave={() => isDrawingRegion && setIsDrawingRegion(false)}
              />
            </div>
          )}
        </div>

        {/* 右侧: 控制面板 */}
        {step !== 'upload' && (
          <div className="w-64 bg-[oklch(0.13_0.022_260)] border-l border-[oklch(0.25_0.035_260)] overflow-y-auto shrink-0">
            <div className="p-4 space-y-4">
              {/* 当前窗口信息 */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">门窗信息</h4>
                <div className="bg-[oklch(0.17_0.028_260)] rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">名称</span>
                    <span className="text-slate-300">{targetWindow.name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">尺寸</span>
                    <span className="text-slate-300">{targetWindow.width} × {targetWindow.height} mm</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">型材</span>
                    <span className="text-slate-300">{targetWindow.profileSeries?.name || '70系列'}</span>
                  </div>
                </div>
              </div>

              {/* 步骤2: 框选操作 */}
              {step === 'select-region' && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">框选窗洞</h4>
                  <p className="text-xs text-slate-500 mb-3">
                    在照片上拖拽框选窗洞区域，门窗将被放置到该位置。
                  </p>
                  {region && (
                    <>
                      <div className="bg-[oklch(0.17_0.028_260)] rounded-lg p-3 space-y-1 mb-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">位置</span>
                          <span className="text-slate-300">({Math.round(region.x)}, {Math.round(region.y)})</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">大小</span>
                          <span className="text-slate-300">{Math.round(region.width)} × {Math.round(region.height)} px</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={compositeImage}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 text-black rounded-lg text-xs font-semibold hover:bg-amber-400 transition-colors"
                        >
                          <Check size={14} />
                          生成效果图
                        </button>
                        <button
                          onClick={handleReselect}
                          className="flex items-center justify-center gap-1 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-xs hover:bg-slate-600 transition-colors"
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    </>
                  )}
                  {!region && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                      <p className="text-xs text-amber-400/80">
                        在照片上拖拽鼠标，框选出窗洞的位置和大小
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 步骤3: 结果调节 */}
              {step === 'result' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">效果调节</h4>
                    
                    {/* 透明度 */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">门窗透明度</span>
                        <span className="text-slate-400 font-mono">{Math.round(opacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.3"
                        max="1"
                        step="0.01"
                        value={opacity}
                        onChange={(e) => setOpacity(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-700 rounded-full appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                    
                    {/* 亮度 */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">亮度匹配</span>
                        <span className="text-slate-400 font-mono">{Math.round(brightness * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.01"
                        value={brightness}
                        onChange={(e) => setBrightness(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-700 rounded-full appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                    
                    {/* 阴影强度 */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">阴影融合</span>
                        <span className="text-slate-400 font-mono">{Math.round(shadowIntensity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={shadowIntensity}
                        onChange={(e) => setShadowIntensity(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-700 rounded-full appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                  </div>

                  {/* 重新生成 */}
                  <button
                    onClick={compositeImage}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[oklch(0.17_0.028_260)] text-slate-300 rounded-lg text-xs hover:bg-[oklch(0.20_0.028_260)] transition-colors border border-[oklch(0.25_0.035_260)]"
                  >
                    <RotateCcw size={12} />
                    重新生成
                  </button>

                  {/* 操作按钮 */}
                  <div className="space-y-2">
                    <button
                      onClick={handleDownload}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-amber-500 text-black rounded-lg text-xs font-semibold hover:bg-amber-400 transition-colors"
                    >
                      <Download size={14} />
                      下载效果图
                    </button>
                    <button
                      onClick={handleReselect}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-xs hover:bg-slate-600 transition-colors"
                    >
                      <Crosshair size={12} />
                      重新框选窗洞
                    </button>
                  </div>

                  {/* 显示/隐藏叠加层 */}
                  <button
                    onClick={() => setShowOverlay(!showOverlay)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showOverlay ? <EyeOff size={12} /> : <Eye size={12} />}
                    {showOverlay ? '隐藏窗洞标记' : '显示窗洞标记'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
