// WindoorDesigner - 预置型材系列数据
import type { ProfileSeries } from '../types/design';

export const DEFAULT_PROFILE_SERIES: ProfileSeries[] = [
  { id: 'series-60', name: '60系列', frameWidth: 60, sashWidth: 55, mullionWidth: 60, frameDepth: 60, sashDepth: 50, mullionDepth: 60, color: '#8B8B8B' },
  { id: 'series-65', name: '65系列', frameWidth: 65, sashWidth: 60, mullionWidth: 65, frameDepth: 65, sashDepth: 55, mullionDepth: 65, color: '#A0A0A0' },
  { id: 'series-70', name: '70系列', frameWidth: 70, sashWidth: 65, mullionWidth: 70, frameDepth: 70, sashDepth: 55, mullionDepth: 70, color: '#B0B0B0' },
  { id: 'series-80', name: '80系列', frameWidth: 80, sashWidth: 72, mullionWidth: 80, frameDepth: 80, sashDepth: 60, mullionDepth: 80, color: '#C0C0C0' },
  { id: 'series-85', name: '85系列', frameWidth: 85, sashWidth: 78, mullionWidth: 85, frameDepth: 85, sashDepth: 65, mullionDepth: 85, color: '#D0D0D0' },
];
