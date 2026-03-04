#!/usr/bin/env python3
"""
PRD 结构完整性校验脚本

用途：在每次 PRD 文档修改后运行，防止结构腐化再次发生。
可集成到 CI/CD 流水线中（如 GitHub Actions pre-commit hook）。

校验项：
1. 章节编号连续性（1-21）
2. 子章节位于正确的父章节内
3. 无重复子章节编号
4. 文档结束标记唯一且位于末尾
5. 结束标记后无多余内容
6. API 路径命名空间一致性
7. 版本号一致性（头部 vs 尾部）

退出码：
  0 = 全部通过
  1 = 存在校验失败项
"""

import re
import sys
from pathlib import Path

# 自动检测 PRD 文件路径
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
PRD_CANDIDATES = [
    REPO_ROOT / "docs" / "PRD_V6_Complete.md",
    REPO_ROOT / "docs" / "PRD_V5_Complete.md",
]

PRD_PATH = None
for candidate in PRD_CANDIDATES:
    if candidate.exists():
        PRD_PATH = candidate
        break

if PRD_PATH is None:
    print("[ERROR] 找不到 PRD 文件!")
    sys.exit(1)


def main():
    lines = PRD_PATH.read_text(encoding='utf-8').split('\n')
    total = len(lines)
    failures = []
    warnings = []

    print(f"=== PRD 结构完整性校验 ===")
    print(f"文件: {PRD_PATH}")
    print(f"总行数: {total}")
    print()

    # ========================================
    # 校验 1: 章节编号连续性
    # ========================================
    chapters = []
    for i, line in enumerate(lines):
        m = re.match(r'^## (\d+)\.', line)
        if m:
            chapters.append((int(m.group(1)), i + 1, line.strip()))

    expected = list(range(1, 22))
    actual = [c[0] for c in chapters]

    if actual == expected:
        print(f"[PASS] 校验1: 章节编号连续 (1-21, 共 {len(chapters)} 章)")
    else:
        missing = set(expected) - set(actual)
        extra = set(actual) - set(expected)
        msg = f"章节编号不连续: 缺失={missing}, 多余={extra}"
        print(f"[FAIL] 校验1: {msg}")
        failures.append(msg)

    # ========================================
    # 校验 2: 子章节位于正确的父章节内
    # ========================================
    chapter_ranges = {}
    for idx, (ch_num, ch_line, _) in enumerate(chapters):
        if idx + 1 < len(chapters):
            chapter_ranges[ch_num] = (ch_line, chapters[idx + 1][1])
        else:
            chapter_ranges[ch_num] = (ch_line, total + 1)

    misplaced = []
    for i, line in enumerate(lines):
        m = re.match(r'^### (\d+)\.(\d+)', line)
        if m:
            parent_ch = int(m.group(1))
            sub_num = m.group(2)
            if parent_ch in chapter_ranges:
                ch_start, ch_end = chapter_ranges[parent_ch]
                if not (ch_start <= i + 1 < ch_end):
                    misplaced.append(f"  {parent_ch}.{sub_num} 在行 {i+1}，但第{parent_ch}章范围是 {ch_start}-{ch_end}")

    if not misplaced:
        print(f"[PASS] 校验2: 所有子章节均位于正确的父章节内")
    else:
        msg = f"发现 {len(misplaced)} 个错位子章节:\n" + "\n".join(misplaced)
        print(f"[FAIL] 校验2: {msg}")
        failures.append(msg)

    # ========================================
    # 校验 3: 无重复子章节编号
    # ========================================
    subsections = {}
    duplicates = []
    for i, line in enumerate(lines):
        m = re.match(r'^### (\d+\.\d+)', line)
        if m:
            key = m.group(1)
            if key in subsections:
                duplicates.append(f"  {key} 在行 {subsections[key]+1} 和 {i+1}")
            subsections[key] = i

    if not duplicates:
        print(f"[PASS] 校验3: 无重复子章节编号 (共 {len(subsections)} 个子章节)")
    else:
        msg = f"发现 {len(duplicates)} 个重复子章节:\n" + "\n".join(duplicates)
        print(f"[FAIL] 校验3: {msg}")
        failures.append(msg)

    # ========================================
    # 校验 4: 文档结束标记唯一且位于末尾
    # ========================================
    end_markers = []
    for i, line in enumerate(lines):
        if re.search(r'\*\*文档版本：V\d+\.\d+[^*]*\*\*', line):
            end_markers.append((i + 1, line.strip()))

    if len(end_markers) == 1:
        marker_line = end_markers[0][0]
        # 检查是否在文档最后 20 行内
        if marker_line > total - 20:
            print(f"[PASS] 校验4: 结束标记唯一且位于末尾 (行 {marker_line})")
        else:
            msg = f"结束标记在行 {marker_line}，但文档共 {total} 行，标记不在末尾区域"
            print(f"[FAIL] 校验4: {msg}")
            failures.append(msg)
    elif len(end_markers) == 0:
        msg = "找不到文档结束标记"
        print(f"[FAIL] 校验4: {msg}")
        failures.append(msg)
    else:
        msg = f"发现 {len(end_markers)} 个结束标记:\n" + "\n".join(f"  行 {m[0]}: {m[1]}" for m in end_markers)
        print(f"[FAIL] 校验4: {msg}")
        failures.append(msg)

    # ========================================
    # 校验 5: 结束标记后无多余内容
    # ========================================
    if end_markers:
        last_marker_line = end_markers[-1][0]
        remaining = [
            (i + 1, l) for i, l in enumerate(lines[last_marker_line:], start=last_marker_line)
            if l.strip() and not l.startswith('**') and l.strip() != '---' and not l.strip().startswith('*—')
        ]
        if not remaining:
            print(f"[PASS] 校验5: 结束标记后无多余内容")
        else:
            msg = f"结束标记后有 {len(remaining)} 行多余内容"
            print(f"[FAIL] 校验5: {msg}")
            for line_num, content in remaining[:5]:
                print(f"  行 {line_num}: {content[:80]}")
            failures.append(msg)

    # ========================================
    # 校验 6: API 路径命名空间一致性
    # ========================================
    api_issues = []
    for i, line in enumerate(lines):
        # 检查供应商路径
        if re.search(r'`/api/v1/suppliers', line):
            api_issues.append(f"  行 {i+1}: 供应商路径应使用 /api/v1/procurement/suppliers")
        # 检查质检路径
        if re.search(r'`/api/v1/qc-inspections', line):
            api_issues.append(f"  行 {i+1}: 质检路径应使用 /api/v1/qc/inspections")
        # 检查采购订单路径
        if re.search(r'`/api/v1/purchase-orders', line):
            api_issues.append(f"  行 {i+1}: 采购路径应使用 /api/v1/procurement/purchase-orders")

    if not api_issues:
        print(f"[PASS] 校验6: API 路径命名空间一致")
    else:
        msg = f"发现 {len(api_issues)} 个 API 路径不一致:\n" + "\n".join(api_issues)
        print(f"[WARN] 校验6: {msg}")
        warnings.append(msg)

    # ========================================
    # 校验 7: 版本号一致性
    # ========================================
    header_version = None
    footer_version = None
    for line in lines[:10]:
        m = re.search(r'V(\d+\.\d+)', line)
        if m:
            header_version = m.group(1)
    for line in lines[-15:]:
        m = re.search(r'V(\d+\.\d+)', line)
        if m:
            footer_version = m.group(1)

    if header_version and footer_version:
        if header_version == footer_version:
            print(f"[PASS] 校验7: 版本号一致 (V{header_version})")
        else:
            msg = f"版本号不一致: 头部 V{header_version}, 尾部 V{footer_version}"
            print(f"[FAIL] 校验7: {msg}")
            failures.append(msg)
    else:
        msg = f"无法提取版本号: 头部={header_version}, 尾部={footer_version}"
        print(f"[WARN] 校验7: {msg}")
        warnings.append(msg)

    # ========================================
    # 汇总
    # ========================================
    print()
    print(f"=== 校验汇总 ===")
    print(f"通过: {7 - len(failures) - len(warnings)} 项")
    print(f"失败: {len(failures)} 项")
    print(f"警告: {len(warnings)} 项")

    if failures:
        print(f"\n[EXIT] 存在 {len(failures)} 个校验失败项，退出码 1")
        sys.exit(1)
    else:
        print(f"\n[EXIT] 全部通过，退出码 0")
        sys.exit(0)


if __name__ == '__main__':
    main()
