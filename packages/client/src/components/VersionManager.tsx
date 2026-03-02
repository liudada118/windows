// WindoorDesigner - 版本管理面板
// 支持保存版本快照、切换版本、对比版本

import { useState, useCallback, useMemo } from 'react';
import { X, Save, Clock, GitBranch, Trash2, RotateCcw, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import type { WindowUnit } from '@/lib/types';

export interface DesignVersion {
  id: string;
  name: string;
  description?: string;
  timestamp: number;
  windows: WindowUnit[];
  thumbnail?: string; // base64 PNG
}

interface VersionManagerProps {
  currentWindows: WindowUnit[];
  onRestore: (windows: WindowUnit[]) => void;
  onClose: () => void;
}

const STORAGE_KEY = 'windoor-versions';

function loadVersions(): DesignVersion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveVersions(versions: DesignVersion[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
  } catch {
    // Storage full, remove oldest
    if (versions.length > 1) {
      versions.shift();
      saveVersions(versions);
    }
  }
}

export default function VersionManager({ currentWindows, onRestore, onClose }: VersionManagerProps) {
  const [versions, setVersions] = useState<DesignVersion[]>(loadVersions);
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionDesc, setNewVersionDesc] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  // 保存新版本
  const handleSave = useCallback(() => {
    const version: DesignVersion = {
      id: `v-${Date.now()}`,
      name: newVersionName || `版本 ${versions.length + 1}`,
      description: newVersionDesc || undefined,
      timestamp: Date.now(),
      windows: JSON.parse(JSON.stringify(currentWindows)),
    };

    const updated = [...versions, version];
    // 最多保存 20 个版本
    while (updated.length > 20) updated.shift();

    setVersions(updated);
    saveVersions(updated);
    setNewVersionName('');
    setNewVersionDesc('');
    setShowSaveForm(false);
  }, [currentWindows, versions, newVersionName, newVersionDesc]);

  // 恢复版本
  const handleRestore = useCallback((version: DesignVersion) => {
    onRestore(JSON.parse(JSON.stringify(version.windows)));
  }, [onRestore]);

  // 删除版本
  const handleDelete = useCallback((id: string) => {
    const updated = versions.filter(v => v.id !== id);
    setVersions(updated);
    saveVersions(updated);
  }, [versions]);

  // 格式化时间
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[oklch(0.14_0.025_260)] border border-[oklch(0.30_0.04_260)] rounded-2xl shadow-2xl w-[500px] max-w-[95vw] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[oklch(0.25_0.04_260)]">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-slate-100">版本管理</h2>
            <span className="text-xs text-slate-500 bg-[oklch(0.20_0.03_260)] px-2 py-0.5 rounded-full">
              {versions.length} 个版本
            </span>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Save new version */}
        <div className="px-6 py-3 border-b border-[oklch(0.20_0.03_260)]">
          {!showSaveForm ? (
            <button onClick={() => setShowSaveForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500/30 transition-colors text-sm font-medium"
            >
              <Save size={14} />
              保存当前版本
            </button>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="版本名称（可选）"
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                className="w-full px-3 py-2 bg-[oklch(0.10_0.02_260)] border border-[oklch(0.25_0.04_260)] rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
              <input
                type="text"
                placeholder="版本描述（可选）"
                value={newVersionDesc}
                onChange={(e) => setNewVersionDesc(e.target.value)}
                className="w-full px-3 py-2 bg-[oklch(0.10_0.02_260)] border border-[oklch(0.25_0.04_260)] rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
              <div className="flex gap-2">
                <button onClick={handleSave}
                  className="flex-1 px-3 py-2 bg-amber-500 text-[oklch(0.14_0.025_260)] rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors"
                >
                  保存
                </button>
                <button onClick={() => setShowSaveForm(false)}
                  className="px-3 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Version list */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {versions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂无保存的版本</p>
              <p className="text-xs mt-1">点击上方按钮保存当前设计</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...versions].reverse().map((version) => (
                <div key={version.id}
                  className={`rounded-xl border transition-all ${
                    selectedVersion === version.id
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : 'border-[oklch(0.22_0.03_260)] hover:border-[oklch(0.30_0.04_260)]'
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    onClick={() => setExpandedVersion(expandedVersion === version.id ? null : version.id)}
                  >
                    {expandedVersion === version.id
                      ? <ChevronDown size={14} className="text-slate-400" />
                      : <ChevronRight size={14} className="text-slate-400" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-200 truncate">{version.name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2">
                        <Clock size={10} />
                        {formatTime(version.timestamp)}
                        <span>·</span>
                        <span>{version.windows.length} 个窗户</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); handleRestore(version); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                        title="恢复此版本"
                      >
                        <RotateCcw size={13} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(version.id); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="删除"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {expandedVersion === version.id && version.description && (
                    <div className="px-4 pb-3 pt-0">
                      <p className="text-xs text-slate-400 pl-6">{version.description}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[oklch(0.25_0.04_260)] text-xs text-slate-500 text-center">
          最多保存 20 个版本 · 数据存储在本地浏览器
        </div>
      </div>
    </div>
  );
}
