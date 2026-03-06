// WindoorDesigner - 拍照识别页面
// 用户上传实景照片 → AI识别窗型和尺寸 → 生成3D框架示意图
// 支持 L形窗/U形窗/凸窗/矩形窗 等多种窗型
// 可编辑尺寸 → 一键导入到主编辑器

import { useState, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { useDesignStore } from '@/stores/designStore';
import { useHistoryStore } from '@/stores/historyStore';
import { DEFAULT_PROFILE_SERIES } from '@/lib/types';
import PhotoFramePreview from '@/components/PhotoFramePreview';
import {
  fileToBase64,
  fileToDataURL,
  recognizeWindowFromPhoto,
  mockRecognizeWindow,
} from '@/lib/photoRecognition';
import type { PhotoRecognitionResult, RecognizedPanel } from '@/lib/photoRecognition';
import {
  createCompositeFromRecognition,
  createWindowFromRecognition,
  isCompositeWindow,
} from '@/lib/photoWindowFactory';
import { toast } from 'sonner';
import {
  Camera,
  Upload,
  ArrowLeft,
  Loader2,
  Sparkles,
  Edit3,
  Check,
  X,
  Download,
  RotateCcw,
  Ruler,
  Layers,
  AlertCircle,
  Image,
  Zap,
  ChevronRight,
  Settings,
  Eye,
} from 'lucide-react';

// ===== 步骤状态 =====
type Step = 'upload' | 'analyzing' | 'result' | 'editing';

// ===== API Key 管理 =====
const API_KEY_STORAGE_KEY = 'windoor_openai_api_key';

function getStoredApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function storeApiKey(key: string) {
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
  } catch { /* ignore */ }
}

export default function PhotoPage() {
  const [, navigate] = useLocation();
  const addWindowUnit = useDesignStore((s) => s.addWindowUnit);
  const addCompositeWindow = useDesignStore((s) => s.addCompositeWindow);
  const getSnapshot = useDesignStore((s) => s.getSnapshot);
  const pushHistory = useHistoryStore((s) => s.pushHistory);

  // ===== State =====
  const [step, setStep] = useState<Step>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [result, setResult] = useState<PhotoRecognitionResult | null>(null);
  const [editingResult, setEditingResult] = useState<PhotoRecognitionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string>('');
  const [apiKey, setApiKey] = useState(getStoredApiKey());
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ===== 文件选择处理 =====
  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('图片大小不能超过20MB');
      return;
    }

    setImageFile(file);
    setError('');
    setResult(null);

    try {
      const dataUrl = await fileToDataURL(file);
      setImagePreview(dataUrl);
    } catch {
      toast.error('图片读取失败');
    }
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  // ===== 拖拽上传 =====
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // ===== AI 识别 =====
  const handleAnalyze = useCallback(async () => {
    if (!imageFile) {
      toast.error('请先上传照片');
      return;
    }

    setIsAnalyzing(true);
    setStep('analyzing');
    setError('');

    try {
      const base64 = await fileToBase64(imageFile);

      let recognitionResult: PhotoRecognitionResult;

      if (apiKey) {
        storeApiKey(apiKey);
        recognitionResult = await recognizeWindowFromPhoto(base64, apiKey, imageFile.type);
      } else {
        // 无API Key时使用模拟数据演示
        await new Promise(resolve => setTimeout(resolve, 2000));
        recognitionResult = mockRecognizeWindow();
        toast.info('未配置API Key，使用演示数据');
      }

      setResult(recognitionResult);
      setEditingResult(JSON.parse(JSON.stringify(recognitionResult)));
      setStep('result');
      toast.success(`识别成功: ${recognitionResult.windowTypeName}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '识别失败';
      setError(msg);
      setStep('upload');
      toast.error(msg);
    } finally {
      setIsAnalyzing(false);
    }
  }, [imageFile, apiKey]);

  // ===== 编辑尺寸 =====
  const handleEditDimension = useCallback((panelIndex: number, field: 'width' | 'height', value: number) => {
    if (!editingResult) return;
    const newResult = { ...editingResult };
    newResult.panels = [...newResult.panels];
    newResult.panels[panelIndex] = { ...newResult.panels[panelIndex], [field]: value };

    // 更新总尺寸
    newResult.totalWidth = newResult.panels.reduce((sum, p) => sum + p.width, 0);
    newResult.totalHeight = Math.max(...newResult.panels.map(p => p.height));

    setEditingResult(newResult);
  }, [editingResult]);

  const handleApplyEdits = useCallback(() => {
    if (editingResult) {
      setResult(editingResult);
      setStep('result');
      toast.success('尺寸已更新');
    }
  }, [editingResult]);

  // ===== 导入到编辑器 =====
  const handleImportToEditor = useCallback(() => {
    if (!result) return;

    pushHistory(getSnapshot());

    if (isCompositeWindow(result)) {
      const composite = createCompositeFromRecognition(result);
      if (addCompositeWindow) {
        addCompositeWindow(composite);
      }
      toast.success(`已导入 ${result.windowTypeName} 到编辑器`);
    } else {
      const windowUnit = createWindowFromRecognition(result);
      addWindowUnit(windowUnit);
      toast.success(`已导入 ${result.windowTypeName} 到编辑器`);
    }

    navigate('/');
  }, [result, pushHistory, getSnapshot, addWindowUnit, addCompositeWindow, navigate]);

  // ===== 重新开始 =====
  const handleReset = useCallback(() => {
    setStep('upload');
    setImageFile(null);
    setImagePreview('');
    setResult(null);
    setEditingResult(null);
    setError('');
  }, []);

  // ===== 窗型图标 =====
  const getWindowTypeIcon = (type: string) => {
    switch (type) {
      case 'l-shape': return '⌐';
      case 'u-shape': return '⊔';
      case 'bay-window': return '⊓';
      default: return '□';
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-[oklch(0.13_0.022_260)] text-white overflow-hidden">
      {/* ===== Header ===== */}
      <header className="h-12 bg-[oklch(0.15_0.025_260)] border-b border-[oklch(0.25_0.035_260)] flex items-center px-4 gap-3 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm hidden sm:inline">返回编辑器</span>
        </button>

        <div className="h-5 w-px bg-slate-700" />

        <div className="flex items-center gap-2">
          <Camera size={18} className="text-amber-400" />
          <span className="text-sm font-semibold tracking-tight">拍照识别</span>
          <span className="text-[9px] text-amber-500/70 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded">AI</span>
        </div>

        <div className="flex-1" />

        {/* API Key 设置 */}
        <button
          onClick={() => setShowApiKeyInput(!showApiKeyInput)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <Settings size={14} />
          <span className="hidden sm:inline">API设置</span>
        </button>
      </header>

      {/* API Key 输入面板 */}
      {showApiKeyInput && (
        <div className="bg-[oklch(0.17_0.028_260)] border-b border-[oklch(0.25_0.035_260)] px-4 py-3">
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
              onClick={() => { storeApiKey(apiKey); setShowApiKeyInput(false); toast.success('API Key 已保存'); }}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs hover:bg-amber-500/30 transition-all"
            >
              保存
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5 max-w-xl mx-auto">
            需要支持 Vision 的模型（gpt-4.1-mini）。不配置则使用演示数据。
          </p>
        </div>
      )}

      {/* ===== Main Content ===== */}
      <div className="flex-1 overflow-hidden">
        {step === 'upload' && (
          <UploadStep
            imagePreview={imagePreview}
            error={error}
            onFileSelect={handleFileSelect}
            onFileInputChange={handleFileInputChange}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onAnalyze={handleAnalyze}
            fileInputRef={fileInputRef}
            cameraInputRef={cameraInputRef}
            hasImage={!!imageFile}
          />
        )}

        {step === 'analyzing' && (
          <AnalyzingStep imagePreview={imagePreview} />
        )}

        {(step === 'result' || step === 'editing') && result && (
          <ResultStep
            result={step === 'editing' ? (editingResult || result) : result}
            imagePreview={imagePreview}
            isEditing={step === 'editing'}
            onEdit={() => setStep('editing')}
            onApplyEdits={handleApplyEdits}
            onCancelEdit={() => setStep('result')}
            onEditDimension={handleEditDimension}
            onImport={handleImportToEditor}
            onReset={handleReset}
            getWindowTypeIcon={getWindowTypeIcon}
          />
        )}
      </div>
    </div>
  );
}

// ===== Upload Step Component =====
function UploadStep({
  imagePreview,
  error,
  onFileSelect,
  onFileInputChange,
  onDrop,
  onDragOver,
  onAnalyze,
  fileInputRef,
  cameraInputRef,
  hasImage,
}: {
  imagePreview: string;
  error: string;
  onFileSelect: (file: File) => void;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onAnalyze: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  hasImage: boolean;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl">
        {/* 标题 */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
            <Sparkles size={16} className="text-amber-400" />
            <span className="text-sm text-amber-400">AI 智能识别</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">拍照识别窗型</h1>
          <p className="text-sm text-slate-400">
            上传门窗实景照片，AI自动识别窗户类型和尺寸，生成3D框架示意图
          </p>
        </div>

        {/* 上传区域 */}
        {!imagePreview ? (
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="relative border-2 border-dashed border-slate-600 rounded-2xl p-8 sm:p-12 text-center hover:border-amber-500/50 transition-all cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-all">
                <Image size={36} className="text-amber-400" />
              </div>
              <div>
                <p className="text-base text-white font-medium mb-1">点击上传或拖拽图片到此处</p>
                <p className="text-xs text-slate-500">支持 JPG、PNG、WEBP，最大 20MB</p>
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 text-amber-400 text-sm hover:bg-amber-500/30 transition-all border border-amber-500/30"
                >
                  <Camera size={16} />
                  拍照
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 text-white text-sm hover:bg-white/15 transition-all border border-white/10"
                >
                  <Upload size={16} />
                  相册选择
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onFileInputChange}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileInputChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* 图片预览 */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-black/30">
              <img
                src={imagePreview}
                alt="实景照片"
                className="w-full max-h-[50vh] object-contain"
              />
              <button
                onClick={() => {
                  onFileSelect(new File([], ''));
                  // 重新选择
                  fileInputRef.current?.click();
                }}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg bg-black/60 text-white/70 hover:text-white transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* 开始识别按钮 */}
            <button
              onClick={onAnalyze}
              disabled={!hasImage}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium text-base hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
            >
              <Zap size={18} />
              开始AI识别
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onFileInputChange}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileInputChange}
              className="hidden"
            />
          </div>
        )}

        {/* 支持的窗型 */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: '□', name: '矩形窗', desc: '标准平面窗' },
            { icon: '⌐', name: 'L形窗', desc: '转角窗户' },
            { icon: '⊔', name: 'U形窗', desc: '三面围合' },
            { icon: '⊓', name: '凸窗/飘窗', desc: '向外凸出' },
          ].map((item) => (
            <div
              key={item.name}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 border border-white/5"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs text-white font-medium">{item.name}</span>
              <span className="text-[10px] text-slate-500">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== Analyzing Step Component =====
function AnalyzingStep({ imagePreview }: { imagePreview: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="relative w-64 h-64 mb-8">
        {/* 照片缩略图 */}
        <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-700 opacity-50">
          <img src={imagePreview} alt="" className="w-full h-full object-cover" />
        </div>

        {/* 扫描动画 */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-scan" />
        </div>

        {/* 中心加载 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-black/70 flex items-center justify-center backdrop-blur-sm">
            <Loader2 size={28} className="text-amber-400 animate-spin" />
          </div>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-white mb-2">AI 正在分析照片...</h2>
      <p className="text-sm text-slate-400 text-center max-w-sm">
        正在识别窗户类型、读取尺寸标注、分析面板结构
      </p>

      {/* 进度提示 */}
      <div className="mt-6 space-y-2">
        {['识别窗户轮廓', '读取尺寸标注', '分析窗型结构', '生成框架模型'].map((text, i) => (
          <div key={text} className="flex items-center gap-2 text-sm text-slate-500">
            <div className={`w-1.5 h-1.5 rounded-full ${i < 2 ? 'bg-amber-400' : 'bg-slate-600'} animate-pulse`} />
            {text}
          </div>
        ))}
      </div>

      {/* 扫描动画CSS */}
      <style>{`
        @keyframes scan {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// ===== Result Step Component =====
function ResultStep({
  result,
  imagePreview,
  isEditing,
  onEdit,
  onApplyEdits,
  onCancelEdit,
  onEditDimension,
  onImport,
  onReset,
  getWindowTypeIcon,
}: {
  result: PhotoRecognitionResult;
  imagePreview: string;
  isEditing: boolean;
  onEdit: () => void;
  onApplyEdits: () => void;
  onCancelEdit: () => void;
  onEditDimension: (panelIndex: number, field: 'width' | 'height', value: number) => void;
  onImport: () => void;
  onReset: () => void;
  getWindowTypeIcon: (type: string) => string;
}) {
  const [activeTab, setActiveTab] = useState<'3d' | 'photo' | 'info'>('3d');

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* ===== 左侧: 3D预览 / 照片 ===== */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Tab 切换 */}
        <div className="flex items-center gap-1 px-4 pt-3 pb-2">
          <button
            onClick={() => setActiveTab('3d')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
              activeTab === '3d'
                ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30 font-medium'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Layers size={13} />
            3D 框架
          </button>
          <button
            onClick={() => setActiveTab('photo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
              activeTab === 'photo'
                ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30 font-medium'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Image size={13} />
            原始照片
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
              activeTab === 'info'
                ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30 font-medium'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Eye size={13} />
            详情
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 min-h-0 px-4 pb-4">
          {activeTab === '3d' && (
            <div className="h-full rounded-xl overflow-hidden border border-slate-700 bg-[oklch(0.10_0.015_260)]">
              <PhotoFramePreview result={result} className="h-full" />
            </div>
          )}
          {activeTab === 'photo' && (
            <div className="h-full rounded-xl overflow-hidden border border-slate-700 bg-black/30 flex items-center justify-center">
              <img src={imagePreview} alt="原始照片" className="max-w-full max-h-full object-contain" />
            </div>
          )}
          {activeTab === 'info' && (
            <div className="h-full rounded-xl overflow-y-auto border border-slate-700 bg-[oklch(0.15_0.025_260)] p-4 space-y-4">
              {/* AI 描述 */}
              <div>
                <h3 className="text-sm font-medium text-white mb-2">AI 分析描述</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{result.description}</p>
              </div>

              {/* 识别到的尺寸 */}
              {result.dimensions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-white mb-2">识别到的尺寸</h3>
                  <div className="space-y-1.5">
                    {result.dimensions.map((dim, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/20">
                        <span className="text-xs text-slate-400">{dim.label}</span>
                        <span className="text-xs text-amber-400 font-mono">{dim.value} mm</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 建议 */}
              {result.suggestions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-white mb-2">测量建议</h3>
                  <div className="space-y-1.5">
                    {result.suggestions.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                        <span className="text-amber-400 mt-0.5">*</span>
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== 右侧: 识别结果面板 ===== */}
      <div className="w-full lg:w-80 xl:w-96 bg-[oklch(0.15_0.025_260)] border-t lg:border-t-0 lg:border-l border-[oklch(0.25_0.035_260)] flex flex-col shrink-0 max-h-[40vh] lg:max-h-none overflow-y-auto">
        {/* 窗型信息 */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-2xl border border-amber-500/20">
              {getWindowTypeIcon(result.windowType)}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">{result.windowTypeName}</h2>
              <p className="text-xs text-slate-400">
                {result.panels.length} 个面板 | 置信度 {Math.round(result.confidence * 100)}%
              </p>
            </div>
          </div>

          {/* 总尺寸 */}
          <div className="flex gap-3">
            <div className="flex-1 px-3 py-2 rounded-lg bg-black/20 border border-slate-700/50">
              <div className="text-[10px] text-slate-500 mb-0.5">总宽</div>
              <div className="text-sm text-white font-mono">{result.totalWidth} mm</div>
            </div>
            <div className="flex-1 px-3 py-2 rounded-lg bg-black/20 border border-slate-700/50">
              <div className="text-[10px] text-slate-500 mb-0.5">总高</div>
              <div className="text-sm text-white font-mono">{result.totalHeight} mm</div>
            </div>
          </div>
        </div>

        {/* 面板详情 */}
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white flex items-center gap-1.5">
              <Ruler size={14} className="text-amber-400" />
              面板尺寸
            </h3>
            {!isEditing ? (
              <button
                onClick={onEdit}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-amber-400 hover:bg-amber-500/10 transition-all"
              >
                <Edit3 size={12} />
                编辑
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={onApplyEdits}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-green-400 hover:bg-green-500/10 transition-all"
                >
                  <Check size={12} />
                  确认
                </button>
                <button
                  onClick={onCancelEdit}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-400 hover:bg-white/10 transition-all"
                >
                  <X size={12} />
                  取消
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {result.panels.map((panel, index) => (
              <div key={index} className="rounded-xl bg-black/20 border border-slate-700/50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-amber-500/20 flex items-center justify-center text-[10px] text-amber-400 font-bold">
                    {index + 1}
                  </div>
                  <span className="text-xs text-white font-medium">{panel.label}</span>
                  {panel.angle !== 0 && (
                    <span className="text-[10px] text-slate-500 ml-auto">
                      {panel.angle > 0 ? '+' : ''}{panel.angle}°
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">宽度 (mm)</label>
                    {isEditing ? (
                      <input
                        type="number"
                        value={panel.width}
                        onChange={(e) => onEditDimension(index, 'width', Number(e.target.value))}
                        className="w-full px-2 py-1.5 rounded-lg bg-black/30 border border-amber-500/30 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      />
                    ) : (
                      <div className="px-2 py-1.5 rounded-lg bg-black/10 text-sm text-amber-400 font-mono">
                        {panel.width}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">高度 (mm)</label>
                    {isEditing ? (
                      <input
                        type="number"
                        value={panel.height}
                        onChange={(e) => onEditDimension(index, 'height', Number(e.target.value))}
                        className="w-full px-2 py-1.5 rounded-lg bg-black/30 border border-amber-500/30 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      />
                    ) : (
                      <div className="px-2 py-1.5 rounded-lg bg-black/10 text-sm text-amber-400 font-mono">
                        {panel.height}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="p-4 border-t border-slate-700/50 space-y-2">
          <button
            onClick={onImport}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium text-sm hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
          >
            <Download size={16} />
            导入到编辑器
          </button>
          <button
            onClick={onReset}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-slate-400 text-sm hover:bg-white/10 hover:text-white transition-all border border-white/10"
          >
            <RotateCcw size={14} />
            重新拍照
          </button>
        </div>
      </div>
    </div>
  );
}
