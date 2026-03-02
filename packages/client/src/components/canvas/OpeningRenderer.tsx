// WindoorDesigner - 递归渲染 Opening 树组件
// 核心递归组件：根据 Opening 数据递归渲染玻璃、中梃和扇标记

import { Group } from 'react-konva';
import type { Opening } from '@windoor/shared';
import GlassRenderer from './GlassRenderer';
import MullionRenderer from './MullionRenderer';
import SashRenderer from './SashRenderer';

interface OpeningRendererProps {
  opening: Opening;
  zoom: number;
  selectedElementId: string | null;
  hoveredOpeningId?: string | null;
}

/** 递归渲染 Opening 及其子节点 */
export default function OpeningRenderer({
  opening,
  zoom,
  selectedElementId,
  hoveredOpeningId,
}: OpeningRendererProps) {
  // 如果有子 Opening（已分割），递归渲染
  if (opening.isSplit && opening.childOpenings.length > 0) {
    return (
      <Group>
        {/* 渲染中梃 */}
        {opening.mullions.map((mullion) => (
          <MullionRenderer
            key={mullion.id}
            mullion={mullion}
            parentRect={opening.rect}
            zoom={zoom}
            isSelected={selectedElementId === mullion.id}
          />
        ))}

        {/* 递归渲染子 Opening */}
        {opening.childOpenings.map((child) => (
          <OpeningRenderer
            key={child.id}
            opening={child}
            zoom={zoom}
            selectedElementId={selectedElementId}
            hoveredOpeningId={hoveredOpeningId}
          />
        ))}
      </Group>
    );
  }

  // 叶子节点：渲染玻璃和扇
  const isHovered = hoveredOpeningId === opening.id;

  return (
    <Group>
      {/* 渲染玻璃区域 */}
      <GlassRenderer
        rect={opening.rect}
        zoom={zoom}
        isHovered={isHovered}
      />

      {/* 渲染扇标记 */}
      {opening.sash && (
        <SashRenderer
          sash={opening.sash}
          zoom={zoom}
          isSelected={selectedElementId === opening.sash.id}
        />
      )}
    </Group>
  );
}
