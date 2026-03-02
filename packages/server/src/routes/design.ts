// @windoor/server - 设计数据路由
import { Router } from 'express';

export const designRouter = Router();

// GET /api/designs - 获取设计列表
designRouter.get('/', async (_req, res) => {
  // TODO: 接入数据库
  res.json({ code: 0, data: { items: [], total: 0, page: 1, pageSize: 20 }, message: 'ok' });
});

// GET /api/designs/:id - 获取单个设计
designRouter.get('/:id', async (req, res) => {
  // TODO: 接入数据库
  res.json({ code: 0, data: null, message: `设计 ${req.params.id} 待实现` });
});

// POST /api/designs - 创建设计
designRouter.post('/', async (_req, res) => {
  // TODO: 接入数据库
  res.status(201).json({ code: 0, data: null, message: '创建设计待实现' });
});

// PUT /api/designs/:id - 更新设计 (整体覆盖)
designRouter.put('/:id', async (req, res) => {
  // TODO: 接入数据库
  res.json({ code: 0, data: null, message: `更新设计 ${req.params.id} 待实现` });
});

// DELETE /api/designs/:id - 删除设计
designRouter.delete('/:id', async (req, res) => {
  // TODO: 接入数据库
  res.json({ code: 0, data: null, message: `删除设计 ${req.params.id} 待实现` });
});
