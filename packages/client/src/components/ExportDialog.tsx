// WindoorDesigner - 导出对话框
// 支持 PNG/SVG/PDF/DXF/JSON 单独导出和批量 ZIP 导出

import { useState, useCallback } from 'react';
import { X, Download, Image, FileText, FileCode, File, Archive, Check } from 'lucide-react';
import type { WindowUnit } from '@/lib/types';
import { exportPng, getPngDataUrl } from '@/lib/export/export-png';
import { exportSvg } from '@/lib/export/export-svg';
import { exportPdf } from '@/lib/export/export-pdf';
import { exportDxf } from '@/lib/export/export-dxf';
import { exportBatchZip } from '@/lib/export/export-batch';
import { saveAs } from 'file-saver';
import Konva from 'konva';

interface ExportDialogProps {
  windows: WindowUnit[];
  stageRef?: React.RefObject<Konva.Stage | null>;
  onClose: () => void;
}

type ExportFormat = 'png' | 'svg' | 'pdf' | 'dxf' | 'json';

const FORMAT_OPTIONS: { id: ExportFormat; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'png', label: 'PNG 图片', desc: '300 DPI 高清位图，适合分享和展示', icon: <Image size={18} /> },
  { id: 'svg', label: 'SVG 矢量', desc: '矢量图形，可在 Illustrator 中编辑', icon: <FileCode size={18} /> },
  { id: 'pdf', label: 'PDF 图纸', desc: 'A4 打印模板，含尺寸标注和信息表', icon: <FileText size={18} /> },
  { id: 'dxf', label: 'DXF 文件', desc: 'AutoCAD 兼容，图层分离', icon: <File size={18} /> },
  { id: 'json', label: 'JSON 数据', desc: '设计数据文件，可重新导入编辑', icon: <FileCode size={18} /> },
];

export default function ExportDialog({ windows, stageRef, onClose }: ExportDialogProps) {
  const [selectedFormats, setSelectedFormats] = useState<Set<ExportFormat>>(new Set(['png']));
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState<ExportFormat | 'batch' | null>(null);

  const toggleFormat = useCallback((format: ExportFormat) => {
    setSelectedFormats(prev => {
      const next = new Set(prev);
      if (next.has(format)) next.delete(format);
      else next.add(format);
      return next;
    });
  }, []);

  const handleExportSingle = useCallback(async (format: ExportFormat) => {
    setExporting(true);
    setExportDone(null);
    try {
      switch (format) {
        case 'png':
          if (stageRef?.current) {
            await exportPng({ stage: stageRef.current, pixelRatio: 3, transparent: true });
          }
          break;
        case 'svg':
          exportSvg({ windows, showDimensions: true, showSashMarks: true });
          break;
        case 'pdf':
          await exportPdf({ windows, showDimensions: true });
          break;
        case 'dxf':
          exportDxf({ windows, showDimensions: true });
          break;
        case 'json': {
          const jsonStr = JSON.stringify({ version: '2.0', windows, exportedAt: new Date().toISOString() }, null, 2);
          const blob = new Blob([jsonStr], { type: 'application/json' });
          saveAs(blob, `windoor-design-${Date.now()}.json`);
          break;
        }
      }
      setExportDone(format);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [windows, stageRef]);

  const handleBatchExport = useCallback(async () => {
    setExporting(true);
    setExportDone(null);
    try {
      const formats = Array.from(selectedFormats);
      const pngDataUrl = stageRef?.current ? getPngDataUrl(stageRef.current, 3) : undefined;
      await exportBatchZip({ windows, formats, pngDataUrl });
      setExportDone('batch');
    } catch (err) {
      console.error('Batch export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [windows, selectedFormats, stageRef]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[oklch(0.14_0.025_260)] border border-[oklch(0.30_0.04_260)] rounded-2xl shadow-2xl w-[520px] max-w-[95vw]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[oklch(0.25_0.04_260)]">
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-slate-100">导出设计</h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Format list */}
        <div className="px-6 py-4 space-y-2">
          {FORMAT_OPTIONS.map(({ id, label, desc, icon }) => (
            <div key={id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                selectedFormats.has(id)
                  ? 'border-amber-500/40 bg-amber-500/10'
                  : 'border-[oklch(0.25_0.04_260)] hover:border-[oklch(0.35_0.04_260)] hover:bg-white/3'
              }`}
              onClick={() => toggleFormat(id)}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                selectedFormats.has(id) ? 'bg-amber-500/20 text-amber-400' : 'bg-[oklch(0.20_0.03_260)] text-slate-400'
              }`}>
                {icon}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-200">{label}</div>
                <div className="text-[11px] text-slate-500">{desc}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleExportSingle(id); }}
                  disabled={exporting}
                  className="px-2.5 py-1 text-[11px] bg-[oklch(0.20_0.03_260)] text-slate-300 rounded-lg hover:bg-[oklch(0.25_0.04_260)] transition-colors disabled:opacity-50"
                >
                  {exportDone === id ? <Check size={12} className="text-green-400" /> : '导出'}
                </button>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  selectedFormats.has(id) ? 'border-amber-400 bg-amber-400' : 'border-slate-600'
                }`}>
                  {selectedFormats.has(id) && <Check size={12} className="text-[oklch(0.14_0.025_260)]" />}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[oklch(0.25_0.04_260)] flex items-center justify-between">
          <span className="text-xs text-slate-500">
            已选 {selectedFormats.size} 种格式 · {windows.length} 个窗户
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              取消
            </button>
            <button onClick={handleBatchExport}
              disabled={exporting || selectedFormats.size === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-amber-500 text-[oklch(0.14_0.025_260)] font-medium rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-50"
            >
              <Archive size={14} />
              {exporting ? '导出中...' : exportDone === 'batch' ? '导出完成!' : '批量导出 ZIP'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
