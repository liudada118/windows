import { Formula, ProfileFormula, GlassFormula, AddonFormula } from '../../types/formula';

const profiles: ProfileFormula[] = [
  // --- 框/梃 (bar) ---
  { name: '108外框', type: 'frame', length: 'cc', count: '1' },
  { name: '108中梃', type: 'mullion', length: 'cc-40-40+5+5', count: '1', connection: 'frame-frame', note: '减两个外框小面40，再加上端铣量5' },
  { name: '108中梃', type: 'mullion', length: 'cc-40-20+5+5', count: '1', connection: 'frame-mullion', note: '减一个外框小面40，减中梃一半20，再加上端铣量5' },
  { name: '108中梃', type: 'mullion', length: 'cc-20-20+5+5', count: '1', connection: 'mullion-mullion', note: '减两个中梃一半20，再加上端铣量5' },
  { name: '108附框', type: 'sashTurningFrame', length: 'cc-40-40', count: '1', connection: 'frame-frame' },
  { name: '108附框', type: 'sashTurningFrame', length: 'cc-40-20', count: '1', connection: 'frame-mullion' },
  { name: '108附框', type: 'sashTurningFrame', length: 'cc-20-20', count: '1', connection: 'mullion-mullion' },
  { name: '108压线', type: 'fixedBead', length: 'cc-40-40-overlap*22', count: '1', connection: 'frame-frame', note: '搭接数overlap, 22为压线宽' },
  { name: '108压线', type: 'fixedBead', length: 'cc-40-20-overlap*22', count: '1', connection: 'frame-mullion' },
  { name: '108压线', type: 'fixedBead', length: 'cc-20-20-overlap*22', count: '1', connection: 'mullion-mullion' },
  { name: '108转角', type: 'cornerJoiner', length: 'cc', count: '1' },

  // --- 开启扇 (sash) ---
  { name: '108扇', type: 'sash', length: 'cc', count: '1', note: '扇尺寸计算在下' },
  { name: '108纱扇', type: 'screen', length: 'cc', count: '1' },
  { name: '108防盗框', type: 'antiTheft', length: 'cc', count: '1' },
  { name: '108防盗杆', type: 'antitheftMullion', length: 'cc-20-20', count: '1', connection: 'frame-frame' },
  { name: '108防盗杆', type: 'antitheftMullion', length: 'cc-20-10', count: '1', connection: 'frame-mullion' },
  { name: '108防盗杆', type: 'antitheftMullion', length: 'cc-10-10', count: '1', connection: 'mullion-mullion' },
  { name: '108压线', type: 'sashBead', length: 'cc-54-54-22-22', count: '1', position: ['up', 'down'], note: '横压线, 减扇小面54, 压线竖通再减压线宽22' },
  { name: '108压线', type: 'sashBead', length: 'cc-54-54', count: '1', position: ['left', 'right'], note: '竖压线, 减扇小面54' },

  // --- 双开扇 (doubleSash) ---
  { name: '108扇', type: 'sash', length: '(cc-10)/2', count: '2', connection: 'double', note: '对开扇总宽减中间缝隙10再除2' },
  { name: '108假中梃', type: 'mullionOnDouble', length: 'cc', count: '1', position: ['right'] },
];

const glass: GlassFormula[] = [
  { name: '固玻', type: 'fixedGlass', width: 'cc-40-40-6', height: 'cc-40-40-6', connection: 'frame-frame', note: '减外框小面40, 减垫块缝隙6' },
  { name: '固玻', type: 'fixedGlass', width: 'cc-40-20-6', height: 'cc-40-20-6', connection: 'frame-mullion' },
  { name: '固玻', type: 'fixedGlass', width: 'cc-20-20-6', height: 'cc-20-20-6', connection: 'mullion-mullion' },
  { name: '扇玻', type: 'sashGlass', width: 'cc-70-6', height: 'cc-70-6', note: '减扇料小面70, 减垫块缝隙6' },
];

const addons: AddonFormula[] = [
  { name: '螺丝3.0X19mm', count: '(frame_width*2+frame_height*2)/500', category: 'bar' },
  { name: '玻璃胶', count: '(((frame_width*4+frame_height*4)/10)*.7*.7)/300', category: 'bar' },
  { name: '外框胶条3mm', count: 'glass_perimeter/1000', category: 'bar' },
  { name: '压线胶条4mm', count: 'glass_perimeter/1000', category: 'bar' },
  { name: '扇胶条', count: '(sash_perimeter/1000)*2', category: 'sash', note: '内外各一圈' },
  { name: '螺丝3.9X19mm', count: 'sash_perimeter/500', category: 'sash' },
  { name: '扇执手', count: '1', category: 'sash' },
];

export const casement108: Formula = {
  name: '108平开系列',
  profiles,
  glass,
  addons,
  parameters: {
    frame: 60,
    frameMullion: 90,
    sash: 60,
    bead: 15,
    screen: 60,
    antiTheft: 24,
    antiTheftMullion: 45,
    millingFrame: 5,
    millingSash: 5,
    glassGap: 6,
    cornerJoiner: 100,
    subFrame: 24,
    innerFrame: 45,
    sashMullion: 60,
    decorationBar: 20,
    doorBeam: 100,
    sashHolder: 100,
    angleLength: 200,
    // 自定义参数
    frameFace: 40, // 外框小面
    mullionHalf: 20, // 中梃一半
    sashOverlap: 7, // 扇重叠量
    sashFace: 54, // 扇小面（用于压线）
    sashFaceForGlass: 70, // 扇小面（用于玻璃）
    beadWidth: 22, // 压线宽度
    doubleSashGap: 10, // 对开扇中间缝隙
  },
  pricing: [
    { name: '平方', price: 1250, type: 'area', scope: 'all', minArea: 2.0 },
    { name: '开启', price: 1000, type: 'sash', scope: 'per' },
    { name: '大玻璃', price: 'material_price', type: 'glass', scope: 'per', condition: 'area > 2.5' },
    { name: '转角', price: 300, type: 'corner', scope: 'per' },
  ]
};
