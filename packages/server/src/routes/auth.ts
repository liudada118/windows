// @windoor/server - 认证路由
import { Router } from 'express';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (_req, res) => {
  // TODO: 接入数据库和JWT
  res.json({ code: 0, data: null, message: '登录待实现' });
});

// POST /api/auth/logout
authRouter.post('/logout', async (_req, res) => {
  res.json({ code: 0, data: null, message: '已登出' });
});

// GET /api/auth/me
authRouter.get('/me', async (_req, res) => {
  // TODO: 从JWT解析用户信息
  res.json({ code: 0, data: null, message: '获取用户信息待实现' });
});
