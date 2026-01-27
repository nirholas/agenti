/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Excellence is a habit, not an act 🌟
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import compileRoutes from './routes/compile.js';
import deployRoutes from './routes/deploy.js';
import aiRoutes from './routes/ai.js';
import faucetRoutes from './routes/faucet.js';
import ipfsRoutes from './routes/ipfs.js';
import translateRoutes from './routes/translate.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';

config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (needed for rate limiting behind reverse proxies/devcontainers)
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/compile', compileRoutes);
app.use('/api/deploy', deployRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/faucet', faucetRoutes);
app.use('/api/ipfs', ipfsRoutes);
app.use('/api/translate', translateRoutes);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 API docs: http://localhost:${PORT}/health`);
});

export default app;
