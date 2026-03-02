// WindoorDesigner - API 请求/响应类型定义
// 前后端共享的接口契约

import type { DesignData } from './design';

// ===== 统一响应格式 =====
export interface ApiResponse<T> {
  code: number;          // 0 = 成功, 非0 = 错误
  data: T;
  message: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ===== 认证 =====
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    role: string;
    tenantId: string;
  };
}

// ===== 设计数据 API =====
export interface CreateDesignRequest {
  name: string;
  width: number;
  height: number;
  profileSeriesId: string;
}

export interface UpdateDesignRequest {
  name?: string;
  designData: DesignData;  // 整体覆盖
}

export interface DesignListItem {
  id: string;
  name: string;
  thumbnail: string;
  updatedAt: string;
  windowCount: number;
}

// ===== 错误码 =====
export const ERROR_CODES = {
  SUCCESS: 0,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  SERVER_ERROR: 500,
  DESIGN_CONFLICT: 1001,
  FORMULA_ERROR: 2001,
  CALC_TIMEOUT: 2002,
} as const;
