// WindoorDesigner - 拍照识别 3D 框架预览组件
// v6: 修正面板拼接算法 - 使用绝对角度 + 链式边缘追踪

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { PhotoRecognitionResult, RecognizedPanel } from '@/lib/photoRecognition';
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

// ===== 创建单个面板 =====
// 面板居中在原点，宽度沿X，高度沿Y，深度沿Z
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

// ===== 链式边缘追踪算法 =====
// 
// 核心思想：
// - 每个面板的 angle 是绝对角度（相对于正前方Z+方向的法线偏转）
// - angle=0: 面板沿X轴展开，法线朝Z+（正前方）
// - angle=90: 面板沿Z轴展开，法线朝X+（右方）
// - angle=-90: 面板沿Z轴展开，法线朝X-（左方）
// - angle=45: 面板斜45度，法线朝右前方
//
// Three.js 中 rotation.y 是绕Y轴旋转
// rotY = angle * PI / 180
// 旋转后面板的"右方向"（局部X+经过Y轴旋转）：
//   rightDir = (cos(rotY), 0, -sin(rotY))
//
// 拼接方式：
// 1. 基准面板(angle=0)居中放置
// 2. 向右拼接：从基准右边缘开始，每个面板的左边缘连接到前一个面板的右边缘
// 3. 向左拼接：从基准左边缘开始，每个面板的右边缘连接到前一个面板的左边缘

function buildDynamic(result: PhotoRecognitionResult): THREE.Group {
  const root = new THREE.Group();
  const panels = result.panels;

  if (panels.length === 0) return root;

  // 单面板 - 直接居中
  if (panels.length === 1) {
    root.add(makePanel(panels[0].width, panels[0].height));
    return root;
  }

  // 多面板 - 找到基准面板（angle=0 的面板）
  let baseIdx = panels.findIndex(p => p.angle === 0);
  if (baseIdx < 0) baseIdx = Math.floor(panels.length / 2); // 取中间

  const leftPanels = panels.slice(0, baseIdx).reverse(); // 从基准向左
  const rightPanels = panels.slice(baseIdx + 1);          // 从基准向右
  const basePanel = panels[baseIdx];

  const h = basePanel.height * S;
  const cmat = _cornerMat();

  // 放置基准面板
  root.add(makePanel(basePanel.width, basePanel.height));

  // === 向右侧拼接面板 ===
  let jointX = (basePanel.width * S) / 2;
  let jointZ = 0;

  for (let i = 0; i < rightPanels.length; i++) {
    const sp = rightPanels[i];
    const rotY = (sp.angle * Math.PI) / 180;
    const halfW = (sp.width * S) / 2;

    // 面板旋转后的右方向
    const rdx = Math.cos(rotY);
    const rdz = -Math.sin(rotY);

    // 面板中心 = 连接点(左边缘) + 右方向 * halfW
    const cx = jointX + rdx * halfW;
    const cz = jointZ + rdz * halfW;

    const panelMesh = makePanel(sp.width, sp.height);
    const container = new THREE.Group();
    container.add(panelMesh);
    container.rotation.y = rotY;
    container.position.set(cx, 0, cz);
    root.add(container);

    // 转角立柱
    const cp = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), cmat);
    cp.position.set(jointX, 0, jointZ);
    cp.castShadow = true;
    root.add(cp);

    // 更新连接点到面板右边缘
    jointX = cx + rdx * halfW;
    jointZ = cz + rdz * halfW;
  }

  // === 向左侧拼接面板 ===
  jointX = -(basePanel.width * S) / 2;
  jointZ = 0;

  for (let i = 0; i < leftPanels.length; i++) {
    const sp = leftPanels[i];
    const rotY = (sp.angle * Math.PI) / 180;
    const halfW = (sp.width * S) / 2;

    // 面板旋转后的右方向
    const rdx = Math.cos(rotY);
    const rdz = -Math.sin(rotY);

    // 面板中心 = 连接点(右边缘) - 右方向 * halfW
    const cx = jointX - rdx * halfW;
    const cz = jointZ - rdz * halfW;

    const panelMesh = makePanel(sp.width, sp.height);
    const container = new THREE.Group();
    container.add(panelMesh);
    container.rotation.y = rotY;
    container.position.set(cx, 0, cz);
    root.add(container);

    // 转角立柱
    const cp = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), cmat);
    cp.position.set(jointX, 0, jointZ);
    cp.castShadow = true;
    root.add(cp);

    // 更新连接点到面板左边缘
    jointX = cx - rdx * halfW;
    jointZ = cz - rdz * halfW;
  }

  return root;
}

// ===== 分发 =====
function buildWindowModel(result: PhotoRecognitionResult): THREE.Group {
  const model = buildDynamic(result);

  // 用 wrapper 居中
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

// 通用标注引擎 - 使用与 buildDynamic 相同的链式边缘追踪算法
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

  const panels = result.panels;
  if (panels.length === 0) return g;

  let baseIdx = panels.findIndex(p => p.angle === 0);
  if (baseIdx < 0) baseIdx = Math.floor(panels.length / 2);
  const basePanel = panels[baseIdx];
  const h = basePanel.height * S;

  // 基准面板宽度标注（底部）
  const bw = basePanel.width * S;
  const by = -h / 2 - 0.1;
  line(new THREE.Vector3(-bw / 2, by, 0), new THREE.Vector3(bw / 2, by, 0));
  tick(new THREE.Vector3(-bw / 2, by, 0), 'y');
  tick(new THREE.Vector3(bw / 2, by, 0), 'y');
  g.add(makeLabel(`${basePanel.width}`, new THREE.Vector3(0, by - 0.08, 0)));

  // 高度标注（右侧）
  const rightPanels = panels.slice(baseIdx + 1);
  const hx = (bw / 2) + (rightPanels.length > 0 ? 0.12 : 0.1);
  line(new THREE.Vector3(hx, -h / 2, 0), new THREE.Vector3(hx, h / 2, 0));
  tick(new THREE.Vector3(hx, -h / 2, 0), 'x');
  tick(new THREE.Vector3(hx, h / 2, 0), 'x');
  g.add(makeLabel(`${basePanel.height}`, new THREE.Vector3(hx + 0.22, 0, 0)));

  // 右侧面板标注
  let jointX = bw / 2;
  let jointZ = 0;

  for (const sp of rightPanels) {
    const rotY = (sp.angle * Math.PI) / 180;
    const halfW = (sp.width * S) / 2;
    const rdx = Math.cos(rotY);
    const rdz = -Math.sin(rotY);

    const cx = jointX + rdx * halfW;
    const cz = jointZ + rdz * halfW;
    const endX = cx + rdx * halfW;
    const endZ = cz + rdz * halfW;

    const startPt = new THREE.Vector3(jointX, by, jointZ);
    const endPt = new THREE.Vector3(endX, by, endZ);
    const midPt = new THREE.Vector3(cx, by - 0.08, cz);

    line(startPt, endPt);
    tick(startPt, 'y');
    tick(endPt, 'y');
    g.add(makeLabel(`${sp.width}`, midPt));

    jointX = endX;
    jointZ = endZ;
  }

  // 左侧面板标注
  const leftPanels = panels.slice(0, baseIdx).reverse();
  jointX = -bw / 2;
  jointZ = 0;

  for (const sp of leftPanels) {
    const rotY = (sp.angle * Math.PI) / 180;
    const halfW = (sp.width * S) / 2;
    const rdx = Math.cos(rotY);
    const rdz = -Math.sin(rotY);

    const cx = jointX - rdx * halfW;
    const cz = jointZ - rdz * halfW;
    const endX = cx - rdx * halfW;
    const endZ = cz - rdz * halfW;

    const startPt = new THREE.Vector3(jointX, by, jointZ);
    const endPt = new THREE.Vector3(endX, by, endZ);
    const midPt = new THREE.Vector3(cx, by - 0.08, cz);

    line(startPt, endPt);
    tick(startPt, 'y');
    tick(endPt, 'y');
    g.add(makeLabel(`${sp.width}`, midPt));

    jointX = endX;
    jointZ = endZ;
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
