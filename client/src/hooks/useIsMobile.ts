// WindoorDesigner - 响应式检测Hook
// 检测是否为移动端/平板设备

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768; // px
const TABLET_BREAKPOINT = 1024; // px

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(isSmallScreen || (isTouchDevice && window.innerWidth < TABLET_BREAKPOINT));
    };

    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}

export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    check();
  }, []);

  return isTouch;
}

export function useScreenSize(): 'mobile' | 'tablet' | 'desktop' {
  const [size, setSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const check = () => {
      if (window.innerWidth < MOBILE_BREAKPOINT) {
        setSize('mobile');
      } else if (window.innerWidth < TABLET_BREAKPOINT) {
        setSize('tablet');
      } else {
        setSize('desktop');
      }
    };

    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return size;
}
