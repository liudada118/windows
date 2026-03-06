// WindoorDesigner - 拍照识别 3D 框架预览组件
// v4: 正确的组合窗3D渲染 - L形/U形/凸窗

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { PhotoRecognitionResult } from '@/lib/photoRecognition';
import { RotateCcw, Maximize2, Eye, Grid3x3, Box } from 'lucide-react';

interface PhotoFramePreviewProps {
  result: PhotoRecognitionResult | null;
  className?: string;
}

const S = 0.001; // mm -> m

type ViewAngle = 'front' | 'perspective' | 'top';

// ===== 材质 =====
const _alumMat = () => new THREE.MeshStandardMaterial({ color: 0xB0B0B0, metalness: 0.8, roughness: 0.3 });
const _glassMat = () => new THREE.MeshStandardMaterial({
  color: 0xc8e6f0, metalness: 0, roughness: 0.1,
  transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false,
});
const _cornerMat = () => new THREE.MeshStandardMaterial({ color: 0x909090, metalness: 0.8, roughness: 0.3 });

// ===== 创建面板 =====
// 面板居中在原点，宽度沿X，高度沿Y，深度沿Z
// 面板朝向 +Z 方向（正面朝观察者）
function makePanel(wMM: number, hMM: number): THREE.Group {
  const g = new THREE.Group();
  const w = wMM * S, h = hMM * S;
  const fw = 0.06, fd = 0.07; // 框宽60mm，框深70mm
  const mat = _alumMat(), gm = _glassMat();

  // 四条框
  const bars: [number, number, number, number][] = [
    [0, (h - fw) / 2, w, fw],           // 上
    [0, -(h - fw) / 2, w, fw],          // 下
    [-(w - fw) / 2, 0, fw, h - fw * 2], // 左
    [(w - fw) / 2, 0, fw, h - fw * 2],  // 右
  ];
  for (const [x, y, sx, sy] of bars) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, fd), mat);
    m.position.set(x, y, 0);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }

  // 中梃 + 玻璃
  if (wMM > 1200) {
    const mw = 0.06;
    const m = new THREE.Mesh(new THREE.BoxGeometry(mw, h - fw * 2, fd), mat);
    m.position.set(0, 0, 0);
    m.castShadow = true;
    g.add(m);
    const gw = (w - fw * 2 - mw) / 2, gh = h - fw * 2;
    const lg = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), gm);
    lg.position.set(-mw / 2 - gw / 2, 0, 0);
    g.add(lg);
    const rg = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), gm);
    rg.position.set(mw / 2 + gw / 2, 0, 0);
    g.add(rg);
  } else {
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w - fw * 2, h - fw * 2), gm);
    gl.position.set(0, 0, 0);
    g.add(gl);
  }

  return g;
}

// ===== 辅助：将面板放置到指定位置和旋转 =====
// pivot: 面板上的锚点（相对于面板中心的偏移）
// worldPos: 锚点在世界空间中的目标位置
// rotY: 绕Y轴的旋转角度
function placePanel(panel: THREE.Group, pivotOffset: THREE.Vector3, worldPos: THREE.Vector3, rotY: number) {
  // 创建一个容器，先把面板偏移使pivot在原点，再旋转，再移到目标位置
  const container = new THREE.Group();
  panel.position.copy(pivotOffset.clone().negate()); // 面板偏移使pivot在容器原点
  container.add(panel);
  container.rotation.y = rotY;
  container.position.copy(worldPos);
  return container;
}

// ===== L形窗 =====
function buildLShape(result: PhotoRecognitionResult): THREE.Group {
  const root = new THREE.Group();
  const fp = result.panels[0], sp = result.panels[1];
  const fw = fp.width * S, sw = sp.width * S, h = fp.height * S;

  // 正面面板：右边缘对齐到转角点 (0, 0, 0)
  // 面板中心在 (-fw/2, 0, 0)，pivot在面板右边缘 (fw/2, 0, 0)
  const frontPanel = makePanel(fp.width, fp.height);
  const frontContainer = placePanel(
    frontPanel,
    new THREE.Vector3(fw / 2, 0, 0),  // pivot: 面板右边缘
    new THREE.Vector3(0, 0, 0),         // 世界位置: 转角点
    0                                    // 不旋转
  );
  root.add(frontContainer);

  // 侧面面板：左边缘对齐到转角点，旋转90度
  // pivot在面板左边缘 (-sw/2, 0, 0)
  const sidePanel = makePanel(sp.width, sp.height);
  const sideContainer = placePanel(
    sidePanel,
    new THREE.Vector3(-sw / 2, 0, 0),  // pivot: 面板左边缘
    new THREE.Vector3(0, 0, 0),          // 世界位置: 转角点
    -Math.PI / 2                         // 旋转-90度（向右后方延伸）
  );
  root.add(sideContainer);

  // 转角立柱
  const cp = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), _cornerMat());
  cp.position.set(0, 0, 0);
  cp.castShadow = true;
  root.add(cp);

  return root;
}

// ===== U形窗 =====
function buildUShape(result: PhotoRecognitionResult): THREE.Group {
  const root = new THREE.Group();
  const lp = result.panels[0], fp = result.panels[1], rp = result.panels[2];
  const fw = fp.width * S, lw = lp.width * S, rw = rp.width * S, h = fp.height * S;

  // 正面面板
  const frontPanel = makePanel(fp.width, fp.height);
  frontPanel.position.set(0, 0, 0);
  root.add(frontPanel);

  // 左侧面板：从正面左边缘向后延伸
  const leftPanel = makePanel(lp.width, lp.height);
  const leftContainer = placePanel(
    leftPanel,
    new THREE.Vector3(lw / 2, 0, 0),
    new THREE.Vector3(-fw / 2, 0, 0),
    Math.PI / 2
  );
  root.add(leftContainer);

  // 右侧面板：从正面右边缘向后延伸
  const rightPanel = makePanel(rp.width, rp.height);
  const rightContainer = placePanel(
    rightPanel,
    new THREE.Vector3(-rw / 2, 0, 0),
    new THREE.Vector3(fw / 2, 0, 0),
    -Math.PI / 2
  );
  root.add(rightContainer);

  // 转角立柱
  const cmat = _cornerMat();
  const lcp = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), cmat);
  lcp.position.set(-fw / 2, 0, 0);
  lcp.castShadow = true;
  root.add(lcp);
  const rcp = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), cmat);
  rcp.position.set(fw / 2, 0, 0);
  rcp.castShadow = true;
  root.add(rcp);

  return root;
}

// ===== 凸窗 =====
function buildBay(result: PhotoRecognitionResult): THREE.Group {
  const root = new THREE.Group();
  const lp = result.panels[0], fp = result.panels[1], rp = result.panels[2];
  const fw = fp.width * S, lw = lp.width * S, rw = rp.width * S, h = fp.height * S;
  const ang = Math.PI / 4; // 45度（即135度展开角）

  // 正面面板
  const frontPanel = makePanel(fp.width, fp.height);
  frontPanel.position.set(0, 0, 0);
  root.add(frontPanel);

  // 左斜面板
  const leftPanel = makePanel(lp.width, lp.height);
  const leftContainer = placePanel(
    leftPanel,
    new THREE.Vector3(lw / 2, 0, 0),
    new THREE.Vector3(-fw / 2, 0, 0),
    ang
  );
  root.add(leftContainer);

  // 右斜面板
  const rightPanel = makePanel(rp.width, rp.height);
  const rightContainer = placePanel(
    rightPanel,
    new THREE.Vector3(-rw / 2, 0, 0),
    new THREE.Vector3(fw / 2, 0, 0),
    -ang
  );
  root.add(rightContainer);

  // 转角立柱
  const cmat = _cornerMat();
  const lcp = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), cmat);
  lcp.position.set(-fw / 2, 0, 0);
  lcp.castShadow = true;
  root.add(lcp);
  const rcp = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), cmat);
  rcp.position.set(fw / 2, 0, 0);
  rcp.castShadow = true;
  root.add(rcp);

  return root;
}

// ===== 矩形窗 =====
function buildRect(result: PhotoRecognitionResult): THREE.Group {
  const root = new THREE.Group();
  const p = result.panels[0];
  root.add(makePanel(p.width, p.height));
  return root;
}

// ===== 分发 =====
function buildWindowModel(result: PhotoRecognitionResult): THREE.Group {
  let model: THREE.Group;
  switch (result.windowType) {
    case 'l-shape': model = buildLShape(result); break;
    case 'u-shape': model = buildUShape(result); break;
    case 'bay-window': model = buildBay(result); break;
    default: model = buildRect(result); break;
  }

  // 用 wrapper 居中，不修改子对象的 position
  const wrapper = new THREE.Group();
  wrapper.add(model);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);

  return wrapper;
}

// ===== 标注 =====
function makeLabel(text: string, pos: THREE.Vector3): THREE.Sprite {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  c.width = 256; c.height = 64;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.beginPath(); ctx.roundRect(4, 4, 248, 56, 10); ctx.fill();
  ctx.font = 'bold 34px Arial';
  ctx.fillStyle = '#ff6b35';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sp.scale.set(0.35, 0.09, 1);
  sp.position.copy(pos);
  return sp;
}

function buildAnnotations(result: PhotoRecognitionResult): THREE.Group {
  const g = new THREE.Group();
  const lm = new THREE.LineBasicMaterial({ color: 0xff6b35, linewidth: 2 });

  const line = (a: THREE.Vector3, b: THREE.Vector3) =>
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), lm));
  const tick = (p: THREE.Vector3, ax: 'x' | 'y' | 'z') => {
    const a = p.clone(), b = p.clone();
    if (ax === 'x') { a.x -= 0.03; b.x += 0.03; }
    else if (ax === 'y') { a.y -= 0.03; b.y += 0.03; }
    else { a.z -= 0.03; b.z += 0.03; }
    line(a, b);
  };

  if (result.windowType === 'l-shape' && result.panels.length >= 2) {
    const fp = result.panels[0], sp = result.panels[1];
    const fw = fp.width * S, sw = sp.width * S, h = fp.height * S;

    // 正面宽度（底部，沿X轴，从 -fw 到 0）
    const by = -h / 2 - 0.1;
    line(new THREE.Vector3(-fw, by, 0), new THREE.Vector3(0, by, 0));
    tick(new THREE.Vector3(-fw, by, 0), 'y');
    tick(new THREE.Vector3(0, by, 0), 'y');
    g.add(makeLabel(`${fp.width}`, new THREE.Vector3(-fw / 2, by - 0.08, 0)));

    // 侧面宽度（底部，沿Z轴，从 0 到 -sw）
    line(new THREE.Vector3(0.08, by, 0), new THREE.Vector3(0.08, by, -sw));
    tick(new THREE.Vector3(0.08, by, 0), 'y');
    tick(new THREE.Vector3(0.08, by, -sw), 'y');
    g.add(makeLabel(`${sp.width}`, new THREE.Vector3(0.25, by - 0.08, -sw / 2)));

    // 高度
    const hx = 0.12;
    line(new THREE.Vector3(hx, -h / 2, 0), new THREE.Vector3(hx, h / 2, 0));
    tick(new THREE.Vector3(hx, -h / 2, 0), 'x');
    tick(new THREE.Vector3(hx, h / 2, 0), 'x');
    g.add(makeLabel(`${fp.height}`, new THREE.Vector3(hx + 0.22, 0, 0)));

  } else if (result.panels.length >= 1) {
    const p = result.panels[0];
    const w = p.width * S, h = p.height * S;
    const by = -h / 2 - 0.1;
    line(new THREE.Vector3(-w / 2, by, 0), new THREE.Vector3(w / 2, by, 0));
    tick(new THREE.Vector3(-w / 2, by, 0), 'y');
    tick(new THREE.Vector3(w / 2, by, 0), 'y');
    g.add(makeLabel(`${p.width}`, new THREE.Vector3(0, by - 0.08, 0)));

    const rx = w / 2 + 0.1;
    line(new THREE.Vector3(rx, -h / 2, 0), new THREE.Vector3(rx, h / 2, 0));
    tick(new THREE.Vector3(rx, -h / 2, 0), 'x');
    tick(new THREE.Vector3(rx, h / 2, 0), 'x');
    g.add(makeLabel(`${p.height}`, new THREE.Vector3(rx + 0.22, 0, 0)));
  }

  return g;
}

// ===== 主组件 =====

export default function PhotoFramePreview({ result, className }: PhotoFramePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animRef = useRef<number>(0);
  const modelRef = useRef<THREE.Group | null>(null);

  const [showGrid, setShowGrid] = useState(false);
  const [currentView, setCurrentView] = useState<ViewAngle>('perspective');

  // Init
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    const cam = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.01, 100);
    cam.position.set(2, 1.5, 3);
    cameraRef.current = cam;

    let ren: THREE.WebGLRenderer;
    try {
      ren = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      ren.setSize(el.clientWidth, el.clientHeight);
      ren.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      ren.shadowMap.enabled = true;
      ren.shadowMap.type = THREE.PCFSoftShadowMap;
      ren.toneMapping = THREE.ACESFilmicToneMapping;
      ren.toneMappingExposure = 1.2;
      el.appendChild(ren.domElement);
      rendererRef.current = ren;
    } catch { return; }

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.0);
    sun.position.set(3, 5, 4); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
    scene.add(new THREE.DirectionalLight(0xb0c4de, 0.4).translateX(-2).translateY(3).translateZ(-2));
    scene.add(new THREE.DirectionalLight(0xffffff, 0.2).translateZ(3).translateY(-2));

    const ctrl = new OrbitControls(cam, ren.domElement);
    ctrl.enableDamping = true; ctrl.dampingFactor = 0.05;
    ctrl.minDistance = 0.5; ctrl.maxDistance = 10;
    controlsRef.current = ctrl;

    const grid = new THREE.GridHelper(10, 20, 0x444466, 0x333355);
    grid.visible = false; grid.name = 'grid'; scene.add(grid);

    const animate = () => { animRef.current = requestAnimationFrame(animate); ctrl.update(); ren.render(scene, cam); };
    animate();

    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        if (width > 0 && height > 0) { cam.aspect = width / height; cam.updateProjectionMatrix(); ren.setSize(width, height); }
      }
    });
    ro.observe(el);

    return () => { ro.disconnect(); cancelAnimationFrame(animRef.current); ctrl.dispose(); ren.dispose(); if (el.contains(ren.domElement)) el.removeChild(ren.domElement); };
  }, []);

  // Update model
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !result) return;

    if (modelRef.current) { scene.remove(modelRef.current); modelRef.current = null; }

    const root = new THREE.Group();
    root.add(buildWindowModel(result));
    root.add(buildAnnotations(result));
    scene.add(root);
    modelRef.current = root;

    // Auto-fit
    const box = new THREE.Box3().setFromObject(root);
    const c = box.getCenter(new THREE.Vector3());
    const sz = box.getSize(new THREE.Vector3());
    const maxD = Math.max(sz.x, sz.y, sz.z);
    const fov = cameraRef.current!.fov * (Math.PI / 180);
    const dist = (maxD / (2 * Math.tan(fov / 2))) * 1.8;

    controlsRef.current?.target.copy(c);
    cameraRef.current?.position.set(c.x + dist * 0.5, c.y + dist * 0.35, c.z + dist * 0.8);
    cameraRef.current?.lookAt(c);
  }, [result]);

  useEffect(() => { const g = sceneRef.current?.getObjectByName('grid'); if (g) g.visible = showGrid; }, [showGrid]);

  const setView = useCallback((v: ViewAngle) => {
    if (!cameraRef.current || !controlsRef.current || !modelRef.current) return;
    const box = new THREE.Box3().setFromObject(modelRef.current);
    const c = box.getCenter(new THREE.Vector3());
    const d = Math.max(...box.getSize(new THREE.Vector3()).toArray()) * 2;
    controlsRef.current.target.copy(c);
    switch (v) {
      case 'front': cameraRef.current.position.set(c.x, c.y, c.z + d); break;
      case 'perspective': cameraRef.current.position.set(c.x + d * 0.5, c.y + d * 0.35, c.z + d * 0.8); break;
      case 'top': cameraRef.current.position.set(c.x, c.y + d, c.z + 0.01); break;
    }
    controlsRef.current.update();
    setCurrentView(v);
  }, []);

  return (
    <div className={`relative ${className || ''}`}>
      <div ref={containerRef} className="w-full h-full min-h-[300px]" />

      <div className="absolute top-3 right-3 flex flex-col gap-1.5">
        {([
          { icon: RotateCcw, action: () => setView('perspective'), active: false, tip: '重置视角' },
          { icon: Maximize2, action: () => setView('front'), active: currentView === 'front', tip: '正视图' },
          { icon: Box, action: () => setView('perspective'), active: currentView === 'perspective', tip: '透视图' },
          { icon: Eye, action: () => setView('top'), active: currentView === 'top', tip: '俯视图' },
          { icon: Grid3x3, action: () => setShowGrid(!showGrid), active: showGrid, tip: '网格' },
        ] as const).map(({ icon: Icon, action, active, tip }, i) => (
          <button key={i} onClick={action} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${active ? 'bg-amber-500/30 text-amber-400 ring-1 ring-amber-500/50' : 'bg-black/50 text-white/70 hover:text-white hover:bg-black/70'}`} title={tip}>
            <Icon size={14} />
          </button>
        ))}
      </div>

      {result && (
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium border border-amber-500/30">{result.windowTypeName}</span>
          <span className="px-2 py-1 rounded-lg bg-white/10 text-white/60 text-xs">置信度: {Math.round(result.confidence * 100)}%</span>
        </div>
      )}

      {!result && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white/40">
            <Box size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">上传照片后将生成3D框架预览</p>
          </div>
        </div>
      )}
    </div>
  );
}
