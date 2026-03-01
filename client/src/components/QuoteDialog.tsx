// WindoorDesigner - 报价单对话框
// 工业蓝图美学: 精确的报价数据展示

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { WindowUnit } from '@/lib/types';
import { DEFAULT_PROFILE_SERIES } from '@/lib/types';
import { FileDown, Printer } from 'lucide-react';

interface QuoteDialogProps {
  open: boolean;
  onClose: () => void;
  windows: WindowUnit[];
}

interface QuoteLineItem {
  name: string;
  series: string;
  width: number;
  height: number;
  area: number;
  unitPrice: number;
  totalPrice: number;
}

// Simulated pricing per m² based on series
const SERIES_PRICING: Record<string, number> = {
  'series-60': 380,
  'series-65': 420,
  'series-70': 480,
  'series-80': 560,
  'series-85': 620,
};

export default function QuoteDialog({ open, onClose, windows }: QuoteDialogProps) {
  const [customerName, setCustomerName] = useState('');
  const [projectName, setProjectName] = useState('');

  const lineItems: QuoteLineItem[] = useMemo(() => {
    return windows.map((win) => {
      const series = DEFAULT_PROFILE_SERIES.find(s => s.id === win.profileSeriesId);
      const area = (win.width * win.height) / 1000000; // m²
      const unitPrice = SERIES_PRICING[win.profileSeriesId] || 480;
      return {
        name: win.name,
        series: series?.name || '70系列',
        width: win.width,
        height: win.height,
        area: parseFloat(area.toFixed(2)),
        unitPrice,
        totalPrice: parseFloat((area * unitPrice).toFixed(2)),
      };
    });
  }, [windows]);

  const totalArea = lineItems.reduce((sum, item) => sum + item.area, 0);
  const totalPrice = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleExportCSV = () => {
    const headers = ['序号', '名称', '型材系列', '宽度(mm)', '高度(mm)', '面积(m²)', '单价(元/m²)', '金额(元)'];
    const rows = lineItems.map((item, i) => [
      i + 1,
      item.name,
      item.series,
      item.width,
      item.height,
      item.area,
      item.unitPrice,
      item.totalPrice,
    ]);
    rows.push(['', '', '', '', '合计', totalArea.toFixed(2), '', totalPrice.toFixed(2)]);

    const csvContent = [
      `客户: ${customerName || '未填写'}`,
      `项目: ${projectName || '未填写'}`,
      `日期: ${new Date().toLocaleDateString('zh-CN')}`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `报价单_${customerName || '未命名'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>报价单 - ${customerName || '未命名'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Microsoft YaHei', sans-serif; padding: 40px; color: #1a202c; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2d3748; padding-bottom: 20px; }
    .header h1 { font-size: 24px; color: #2d3748; }
    .header p { font-size: 12px; color: #718096; margin-top: 4px; }
    .info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
    .info div { display: flex; gap: 4px; }
    .info span { color: #718096; }
    .info strong { color: #1a202c; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #2d3748; color: white; padding: 8px 12px; text-align: left; font-weight: 500; }
    td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f7fafc; }
    .total-row td { font-weight: 700; background: #edf2f7 !important; border-top: 2px solid #2d3748; }
    .footer { margin-top: 40px; font-size: 11px; color: #a0aec0; text-align: center; }
    .amount { text-align: right; font-family: 'Courier New', monospace; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>门窗工程报价单</h1>
    <p>WindoorDesigner 自动生成</p>
  </div>
  <div class="info">
    <div><span>客户：</span><strong>${customerName || '—'}</strong></div>
    <div><span>项目：</span><strong>${projectName || '—'}</strong></div>
    <div><span>日期：</span><strong>${new Date().toLocaleDateString('zh-CN')}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>序号</th>
        <th>名称</th>
        <th>型材系列</th>
        <th>宽×高 (mm)</th>
        <th class="amount">面积 (m²)</th>
        <th class="amount">单价 (元/m²)</th>
        <th class="amount">金额 (元)</th>
      </tr>
    </thead>
    <tbody>
      ${lineItems.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.name}</td>
        <td>${item.series}</td>
        <td>${item.width} × ${item.height}</td>
        <td class="amount">${item.area.toFixed(2)}</td>
        <td class="amount">${item.unitPrice.toFixed(2)}</td>
        <td class="amount">${item.totalPrice.toFixed(2)}</td>
      </tr>`).join('')}
      <tr class="total-row">
        <td colspan="4">合计</td>
        <td class="amount">${totalArea.toFixed(2)}</td>
        <td></td>
        <td class="amount">¥ ${totalPrice.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">
    <p>本报价单由 WindoorDesigner 自动生成，仅供参考，实际价格以签约合同为准。</p>
  </div>
  <script>window.print();</script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-[oklch(0.17_0.028_260)] border-[oklch(0.30_0.04_260)] text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-100">报价单</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            基于当前设计自动计算报价，价格仅供参考
          </DialogDescription>
        </DialogHeader>

        {/* Customer info */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">客户名称</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="请输入客户名称"
              className="w-full bg-[oklch(0.20_0.035_260)] border border-[oklch(0.30_0.04_260)] rounded px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">项目名称</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="请输入项目名称"
              className="w-full bg-[oklch(0.20_0.035_260)] border border-[oklch(0.30_0.04_260)] rounded px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
          </div>
        </div>

        {/* Quote table */}
        <div className="rounded border border-[oklch(0.28_0.035_260)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[oklch(0.14_0.025_260)]">
                <th className="px-3 py-2 text-left text-slate-400 font-medium">#</th>
                <th className="px-3 py-2 text-left text-slate-400 font-medium">名称</th>
                <th className="px-3 py-2 text-left text-slate-400 font-medium">型材</th>
                <th className="px-3 py-2 text-left text-slate-400 font-medium">尺寸</th>
                <th className="px-3 py-2 text-right text-slate-400 font-medium">面积</th>
                <th className="px-3 py-2 text-right text-slate-400 font-medium">单价</th>
                <th className="px-3 py-2 text-right text-slate-400 font-medium">金额</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-600">
                    画布为空，请先添加窗口
                  </td>
                </tr>
              ) : (
                <>
                  {lineItems.map((item, i) => (
                    <tr key={i} className="border-t border-[oklch(0.22_0.03_260)] hover:bg-[oklch(0.20_0.035_260)]">
                      <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                      <td className="px-3 py-2 text-slate-200">{item.name}</td>
                      <td className="px-3 py-2 text-slate-400">{item.series}</td>
                      <td className="px-3 py-2 text-slate-400 font-mono">{item.width}×{item.height}</td>
                      <td className="px-3 py-2 text-right text-slate-300 font-mono">{item.area.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-slate-400 font-mono">{item.unitPrice}</td>
                      <td className="px-3 py-2 text-right text-amber-400 font-mono font-semibold">{item.totalPrice.toFixed(2)}</td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="border-t-2 border-amber-500/30 bg-[oklch(0.14_0.025_260)]">
                    <td colSpan={4} className="px-3 py-2 text-right text-slate-300 font-semibold">合计</td>
                    <td className="px-3 py-2 text-right text-slate-200 font-mono font-semibold">{totalArea.toFixed(2)} m²</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-right text-amber-400 font-mono font-bold text-sm">¥ {totalPrice.toFixed(2)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-2">
          <p className="text-[10px] text-slate-600">价格基于型材系列自动计算，仅供参考</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={lineItems.length === 0}
              className="text-xs border-[oklch(0.30_0.04_260)] text-slate-300 hover:text-slate-100 hover:bg-[oklch(0.25_0.04_260)]"
            >
              <FileDown size={14} className="mr-1" />
              导出CSV
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={lineItems.length === 0}
              className="text-xs bg-amber-500 text-slate-900 hover:bg-amber-400"
            >
              <Printer size={14} className="mr-1" />
              打印报价单
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
