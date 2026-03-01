// WindoorDesigner - 触摸事件处理Hook
// 支持: 单指拖拽/绘制、双指缩放平移、长按选择

import { useRef, useCallback } from 'react';

interface TouchState {
  // Single finger
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  // Pinch zoom
  initialDistance: number;
  initialZoom: number;
  initialPanX: number;
  initialPanY: number;
  midX: number;
  midY: number;
  // State
  fingerCount: number;
  isPinching: boolean;
  longPressTimer: ReturnType<typeof setTimeout> | null;
  isLongPress: boolean;
  hasMoved: boolean;
}

interface UseTouchOptions {
  onTouchStart?: (x: number, y: number) => void;
  onTouchMove?: (x: number, y: number) => void;
  onTouchEnd?: (x: number, y: number) => void;
  onTap?: (x: number, y: number) => void;
  onLongPress?: (x: number, y: number) => void;
  onPinchZoom?: (scale: number, centerX: number, centerY: number, panDeltaX: number, panDeltaY: number) => void;
  onTwoFingerPan?: (deltaX: number, deltaY: number) => void;
  longPressDelay?: number;
  moveThreshold?: number;
}

function getDistance(t1: React.Touch, t2: React.Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getMidpoint(t1: React.Touch, t2: React.Touch): { x: number; y: number } {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}

export function useTouch(options: UseTouchOptions) {
  const {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTap,
    onLongPress,
    onPinchZoom,
    onTwoFingerPan,
    longPressDelay = 500,
    moveThreshold = 10,
  } = options;

  const touchState = useRef<TouchState>({
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    initialDistance: 0,
    initialZoom: 1,
    initialPanX: 0,
    initialPanY: 0,
    midX: 0,
    midY: 0,
    fingerCount: 0,
    isPinching: false,
    longPressTimer: null,
    isLongPress: false,
    hasMoved: false,
  });

  const clearLongPress = useCallback(() => {
    const ts = touchState.current;
    if (ts.longPressTimer) {
      clearTimeout(ts.longPressTimer);
      ts.longPressTimer = null;
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const ts = touchState.current;
    ts.fingerCount = e.touches.length;
    ts.hasMoved = false;
    ts.isLongPress = false;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      ts.startX = x;
      ts.startY = y;
      ts.lastX = x;
      ts.lastY = y;
      ts.isPinching = false;

      // Start long press timer
      clearLongPress();
      ts.longPressTimer = setTimeout(() => {
        ts.isLongPress = true;
        onLongPress?.(x, y);
      }, longPressDelay);

      onTouchStart?.(x, y);
    } else if (e.touches.length === 2) {
      clearLongPress();
      ts.isPinching = true;
      ts.initialDistance = getDistance(e.touches[0], e.touches[1]);
      const mid = getMidpoint(e.touches[0], e.touches[1]);
      ts.midX = mid.x;
      ts.midY = mid.y;
    }
  }, [onTouchStart, onLongPress, clearLongPress, longPressDelay]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const ts = touchState.current;

    if (e.touches.length === 1 && !ts.isPinching) {
      const touch = e.touches[0];
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      const dx = x - ts.startX;
      const dy = y - ts.startY;
      if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
        ts.hasMoved = true;
        clearLongPress();
      }

      ts.lastX = x;
      ts.lastY = y;
      onTouchMove?.(x, y);
    } else if (e.touches.length === 2) {
      clearLongPress();
      ts.isPinching = true;

      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / ts.initialDistance;
      const currentMid = getMidpoint(e.touches[0], e.touches[1]);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

      const centerX = currentMid.x - rect.left;
      const centerY = currentMid.y - rect.top;
      const panDeltaX = currentMid.x - ts.midX;
      const panDeltaY = currentMid.y - ts.midY;

      onPinchZoom?.(scale, centerX, centerY, panDeltaX, panDeltaY);

      ts.midX = currentMid.x;
      ts.midY = currentMid.y;
      ts.initialDistance = currentDistance;
    }
  }, [onTouchMove, onPinchZoom, clearLongPress, moveThreshold]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const ts = touchState.current;
    clearLongPress();

    if (e.touches.length === 0) {
      if (!ts.isPinching && !ts.hasMoved && !ts.isLongPress) {
        // It was a tap
        onTap?.(ts.startX, ts.startY);
      }

      if (!ts.isPinching) {
        onTouchEnd?.(ts.lastX, ts.lastY);
      }

      ts.isPinching = false;
      ts.fingerCount = 0;
    } else if (e.touches.length === 1) {
      // Went from 2 fingers to 1
      ts.isPinching = false;
      const touch = e.touches[0];
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      ts.lastX = touch.clientX - rect.left;
      ts.lastY = touch.clientY - rect.top;
    }
  }, [onTap, onTouchEnd, clearLongPress]);

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
