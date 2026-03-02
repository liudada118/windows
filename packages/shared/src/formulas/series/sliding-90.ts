import { Formula, ProfileFormula, GlassFormula, AddonFormula } from '../../types/formula';

const profiles: ProfileFormula[] = [
  // --- 框/梃 (bar) ---
  { name: '90上滑', type: 'upTrack', length: 'cc', count: '1' },
  { name: '90下滑', type: 'downTrack', length: 'cc', count: '1' },
  { name: '90边封', type: 'frame', length: 'cc', count: '2', position: ['left', 'right'] },
  { name: '90中柱', type: 'mullion', length: 'cc-upTrackHeight-downTrackHeight', count: '1' },

  // --- 扇 (sash) ---
  { name: '90光企', type: 'sash', length: 'cc-upTrackHeight-downTrackHeight', count: 'sashCount' },
  { name: '90勾企', type: 'sash', length: 'cc-upTrackHeight-downTrackHeight', count: 'sashCount' },
  { name: '90上横', type: 'sash', length: '(cc-frameWidth*2+interlock* (sashCount-1))/sashCount', count: 'sashCount' },
  { name: '90下横', type: 'sash', length: '(cc-frameWidth*2+interlock* (sashCount-1))/sashCount', count: 'sashCount' },
];

const glass: GlassFormula[] = [
  { name: '推拉扇玻璃', type: 'sashGlass', width: 'sashWidth-sashProfileWidth*2-glassGap', height: 'sashHeight-sashProfileHeight*2-glassGap' },
];

const addons: AddonFormula[] = [
  { name: '滑轮', count: 'sashCount*2', category: 'sash' },
  { name: '锁勾', count: 'sashCount', category: 'sash' },
  { name: '防撞块', count: 'sashCount*2', category: 'sash' },
  { name: '密封毛条', count: 'perimeter*4', category: 'sash' },
];

export const sliding90: Formula = {
  name: '90推拉系列',
  profiles,
  glass,
  addons,
  parameters: {
    upTrackHeight: 40,
    downTrackHeight: 50,
    frameWidth: 35,
    sashProfileWidth: 80, // 上下横
    sashProfileHeight: 50, // 光企/勾企
    interlock: 30, // 勾企重叠
    glassGap: 6,
  },
  pricing: [
    { name: '平方', price: 800, type: 'area', scope: 'all', minArea: 1.5 },
    { name: '轨道', price: 150, type: 'track', scope: 'per_meter' },
  ]
};
