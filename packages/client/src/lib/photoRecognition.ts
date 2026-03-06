// WindoorDesigner - 拍照识别窗型服务
// 使用 OpenAI Vision API 分析实景照片，识别窗户类型和尺寸
// 支持 L形窗、U形窗、凸窗、普通矩形窗等

import type { CompositeWindowType } from './types';

// ===== 识别结果类型 =====

export interface RecognizedDimension {
  label: string;       // 标注名称，如 "左侧面宽度"
  value: number;       // 尺寸值 (mm)
  side: string;        // 所属面: 'left' | 'front' | 'right' | 'top' | 'bottom'
}

export interface RecognizedPanel {
  label: string;       // 面板标签: '左侧面', '正面', '右侧面' 等
  width: number;       // 面板宽度 (mm)
  height: number;      // 面板高度 (mm)
  angle: number;       // 相对角度 (度)
}

export interface PhotoRecognitionResult {
  // 窗型识别
  windowType: 'rectangle' | 'l-shape' | 'u-shape' | 'bay-window';
  windowTypeName: string;   // 中文名称
  compositeType?: CompositeWindowType;
  confidence: number;       // 置信度 0-1

  // 尺寸信息
  dimensions: RecognizedDimension[];
  panels: RecognizedPanel[];

  // 整体尺寸
  totalWidth: number;       // 总宽 (mm)
  totalHeight: number;      // 总高 (mm)

  // 额外信息
  description: string;      // AI描述
  suggestions: string[];    // 建议
  
  // 分格信息
  panelCount: number;       // 每面的分格数
  sashTypes: string[];      // 建议的开启方式
}

// ===== AI 识别 Prompt =====

const SYSTEM_PROMPT = `你是一个专业的门窗测量分析师。用户会上传门窗的实景照片（可能带有手写或标注的尺寸数字）。

你的任务是：
1. 识别窗户的类型（矩形窗、L形窗、U形窗、凸窗/飘窗）
2. 从照片中读取标注的尺寸数字（单位：mm）
3. 分析窗户的各个面板（正面、左侧面、右侧面等）
4. 推断每个面板的宽度和高度

窗型定义：
- 矩形窗 (rectangle): 单面平面窗户
- L形窗 (l-shape): 两面相交成90度角的窗户（通常在墙角）
- U形窗 (u-shape): 三面围合的窗户（正面+左侧面+右侧面）
- 凸窗/飘窗 (bay-window): 向外凸出的窗户，通常有3面或5面，侧面有角度

请以严格的 JSON 格式返回分析结果，不要包含任何其他文字：

{
  "windowType": "rectangle" | "l-shape" | "u-shape" | "bay-window",
  "windowTypeName": "中文窗型名称",
  "confidence": 0.0-1.0,
  "description": "对窗户的描述",
  "totalWidth": 总宽mm,
  "totalHeight": 总高mm,
  "panels": [
    {
      "label": "面板名称（如：正面、左侧面、右侧面）",
      "width": 宽度mm,
      "height": 高度mm,
      "angle": 相对前一面板的角度（正面=0，左侧=-90，右侧=90，凸窗侧面可能是-135或135等）
    }
  ],
  "dimensions": [
    {
      "label": "尺寸标注名称",
      "value": 数值mm,
      "side": "left|front|right|top|bottom"
    }
  ],
  "panelCount": 每面建议的分格数,
  "sashTypes": ["建议的开启方式，如 casement-left, fixed, sliding-right 等"],
  "suggestions": ["测量建议或注意事项"]
}

注意：
- 如果照片中有标注数字，优先使用标注的数字作为尺寸
- 如果没有标注，根据照片中的参照物（如人、门框等）估算尺寸
- 尺寸单位统一为毫米(mm)
- 高度如果照片中未标注，可以根据常见窗户高度估算（通常1200-1800mm）
- 对于L形窗，通常有2个面板；U形窗有3个面板；凸窗有3-5个面板`;

// ===== 图片转 Base64 =====

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 提取 base64 部分 (去掉 data:image/xxx;base64, 前缀)
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ===== 调用 AI 识别 =====

export async function recognizeWindowFromPhoto(
  imageBase64: string,
  apiKey: string,
  mimeType: string = 'image/jpeg'
): Promise<PhotoRecognitionResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '请分析这张门窗实景照片，识别窗户类型和尺寸。如果照片中有标注的数字，请读取它们作为尺寸数据。',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`AI识别失败: ${response.status} ${errorData?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('AI未返回有效结果');
  }

  // 解析 JSON 结果
  try {
    // 尝试提取 JSON（AI可能会在JSON前后添加文字）
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法从AI响应中提取JSON');
    }

    const result = JSON.parse(jsonMatch[0]);

    // 构建标准化结果
    return {
      windowType: result.windowType || 'rectangle',
      windowTypeName: result.windowTypeName || '矩形窗',
      compositeType: mapToCompositeType(result.windowType),
      confidence: result.confidence || 0.5,
      dimensions: (result.dimensions || []).map((d: any) => ({
        label: d.label || '',
        value: Number(d.value) || 0,
        side: d.side || 'front',
      })),
      panels: (result.panels || []).map((p: any) => ({
        label: p.label || '',
        width: Number(p.width) || 1000,
        height: Number(p.height) || 1500,
        angle: Number(p.angle) || 0,
      })),
      totalWidth: Number(result.totalWidth) || 2000,
      totalHeight: Number(result.totalHeight) || 1500,
      description: result.description || '',
      suggestions: result.suggestions || [],
      panelCount: result.panelCount || 1,
      sashTypes: result.sashTypes || ['fixed'],
    };
  } catch (e) {
    console.error('解析AI结果失败:', content);
    throw new Error(`解析识别结果失败: ${e instanceof Error ? e.message : '未知错误'}`);
  }
}

// ===== 窗型映射 =====

function mapToCompositeType(windowType: string): CompositeWindowType | undefined {
  switch (windowType) {
    case 'l-shape': return 'l-shape';
    case 'u-shape': return 'u-shape';
    case 'bay-window': return 'bay-window';
    default: return undefined;
  }
}

// ===== 模拟识别（用于无API Key时的演示） =====

export function mockRecognizeWindow(): PhotoRecognitionResult {
  return {
    windowType: 'l-shape',
    windowTypeName: 'L形窗',
    compositeType: 'l-shape',
    confidence: 0.92,
    dimensions: [
      { label: '正面宽度', value: 2450, side: 'front' },
      { label: '侧面宽度', value: 1500, side: 'right' },
      { label: '窗户高度', value: 1870, side: 'front' },
    ],
    panels: [
      { label: '正面', width: 2450, height: 1870, angle: 0 },
      { label: '右侧面', width: 1500, height: 1870, angle: 90 },
    ],
    totalWidth: 3950,
    totalHeight: 1870,
    description: 'L形转角窗，由正面和右侧面组成，两面呈90度角。正面宽2450mm，侧面宽1500mm，高度1870mm。',
    suggestions: [
      '建议确认转角处的立柱宽度',
      '注意检查两面是否完全垂直',
      '建议测量窗台到地面的高度',
    ],
    panelCount: 2,
    sashTypes: ['sliding-left', 'sliding-right', 'casement-right'],
  };
}
