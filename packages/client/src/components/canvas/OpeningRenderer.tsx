// WindoorDesigner - 递归渲染 Opening 树组件
// 核心递归组件：根据 Opening 数据递归渲染玻璃、中梃、扇框、扇标记和分格标签

import { Group, Text } from 'react-konva';
import type { Opening, Sash } from '@windoor/shared';
import GlassRenderer from './GlassRenderer';
import MullionRenderer from './MullionRenderer';
import SashRenderer from './SashRenderer';
import SashFrameRenderer from './SashFrameRenderer';

interface OpeningRendererProps {
  opening: Opening;
  zoom: number;
  selectedElementId: string | null;
  hoveredOpeningId?: string | null;
  /** 叶子节点计数器（用于生成标签） */
  leafCounter?: { value: number };
}

const MM_TO_PX = 0.5;

/** 获取扇类型的标签前缀 */
function getSashLabel(sash: Sash | null): string {
  if (!sash) return 'F'; // 无扇 = 固定玻璃
  switch (sash.type) {
    case 'fixed':
      return 'F'; // Fixed
    case 'casement-left':
    case 'casement-right':
    case 'casement-out-left':
    case 'casement-out-right':
      return 'A'; // 平开扇
    case 'casement-top':
    case 'casement-bottom':
      return 'A'; // 悬窗扇
    case 'tilt-turn-left':
    case 'tilt-turn-right':
      return 'A'; // 内开内倒
    case 'sliding-left':
    case 'sliding-right':
      return 'S'; // 推拉扇
    case 'folding-left':
    case 'folding-right':
      return 'Z'; // 折叠扇
    default:
      return 'F';
  }
}

/** 获取扇类型的中文说明 */
function getSashDescription(sash: Sash | null): string {
  if (!sash) return '固定';
  switch (sash.type) {
    case 'fixed': return '固定';
    case 'casement-left': return '内开左';
    case 'casement-right': return '内开右';
    case 'casement-out-left': return '外开左';
    case 'casement-out-right': return '外开右';
    case 'casement-top': return '上悬';
    case 'casement-bottom': return '下悬';
    case 'tilt-turn-left': return '内倒左';
    case 'tilt-turn-right': return '内倒右';
    case 'sliding-left': return '左推';
    case 'sliding-right': return '右推';
    case 'folding-left': return '折叠左';
    case 'folding-right': return '折叠右';
    default: return '';
  }
}

/** 判断是否为开启扇（非固定扇） */
function isOpenableSash(sash: Sash | null): boolean {
  if (!sash) return false;
  return sash.type !== 'fixed';
}

/** 收集所有叶子节点并按类型分组编号 */
function collectLeafLabels(opening: Opening): Map<string, { opening: Opening; label: string }> {
  const result = new Map<string, { opening: Opening; label: string }>();
  const counters: Record<string, number> = {};

  function traverse(op: Opening) {
    if (op.isSplit && op.childOpenings.length > 0) {
      op.childOpenings.forEach(child => traverse(child));
    } else {
      const prefix = getSashLabel(op.sash);
      counters[prefix] = (counters[prefix] || 0) + 1;
      result.set(op.id, {
        opening: op,
        label: `${prefix}${counters[prefix]}`,
      });
    }
  }

  traverse(opening);
  return result;
}

/** 渲染分格标签 */
function OpeningLabel({
  opening,
  label,
  zoom,
}: {
  opening: Opening;
  label: string;
  zoom: number;
}) {
  const scale = MM_TO_PX * zoom;
  const x = opening.rect.x * scale;
  const y = opening.rect.y * scale;
  const w = opening.rect.width * scale;
  const h = opening.rect.height * scale;

  const desc = getSashDescription(opening.sash);
  const fontSize = Math.max(10, Math.min(16, 13 * zoom));

  return (
    <Group>
      {/* 分格标签 (如 F1, A1) */}
      <Text
        x={x}
        y={y + h * 0.3}
        width={w}
        text={label}
        fontSize={fontSize * 1.1}
        fontFamily="Arial, sans-serif"
        fontStyle="bold"
        fill="rgba(0, 60, 120, 0.65)"
        align="center"
        listening={false}
      />
      {/* 扇类型说明 */}
      <Text
        x={x}
        y={y + h * 0.3 + fontSize * 1.4}
        width={w}
        text={desc}
        fontSize={fontSize * 0.8}
        fontFamily="Arial, sans-serif"
        fill="rgba(0, 60, 120, 0.45)"
        align="center"
        listening={false}
      />
    </Group>
  );
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
    // 收集所有叶子节点的标签
    const leafLabels = collectLeafLabels(opening);

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

        {/* 渲染叶子节点的标签 */}
        {Array.from(leafLabels.entries()).map(([id, { opening: op, label }]) => (
          <OpeningLabel
            key={`label-${id}`}
            opening={op}
            label={label}
            zoom={zoom}
          />
        ))}
      </Group>
    );
  }

  // 叶子节点：渲染玻璃、扇框和扇标记
  const isHovered = hoveredOpeningId === opening.id;
  const hasSash = isOpenableSash(opening.sash);
  const sashProfileWidth = opening.sash?.profileWidth || 0;

  // 单个分格（无分割）也需要标签
  const singleLabel = getSashLabel(opening.sash) + '1';

  return (
    <Group>
      {/* 渲染扇框（开启扇才有） */}
      {hasSash && opening.sash && (
        <SashFrameRenderer
          sash={opening.sash}
          zoom={zoom}
          isSelected={selectedElementId === opening.sash.id}
        />
      )}

      {/* 渲染玻璃区域（含玻璃压线框） */}
      <GlassRenderer
        rect={opening.rect}
        zoom={zoom}
        isHovered={isHovered}
        hasSashFrame={hasSash}
        sashProfileWidth={sashProfileWidth}
      />

      {/* 渲染扇标记（开启方向线条 + 把手） */}
      {opening.sash && (
        <SashRenderer
          sash={opening.sash}
          zoom={zoom}
          isSelected={selectedElementId === opening.sash.id}
        />
      )}

      {/* 分格标签 */}
      <OpeningLabel
        opening={opening}
        label={singleLabel}
        zoom={zoom}
      />
    </Group>
  );
}
