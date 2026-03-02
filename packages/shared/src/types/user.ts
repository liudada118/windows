// WindoorDesigner - 用户与租户类型定义

export type UserRole = 'admin' | 'manager' | 'designer' | 'production' | 'sales';

export interface User {
  id: string;
  tenantId: string;
  username: string;
  name: string;
  role: UserRole;
  phone: string;
  email?: string;
  avatar?: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  maxUsers: number;
  createdAt: string;
}
