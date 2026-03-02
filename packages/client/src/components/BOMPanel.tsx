// WindoorDesigner - 材料清单面板 (BOM Panel)
// 展示算料结果，支持按窗户/类别分组，支持导出 CSV

import { useState, useMemo, useCallback } from 'react';
import { X, Download, ChevronDown, ChevronRight, Package, Layers, Calculator, FileSpreadsheet } from 'lucide-react';
import { calculateBOM, groupBOMByWindow, groupBOMByCategory } from '@/lib/calc-engine';
import type { BOMResult, BOMItem } from '@/lib/calc-engine';
import type { WindowUnit } from '@/lib/types';

interface BOMPanelProps {
  windows: WindowUnit[];
  onClose: () => void;
}

type GroupMode = 'window' | 'category';

const CATEGORY_LABELS: Record<string, string> = {
  frame: '框料',
  mullion: '中梃',
  sash: '扇料',
  glass: '玻璃',
  hardware: '五金件',
  seal: '密封条',
  accessory: '辅材',
};

const CATEGORY_COLORS: Record<string, string> = {
  frame: 'bg-blue-500/20 text-blue-400',
  mullion: 'bg-purple-500/20 text-purple-400',
  sash: 'bg-green-500/20 text-green-400',
  glass: 'bg-cyan-500/20 text-cyan-400',
  hardware: 'bg-amber-500/20 text-amber-400',
  seal: 'bg-pink-500/20 text-pink-400',
  accessory: 'bg-gray-500/20 text-gray-400',
};

export default function BOMPanel({ windows, onClose }: BOMPanelProps) {
  const [groupMode, setGroupMode] = useState<GroupMode>('category');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['frame', 'mullion', 'sash', 'glass', 'hardware', 'seal']));

  // 计算 BOM
  const bomResult = useMemo<BOMResult>(() => {
    if (windows.length === 0) return { items: [], summary: { totalFrameLength: 0, totalMullionLength: 0, totalSashLength: 0, totalGlassArea: 0, totalSealLength: 0, hardwareCount: 0, totalWeight: 0, totalPrice: 0 } };
    return calculateBOM(windows);
  }, [windows]);

  // 分组数据
  const groupedData = useMemo(() => {
    if (groupMode === 'window') return groupBOMByWindow(bomResult);
    return groupBOMByCategory(bomResult);
  }, [bomResult, groupMode]);

  // 切换展开
  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // 导出 CSV
  const exportCSV = useCallback(() => {
    const headers = ['类别', '名称', '规格', '数量', '单位', '长度(mm)', '面积(m²)', '重量(kg)', '窗户'];
    const rows = bomResult.items.map(item => [
      CATEGORY_LABELS[item.category] || item.category,
      item.name,
      item.spec,
      item.quantity,
      item.unit,
      item.length || '',
      item.area ? item.area.toFixed(3) : '',
      item.weight ? item.weight.toFixed(2) : '',
      item.windowName,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `windoor-bom-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [bomResult]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[oklch(0.14_0.025_260)] border border-[oklch(0.30_0.04_260)] rounded-2xl shadow-2xl w-[900px] max-w-[95vw] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[oklch(0.25_0.04_260)]">
          <div className="flex items-center gap-3">
            <Calculator className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-slate-100">材料清单 (BOM)</h2>
            <span className="text-xs text-slate-500 bg-[oklch(0.20_0.03_260)] px-2 py-0.5 rounded-full">
              {bomResult.items.length} 项
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
            >
              <FileSpreadsheet size={14} />
              导出 CSV
            </button>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="px-6 py-3 border-b border-[oklch(0.25_0.04_260)] bg-[oklch(0.12_0.02_260)]">
          <div className="grid grid-cols-4 gap-4">
            <SummaryCard label="框料总长" value={`${(bomResult.summary.totalFrameLength / 1000).toFixed(1)} m`} />
            <SummaryCard label="中梃总长" value={`${(bomResult.summary.totalMullionLength / 1000).toFixed(1)} m`} />
            <SummaryCard label="玻璃面积" value={`${bomResult.summary.totalGlassArea.toFixed(2)} m²`} />
            <SummaryCard label="五金件数" value={`${bomResult.summary.hardwareCount} 套`} />
          </div>
        </div>

        {/* Group mode toggle */}
        <div className="px-6 py-2 flex items-center gap-2 border-b border-[oklch(0.20_0.03_260)]">
          <span className="text-xs text-slate-500">分组:</span>
          <button onClick={() => setGroupMode('category')}
            className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${groupMode === 'category' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Layers size={12} className="inline mr-1" />按类别
          </button>
          <button onClick={() => setGroupMode('window')}
            className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${groupMode === 'window' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Package size={12} className="inline mr-1" />按窗户
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {windows.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>暂无窗户数据</p>
              <p className="text-xs mt-1">请先在编辑器中创建窗户</p>
            </div>
          ) : (
            Object.entries(groupedData).map(([key, items]) => {
              const isExpanded = expandedGroups.has(key);
              const groupLabel = groupMode === 'category'
                ? (CATEGORY_LABELS[key] || key)
                : key.split('|')[1] || key;

              return (
                <div key={key} className="mb-2">
                  {/* Group header */}
                  <button onClick={() => toggleGroup(key)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                    {groupMode === 'category' && (
                      <span className={`px-1.5 py-0.5 text-[10px] rounded ${CATEGORY_COLORS[key] || 'bg-gray-500/20 text-gray-400'}`}>
                        {groupLabel}
                      </span>
                    )}
                    {groupMode === 'window' && (
                      <span className="text-xs text-slate-300 font-medium">{groupLabel}</span>
                    )}
                    <span className="text-[10px] text-slate-500 ml-auto">{items.length} 项</span>
                  </button>

                  {/* Group items */}
                  {isExpanded && (
                    <div className="ml-6 mt-1">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-500 border-b border-[oklch(0.20_0.03_260)]">
                            <th className="text-left py-1.5 font-medium">名称</th>
                            <th className="text-left py-1.5 font-medium">规格</th>
                            <th className="text-right py-1.5 font-medium">数量</th>
                            <th className="text-right py-1.5 font-medium">长度/面积</th>
                            <th className="text-right py-1.5 font-medium">重量</th>
                            {groupMode === 'category' && <th className="text-left py-1.5 font-medium">窗户</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => (
                            <tr key={item.id} className="text-slate-300 border-b border-[oklch(0.18_0.02_260)] hover:bg-white/3">
                              <td className="py-1.5">{item.name}</td>
                              <td className="py-1.5 text-slate-400">{item.spec}</td>
                              <td className="py-1.5 text-right font-mono">{item.quantity} {item.unit}</td>
                              <td className="py-1.5 text-right font-mono text-slate-400">
                                {item.length ? `${item.length}mm` : item.area ? `${item.area.toFixed(3)}m²` : '-'}
                              </td>
                              <td className="py-1.5 text-right font-mono text-slate-400">
                                {item.weight ? `${item.weight.toFixed(2)}kg` : '-'}
                              </td>
                              {groupMode === 'category' && (
                                <td className="py-1.5 text-slate-500">{item.windowName}</td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[oklch(0.25_0.04_260)] bg-[oklch(0.12_0.02_260)] rounded-b-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>总重量: <strong className="text-slate-200">{bomResult.summary.totalWeight.toFixed(1)} kg</strong></span>
            <span>密封条总长: <strong className="text-slate-200">{(bomResult.summary.totalSealLength / 1000).toFixed(1)} m</strong></span>
            <span>扇料总长: <strong className="text-slate-200">{(bomResult.summary.totalSashLength / 1000).toFixed(1)} m</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
      <div className="text-sm font-bold text-amber-400 font-mono">{value}</div>
    </div>
  );
}
