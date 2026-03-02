// WindoorDesigner - 编辑器状态管理
import { useState, useCallback, useRef } from 'react';
import type { EditorState, WindowUnit, ToolType, SashType, ProfileSeries, HistoryEntry } from '@/lib/types';
import { DEFAULT_PROFILE_SERIES } from '@/lib/types';

const MAX_HISTORY = 50;

const initialState: EditorState = {
  windows: [],
  selectedWindowId: null,
  selectedElementId: null,
  selectedElementType: null,
  activeTool: 'select',
  zoom: 1,
  panX: 0,
  panY: 0,
  gridSize: 10,
  snapToGrid: true,
  showDimensions: true,
  activeSashType: 'casement-left',
  activeProfileSeries: DEFAULT_PROFILE_SERIES[2], // 70系列
};

export function useEditorStore() {
  const [state, setState] = useState<EditorState>(initialState);
  const historyRef = useRef<HistoryEntry[]>([]);
  const futureRef = useRef<HistoryEntry[]>([]);

  const pushHistory = useCallback(() => {
    historyRef.current.push({
      windows: JSON.parse(JSON.stringify(state.windows)),
      timestamp: Date.now(),
    });
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    }
    futureRef.current = [];
  }, [state.windows]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current.pop()!;
    futureRef.current.push({
      windows: JSON.parse(JSON.stringify(state.windows)),
      timestamp: Date.now(),
    });
    setState(s => ({ ...s, windows: prev.windows }));
  }, [state.windows]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current.pop()!;
    historyRef.current.push({
      windows: JSON.parse(JSON.stringify(state.windows)),
      timestamp: Date.now(),
    });
    setState(s => ({ ...s, windows: next.windows }));
  }, [state.windows]);

  const setTool = useCallback((tool: ToolType) => {
    setState(s => ({ ...s, activeTool: tool }));
  }, []);

  const setZoom = useCallback((zoom: number) => {
    setState(s => ({ ...s, zoom: Math.max(0.1, Math.min(5, zoom)) }));
  }, []);

  const setPan = useCallback((x: number, y: number) => {
    setState(s => ({ ...s, panX: x, panY: y }));
  }, []);

  const addWindow = useCallback((win: WindowUnit) => {
    pushHistory();
    setState(s => ({
      ...s,
      windows: [...s.windows, win],
      selectedWindowId: win.id,
    }));
  }, [pushHistory]);

  const updateWindow = useCallback((id: string, updates: Partial<WindowUnit>) => {
    setState(s => ({
      ...s,
      windows: s.windows.map(w => w.id === id ? { ...w, ...updates } : w),
    }));
  }, []);

  const updateWindowWithHistory = useCallback((id: string, updates: Partial<WindowUnit>) => {
    pushHistory();
    setState(s => ({
      ...s,
      windows: s.windows.map(w => w.id === id ? { ...w, ...updates } : w),
    }));
  }, [pushHistory]);

  const removeWindow = useCallback((id: string) => {
    pushHistory();
    setState(s => ({
      ...s,
      windows: s.windows.filter(w => w.id !== id),
      selectedWindowId: s.selectedWindowId === id ? null : s.selectedWindowId,
    }));
  }, [pushHistory]);

  const selectWindow = useCallback((id: string | null) => {
    setState(s => ({
      ...s,
      selectedWindowId: id,
      selectedElementId: null,
      selectedElementType: null,
    }));
  }, []);

  const selectElement = useCallback((elementId: string | null, elementType: EditorState['selectedElementType']) => {
    setState(s => ({
      ...s,
      selectedElementId: elementId,
      selectedElementType: elementType,
    }));
  }, []);

  const setSashType = useCallback((type: SashType) => {
    setState(s => ({ ...s, activeSashType: type }));
  }, []);

  const setProfileSeries = useCallback((series: ProfileSeries) => {
    setState(s => ({ ...s, activeProfileSeries: series }));
  }, []);

  const toggleDimensions = useCallback(() => {
    setState(s => ({ ...s, showDimensions: !s.showDimensions }));
  }, []);

  const toggleSnapToGrid = useCallback(() => {
    setState(s => ({ ...s, snapToGrid: !s.snapToGrid }));
  }, []);

  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const selectedWindow = state.windows.find(w => w.id === state.selectedWindowId) || null;

  return {
    state,
    selectedWindow,
    canUndo,
    canRedo,
    undo,
    redo,
    setTool,
    setZoom,
    setPan,
    addWindow,
    updateWindow,
    updateWindowWithHistory,
    removeWindow,
    selectWindow,
    selectElement,
    setSashType,
    setProfileSeries,
    toggleDimensions,
    toggleSnapToGrid,
    pushHistory,
  };
}
