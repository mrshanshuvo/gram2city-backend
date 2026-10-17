import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import logger from './middleware/logger';
import { globalErrorHandler } from './middleware/globalErrorHandler';

import mongoose from 'mongoose';
import { config } from './config';

// ─── Express App ──────────────────────────────────────────────────────────────
const app = express();

// ─── Professional Middlewares ────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com', 'fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", config.CLIENT_URL],
      },
    },
  }),
);
app.use(logger); // Request logging
app.use(compression()); // Gzip compression
const clientOrigins = config.CLIENT_URL.split(',').map((url) => url.trim());
app.use(
  cors({
    origin: clientOrigins,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased for dashboard polling and development
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});
app.use(limiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
import apiRouter from './modules/app.routes';

app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Gram2City Logistics Enterprise API is running smoothly',
    version: '2.3.0',
    status: 'healthy',
  });
});

app.get('/health', (_req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1 || config.NODE_ENV === 'test';
  const status = isDbConnected ? 'healthy' : 'degraded';
  const statusCode = isDbConnected ? 200 : 503;

  res.status(statusCode).json({
    success: isDbConnected,
    status,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: '2.3.0',
    environment: config.NODE_ENV,
    memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
  });
});

app.use('/', apiRouter);

// ─── Centralized Error Handler ───────────────────────────────────────────────
app.use(globalErrorHandler);

export default app;
