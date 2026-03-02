// @windoor/server - 后端服务入口
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { designRouter } from './routes/design';
import { authRouter } from './routes/auth';

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '10mb' }));

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 路由
app.use('/api/auth', authRouter);
app.use('/api/designs', designRouter);

// 启动
app.listen(PORT, () => {
  console.log(`[WindoorServer] 🚀 Server running on http://localhost:${PORT}`);
});
