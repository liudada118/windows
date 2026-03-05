// ShowcasePage.tsx - 完整展示界面
// 提供专业的窗户效果图展示，包括 2D 工程图、材料信息、尺寸标注
// 支持打印和导出 PDF

import { useState, useRef, useCallback, useMemo } from 'react';
import { useDesignStore } from '@/stores/designStore';
import { Stage, Layer, Rect, Line, Text, Group } from 'react-konva';
import { ArrowLeft, Printer, Download, ChevronLeft, ChevronRight, Maximize2, Grid3X3, FileText } from 'lucide-react';
import { useLocation } from 'wouter';
import type { WindowUnit, Opening, Mullion } from '@/lib/types';
import { DEFAULT_PROFILE_SERIES } from '@windoor/shared';
import { MATERIAL_PRESETS, COLOR_PRESETS } from '@/lib/constants';

// ===== Constants =====
const SHOWCASE_SCALE = 0.4; // mm to px for showcase
const PADDING = 60;
const LABEL_FONT_SIZE = 12;
const TITLE_FONT_SIZE = 16;

// ===== Helper: collect openings recursively =====
function collectOpenings(opening: Opening, results: { rect: { x: number; y: number; width: number; height: number }; hasSash: boolean; sashType?: string }[] = []) {
  if (!opening.childOpenings || opening.childOpenings.length === 0) {
    results.push({
      rect: { ...opening.rect },
      hasSash: !!opening.sash,
      sashType: opening.sash?.type,
    });
  } else {
    for (const child of opening.childOpenings) {
      collectOpenings(child, results);
    }
  }
  return results;
}

// ===== Helper: collect mullions recursively =====
function collectMullions(opening: Opening, results: Mullion[] = []) {
  if (opening.mullion) {
    results.push(opening.mullion);
  }
  if (opening.childOpenings) {
    for (const child of opening.childOpenings) {
      collectMullions(child, results);
    }
  }
  return results;
}

// ===== Window Showcase Card =====
function WindowShowcaseCard({ win, index }: { win: WindowUnit; index: number }) {
  const scale = SHOWCASE_SCALE;
  const frameWidth = win.profileSeries?.frameWidth || 60;
  const mullionWidth = win.profileSeries?.mullionWidth || 70;

  const canvasWidth = win.width * scale + PADDING * 2;
  const canvasHeight = win.height * scale + PADDING * 2 + 80; // extra space for labels

  const openings = collectOpenings(win.rootOpening);
  const mullions = collectMullions(win.rootOpening);

  // Get color config
  const materialConfig = useDesignStore(s => s.materialConfig);
  const frameColor = materialConfig.frameColor || '#8B8B8B';
  const glassColor = materialConfig.glassColor || '#B8D4E8';
  const mullionColor = materialConfig.mullionColor || '#8B8B8B';

  const ox = PADDING;
  const oy = PADDING;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Card Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-sm">{win.name || `窗户 ${index + 1}`}</h3>
            <p className="text-slate-300 text-xs mt-0.5">
              {win.width} x {win.height} mm | {win.profileSeries?.name || '默认型材'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-amber-400 text-xs font-mono">#{String(index + 1).padStart(2, '0')}</span>
          </div>
        </div>
      </div>

      {/* 2D Engineering Drawing */}
      <div className="flex justify-center p-4 bg-gray-50">
        <Stage width={canvasWidth} height={canvasHeight}>
          <Layer>
            {/* Title */}
            <Text
              x={0}
              y={8}
              width={canvasWidth}
              text={`${win.name || '窗户'} - 工程图`}
              fontSize={TITLE_FONT_SIZE}
              fontFamily="system-ui, sans-serif"
              fill="#334155"
              align="center"
              fontStyle="bold"
            />

            {/* Outer frame */}
            <Rect
              x={ox}
              y={oy}
              width={win.width * scale}
              height={win.height * scale}
              stroke="#475569"
              strokeWidth={2}
              fill={frameColor}
              opacity={0.3}
              cornerRadius={2}
            />

            {/* Inner frame border */}
            <Rect
              x={ox + frameWidth * scale}
              y={oy + frameWidth * scale}
              width={(win.width - frameWidth * 2) * scale}
              height={(win.height - frameWidth * 2) * scale}
              stroke="#64748b"
              strokeWidth={1}
            />

            {/* Glass panels */}
            {openings.map((op, i) => (
              <Group key={`glass-${i}`}>
                <Rect
                  x={ox + op.rect.x * scale}
                  y={oy + op.rect.y * scale}
                  width={op.rect.width * scale}
                  height={op.rect.height * scale}
                  fill={glassColor}
                  opacity={0.4}
                  stroke="#94a3b8"
                  strokeWidth={0.5}
                />
                {/* Sash indicator */}
                {op.hasSash && op.sashType && op.sashType !== 'fixed' && (
                  <>
                    {/* Diagonal line for casement */}
                    <Line
                      points={
                        op.sashType === 'casement-left'
                          ? [
                              ox + op.rect.x * scale, oy + (op.rect.y + op.rect.height) * scale,
                              ox + (op.rect.x + op.rect.width / 2) * scale, oy + op.rect.y * scale,
                            ]
                          : op.sashType === 'casement-right'
                          ? [
                              ox + (op.rect.x + op.rect.width) * scale, oy + (op.rect.y + op.rect.height) * scale,
                              ox + (op.rect.x + op.rect.width / 2) * scale, oy + op.rect.y * scale,
                            ]
                          : [
                              ox + op.rect.x * scale, oy + (op.rect.y + op.rect.height) * scale,
                              ox + (op.rect.x + op.rect.width / 2) * scale, oy + op.rect.y * scale,
                              ox + (op.rect.x + op.rect.width) * scale, oy + (op.rect.y + op.rect.height) * scale,
                            ]
                      }
                      stroke="#f59e0b"
                      strokeWidth={1}
                      dash={[4, 2]}
                    />
                    {/* Sash type label */}
                    <Text
                      x={ox + op.rect.x * scale}
                      y={oy + (op.rect.y + op.rect.height / 2) * scale - 6}
                      width={op.rect.width * scale}
                      text={
                        op.sashType === 'casement-left' ? '内开左' :
                        op.sashType === 'casement-right' ? '内开右' :
                        op.sashType === 'sliding' ? '推拉' :
                        op.sashType === 'top-hung' ? '上悬' : '开启'
                      }
                      fontSize={10}
                      fill="#b45309"
                      align="center"
                    />
                  </>
                )}
                {/* Panel size label */}
                <Text
                  x={ox + op.rect.x * scale}
                  y={oy + (op.rect.y + op.rect.height / 2) * scale + (op.hasSash ? 8 : -6)}
                  width={op.rect.width * scale}
                  text={`${Math.round(op.rect.width)}x${Math.round(op.rect.height)}`}
                  fontSize={9}
                  fill="#64748b"
                  align="center"
                />
              </Group>
            ))}

            {/* Mullions */}
            {mullions.map((m, i) => {
              const isVertical = m.direction === 'vertical';
              const parent = findMullionParent(win.rootOpening, m.id);
              if (!parent) return null;
              return (
                <Rect
                  key={`mullion-${i}`}
                  x={ox + (isVertical ? (m.position - mullionWidth / 2) : parent.rect.x) * scale}
                  y={oy + (isVertical ? parent.rect.y : (m.position - mullionWidth / 2)) * scale}
                  width={(isVertical ? mullionWidth : parent.rect.width) * scale}
                  height={(isVertical ? parent.rect.height : mullionWidth) * scale}
                  fill={mullionColor}
                  opacity={0.5}
                  stroke="#64748b"
                  strokeWidth={0.5}
                />
              );
            })}

            {/* Dimension lines - Width */}
            <Group>
              {/* Top dimension line */}
              <Line
                points={[
                  ox, oy + win.height * scale + 20,
                  ox + win.width * scale, oy + win.height * scale + 20,
                ]}
                stroke="#334155"
                strokeWidth={1}
              />
              {/* Left tick */}
              <Line
                points={[ox, oy + win.height * scale + 15, ox, oy + win.height * scale + 25]}
                stroke="#334155"
                strokeWidth={1}
              />
              {/* Right tick */}
              <Line
                points={[
                  ox + win.width * scale, oy + win.height * scale + 15,
                  ox + win.width * scale, oy + win.height * scale + 25,
                ]}
                stroke="#334155"
                strokeWidth={1}
              />
              {/* Width label */}
              <Text
                x={ox}
                y={oy + win.height * scale + 28}
                width={win.width * scale}
                text={`${win.width}`}
                fontSize={LABEL_FONT_SIZE}
                fontFamily="monospace"
                fill="#334155"
                align="center"
                fontStyle="bold"
              />
            </Group>

            {/* Dimension lines - Height */}
            <Group>
              <Line
                points={[
                  ox + win.width * scale + 20, oy,
                  ox + win.width * scale + 20, oy + win.height * scale,
                ]}
                stroke="#334155"
                strokeWidth={1}
              />
              <Line
                points={[
                  ox + win.width * scale + 15, oy,
                  ox + win.width * scale + 25, oy,
                ]}
                stroke="#334155"
                strokeWidth={1}
              />
              <Line
                points={[
                  ox + win.width * scale + 15, oy + win.height * scale,
                  ox + win.width * scale + 25, oy + win.height * scale,
                ]}
                stroke="#334155"
                strokeWidth={1}
              />
              <Text
                x={ox + win.width * scale + 30}
                y={oy + win.height * scale / 2 - 6}
                text={`${win.height}`}
                fontSize={LABEL_FONT_SIZE}
                fontFamily="monospace"
                fill="#334155"
                fontStyle="bold"
              />
            </Group>

            {/* Panel dimension lines (bottom) */}
            {openings.length > 1 && openings.map((op, i) => (
              <Group key={`dim-${i}`}>
                <Line
                  points={[
                    ox + op.rect.x * scale, oy + win.height * scale + 45,
                    ox + (op.rect.x + op.rect.width) * scale, oy + win.height * scale + 45,
                  ]}
                  stroke="#94a3b8"
                  strokeWidth={0.5}
                />
                <Text
                  x={ox + op.rect.x * scale}
                  y={oy + win.height * scale + 50}
                  width={op.rect.width * scale}
                  text={`${Math.round(op.rect.width)}`}
                  fontSize={10}
                  fontFamily="monospace"
                  fill="#64748b"
                  align="center"
                />
              </Group>
            ))}
          </Layer>
        </Stage>
      </div>

      {/* Material Info */}
      <div className="px-5 py-3 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-gray-400">型材系列</span>
            <p className="text-gray-700 font-medium">{win.profileSeries?.name || '默认'}</p>
          </div>
          <div>
            <span className="text-gray-400">框宽/中梃宽</span>
            <p className="text-gray-700 font-medium">{frameWidth}mm / {mullionWidth}mm</p>
          </div>
          <div>
            <span className="text-gray-400">分格数量</span>
            <p className="text-gray-700 font-medium">{openings.length} 格</p>
          </div>
          <div>
            <span className="text-gray-400">开启方式</span>
            <p className="text-gray-700 font-medium">
              {openings.some(o => o.hasSash) ? openings.filter(o => o.hasSash).map(o => {
                switch (o.sashType) {
                  case 'casement-left': return '内开左';
                  case 'casement-right': return '内开右';
                  case 'sliding': return '推拉';
                  case 'top-hung': return '上悬';
                  default: return '固定';
                }
              }).join(' + ') : '全固定'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper: find parent opening of a mullion
function findMullionParent(opening: Opening, mullionId: string): Opening | null {
  if (opening.mullion?.id === mullionId) return opening;
  if (opening.childOpenings) {
    for (const child of opening.childOpenings) {
      const found = findMullionParent(child, mullionId);
      if (found) return found;
    }
  }
  return null;
}

// ===== Main ShowcasePage =====
export default function ShowcasePage() {
  const [, navigate] = useLocation();
  const windows = useDesignStore(s => s.windows);
  const materialConfig = useDesignStore(s => s.materialConfig);
  const activeProfileSeries = useDesignStore(s => s.activeProfileSeries);
  const showcaseRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');

  const profileInfo = useMemo(() => {
    return DEFAULT_PROFILE_SERIES.find(p => p.id === activeProfileSeries.id) || activeProfileSeries;
  }, [activeProfileSeries]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExportImage = useCallback(async () => {
    // 使用 Konva Stage 的 toDataURL 导出
    const stageEl = showcaseRef.current?.querySelector('canvas');
    if (!stageEl) return;
    try {
      const link = document.createElement('a');
      link.download = `窗户效果图_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = (stageEl as HTMLCanvasElement).toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, []);

  if (windows.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold text-gray-600">暂无窗户设计</h2>
          <p className="text-sm text-gray-400 mt-1">请先在编辑器中创建窗户</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-500 transition-colors"
          >
            返回编辑器
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={16} /> 返回编辑器
            </button>
            <div className="w-px h-6 bg-gray-200" />
            <h1 className="text-lg font-bold text-gray-800">窗户效果图展示</h1>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              共 {windows.length} 个窗户
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Grid3X3 size={16} />
              </button>
              <button
                onClick={() => setViewMode('single')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'single' ? 'bg-white shadow text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Maximize2 size={16} />
              </button>
            </div>

            <div className="w-px h-6 bg-gray-200" />

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <Printer size={16} /> 打印
            </button>
            <button
              onClick={handleExportImage}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-500 transition-colors shadow-sm"
            >
              <Download size={16} /> 导出图片
            </button>
          </div>
        </div>
      </header>

      {/* Project Info Banner */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white print:bg-white print:text-black">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-slate-400 print:text-gray-500 mb-1">项目名称</p>
              <p className="text-sm font-semibold">门窗设计方案</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 print:text-gray-500 mb-1">型材系列</p>
              <p className="text-sm font-semibold">{profileInfo.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 print:text-gray-500 mb-1">材料颜色</p>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border border-white/20"
                  style={{ backgroundColor: materialConfig.frameColor || '#8B8B8B' }}
                />
                <p className="text-sm font-semibold">{materialConfig.materialType || '铝合金'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 print:text-gray-500 mb-1">生成日期</p>
              <p className="text-sm font-semibold">{new Date().toLocaleDateString('zh-CN')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={showcaseRef} className="max-w-7xl mx-auto px-4 py-6">
        {viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {windows.map((win, i) => (
              <WindowShowcaseCard key={win.id} win={win} index={i} />
            ))}
          </div>
        ) : (
          /* Single View with navigation */
          <div>
            <WindowShowcaseCard win={windows[currentIndex]} index={currentIndex} />
            {windows.length > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <button
                  onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                  disabled={currentIndex === 0}
                  className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm text-gray-500 font-medium">
                  {currentIndex + 1} / {windows.length}
                </span>
                <button
                  onClick={() => setCurrentIndex(i => Math.min(windows.length - 1, i + 1))}
                  disabled={currentIndex === windows.length - 1}
                  className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Summary Table */}
        <div className="mt-8 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-3">
            <h3 className="text-white font-semibold text-sm">窗户清单汇总</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">序号</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">名称</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">宽度 (mm)</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">高度 (mm)</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">面积 (m2)</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">分格</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">型材</th>
                </tr>
              </thead>
              <tbody>
                {windows.map((win, i) => {
                  const openings = collectOpenings(win.rootOpening);
                  const area = (win.width * win.height / 1000000).toFixed(2);
                  return (
                    <tr key={win.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-gray-500">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{win.name || `窗户 ${i + 1}`}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{win.width}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{win.height}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{area}</td>
                      <td className="px-4 py-2.5 text-gray-600">{openings.length} 格</td>
                      <td className="px-4 py-2.5 text-gray-600">{win.profileSeries?.name || '默认'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-amber-50">
                  <td colSpan={4} className="px-4 py-2.5 font-semibold text-gray-700">合计</td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-amber-700">
                    {windows.reduce((sum, w) => sum + w.width * w.height / 1000000, 0).toFixed(2)} m2
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-gray-700">
                    {windows.reduce((sum, w) => sum + collectOpenings(w.rootOpening).length, 0)} 格
                  </td>
                  <td className="px-4 py-2.5"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          header, .print\\:hidden { display: none !important; }
          body { background: white !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:text-black { color: black !important; }
        }
      `}</style>
    </div>
  );
}
