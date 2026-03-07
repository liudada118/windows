// ShowcasePage.tsx - 完整展示界面
// 提供专业的窗户效果图展示，包括 2D 工程图、材料信息、尺寸标注
// 支持打印和导出 PDF
// 支持普通窗和组合窗（U形窗/L形窗/凸窗）

import { useState, useRef, useCallback, useMemo } from 'react';
import { useDesignStore } from '@/stores/designStore';
import { Stage, Layer, Rect, Line, Text, Group } from 'react-konva';
import { ArrowLeft, Printer, Download, ChevronLeft, ChevronRight, Maximize2, Grid3X3, FileText } from 'lucide-react';
import { useLocation } from 'wouter';
import type { WindowUnit, Opening, Mullion } from '@/lib/types';
import type { CompositeWindow } from '@windoor/shared';
import { DEFAULT_PROFILE_SERIES } from '@windoor/shared';
import { MATERIAL_TYPES, COLOR_PRESETS } from '@/lib/constants';

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
  if (opening.mullions && opening.mullions.length > 0) {
    results.push(...opening.mullions);
  }
  if (opening.childOpenings) {
    for (const child of opening.childOpenings) {
      collectMullions(child, results);
    }
  }
  return results;
}

// ===== Helper: find mullion parent opening =====
function findMullionParent(opening: Opening, mullionId: string): Opening | null {
  if (opening.mullions?.some(m => m.id === mullionId)) {
    return opening;
  }
  if (opening.childOpenings) {
    for (const child of opening.childOpenings) {
      const found = findMullionParent(child, mullionId);
      if (found) return found;
    }
  }
  return null;
}

// ===== Window Showcase Card (for single WindowUnit) =====
function WindowShowcaseCard({ win, index, label }: { win: WindowUnit; index: number; label?: string }) {
  const scale = SHOWCASE_SCALE;
  const series = DEFAULT_PROFILE_SERIES.find(p => p.id === win.profileSeriesId);
  const frameWidth = series?.frameWidth || win.frame.profileWidth || 60;
  const mullionWidth = series?.mullionWidth || 70;

  const canvasWidth = win.width * scale + PADDING * 2;
  const canvasHeight = win.height * scale + PADDING * 2 + 80; // extra space for labels

  const rootOpening = win.frame.openings[0];
  if (!rootOpening) return null;

  const openings = collectOpenings(rootOpening);
  const mullions = collectMullions(rootOpening);

  // Get color config
  const materialConfig = useDesignStore(s => s.designData.materialConfig);
  const frameColor = materialConfig?.colors?.frameColor || '#8B8B8B';
  const glassColor = materialConfig?.colors?.glassColor || '#B8D4E8';
  const mullionColor = materialConfig?.colors?.mullionColor || '#8B8B8B';

  const ox = PADDING;
  const oy = PADDING;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Card Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-sm">{label || win.name || `窗户 ${index + 1}`}</h3>
            <p className="text-slate-300 text-xs mt-0.5">
              {win.width} x {win.height} mm | {series?.name || '默认型材'}
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
              text={`${label || win.name || '窗户'} - 工程图`}
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
              const isVertical = m.type === 'vertical';
              const parent = findMullionParent(rootOpening, m.id);
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
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

// ===== Composite Window Showcase Card =====
function CompositeWindowShowcaseCard({ composite, index }: { composite: CompositeWindow; index: number }) {
  const typeLabel = composite.type === 'u-shape' ? 'U形窗' :
    composite.type === 'l-shape' ? 'L形窗' :
    composite.type === 'bay-window' ? '凸窗/飘窗' : '组合窗';

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Composite Header */}
      <div className="bg-gradient-to-r from-indigo-800 to-indigo-700 px-5 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-sm">{composite.name || `${typeLabel} ${index + 1}`}</h3>
            <p className="text-indigo-300 text-xs mt-0.5">
              {typeLabel} | {composite.panels.length} 个面板
            </p>
          </div>
          <div className="text-right">
            <span className="text-amber-400 text-xs font-mono">#{String(index + 1).padStart(2, '0')}</span>
            <span className="ml-2 text-xs bg-indigo-600 text-indigo-200 px-2 py-0.5 rounded-full">组合窗</span>
          </div>
        </div>
      </div>

      {/* Render each panel */}
      <div className="p-4 bg-gray-50">
        <div className="grid grid-cols-1 gap-4">
          {composite.panels.map((panel, pi) => {
            const win = panel.windowUnit;
            if (!win || !win.frame?.openings?.[0]) return null;
            return (
              <div key={panel.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
                  {panel.label || `面板 ${pi + 1}`} — {win.width} x {win.height} mm (角度: {panel.angle}°)
                </div>
                <WindowShowcaseCard
                  win={win}
                  index={pi}
                  label={`${composite.name || typeLabel} - ${panel.label || `面板 ${pi + 1}`}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ===== Unified display item type =====
type ShowcaseItem =
  | { type: 'window'; data: WindowUnit }
  | { type: 'composite'; data: CompositeWindow };

// ===== Main ShowcasePage =====
export default function ShowcasePage() {
  const [, navigate] = useLocation();
  const windows = useDesignStore(s => s.designData.windows) || [];
  const compositeWindows = useDesignStore(s => s.designData.compositeWindows) || [];
  const materialConfig = useDesignStore(s => s.designData.materialConfig);
  const activeProfileSeries = useDesignStore(s => s.activeProfileSeries);
  const showcaseRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');

  // Merge all items for display
  const allItems: ShowcaseItem[] = useMemo(() => {
    const items: ShowcaseItem[] = [];
    for (const w of windows) {
      items.push({ type: 'window', data: w });
    }
    for (const cw of compositeWindows) {
      items.push({ type: 'composite', data: cw });
    }
    return items;
  }, [windows, compositeWindows]);

  // Collect all individual WindowUnits for summary table
  const allWindowUnits: { win: WindowUnit; label: string }[] = useMemo(() => {
    const units: { win: WindowUnit; label: string }[] = [];
    windows.forEach((w, i) => {
      units.push({ win: w, label: w.name || `窗户 ${i + 1}` });
    });
    compositeWindows.forEach((cw) => {
      const typeLabel = cw.type === 'u-shape' ? 'U形窗' :
        cw.type === 'l-shape' ? 'L形窗' :
        cw.type === 'bay-window' ? '凸窗/飘窗' : '组合窗';
      cw.panels.forEach((panel) => {
        if (panel.windowUnit) {
          units.push({
            win: panel.windowUnit,
            label: `${cw.name || typeLabel} - ${panel.label || '面板'}`,
          });
        }
      });
    });
    return units;
  }, [windows, compositeWindows]);

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

  if (allItems.length === 0) {
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
              共 {allItems.length} 个窗户
              {compositeWindows.length > 0 && ` (含 ${compositeWindows.length} 个组合窗)`}
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
                  style={{ backgroundColor: materialConfig?.colors?.frameColor || '#8B8B8B' }}
                />
                <p className="text-sm font-semibold">{materialConfig?.name || '铝合金'}</p>
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
            {allItems.map((item, i) => {
              if (item.type === 'window') {
                return <WindowShowcaseCard key={item.data.id} win={item.data} index={i} />;
              } else {
                return <CompositeWindowShowcaseCard key={item.data.id} composite={item.data} index={i} />;
              }
            })}
          </div>
        ) : (
          /* Single View with navigation */
          <div>
            {allItems[currentIndex]?.type === 'window' ? (
              <WindowShowcaseCard win={allItems[currentIndex].data as WindowUnit} index={currentIndex} />
            ) : allItems[currentIndex]?.type === 'composite' ? (
              <CompositeWindowShowcaseCard composite={allItems[currentIndex].data as CompositeWindow} index={currentIndex} />
            ) : null}
            {allItems.length > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <button
                  onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                  disabled={currentIndex === 0}
                  className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm text-gray-500 font-medium">
                  {currentIndex + 1} / {allItems.length}
                </span>
                <button
                  onClick={() => setCurrentIndex(i => Math.min(allItems.length - 1, i + 1))}
                  disabled={currentIndex === allItems.length - 1}
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
                {allWindowUnits.map((item, i) => {
                  const win = item.win;
                  const rootOp = win.frame?.openings?.[0];
                  const openings = rootOp ? collectOpenings(rootOp) : [];
                  const area = (win.width * win.height / 1000000).toFixed(2);
                  return (
                    <tr key={win.id + '-' + i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-gray-500">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{item.label}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{win.width}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{win.height}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{area}</td>
                      <td className="px-4 py-2.5 text-gray-600">{openings.length} 格</td>
                      <td className="px-4 py-2.5 text-gray-600">{DEFAULT_PROFILE_SERIES.find(p => p.id === win.profileSeriesId)?.name || '默认'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-amber-50">
                  <td colSpan={4} className="px-4 py-2.5 font-semibold text-gray-700">合计</td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-amber-700">
                    {allWindowUnits.reduce((sum, item) => sum + item.win.width * item.win.height / 1000000, 0).toFixed(2)} m2
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-gray-700">
                    {allWindowUnits.reduce((sum, item) => {
                      const rootOp = item.win.frame?.openings?.[0];
                      return sum + (rootOp ? collectOpenings(rootOp).length : 0);
                    }, 0)} 格
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
