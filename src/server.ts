import app from './app';
import { createServer } from 'http';
import { initSocket } from './socket/socket';
import { initDB, closeDB } from './db/db';
import { config } from './config';

const PORT = config.PORT;
const httpServer = createServer(app);

// Initialize Real-time Engine
const io = initSocket(httpServer);

// Bootstrap Database & Real-Time Server
async function bootstrap(): Promise<void> {
  try {
    await initDB();
    httpServer.listen(PORT, () => {
      console.log(`🚀 Gram2City Real-time Engine running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to bootstrap Gram2City server:', error);
    process.exit(1);
  }
}

bootstrap();

// ─── Graceful Shutdown Handlers ──────────────────────────────────────────────
let isShuttingDown = false;

const gracefulShutdown = (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  // Force exit if hanging beyond 10 seconds
  const forceExitTimeout = setTimeout(() => {
    console.error('⚠️ Forcing process exit after shutdown timeout (10s)');
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  // 1. Close Socket.IO connections
  if (io) {
    io.close(() => {
      console.log('⚡ Socket.IO server closed cleanly');
    });
  }

  // 2. Stop accepting new HTTP requests and finish active requests
  httpServer.close(async () => {
    console.log('🚀 HTTP server closed');

    // 3. Close MongoDB & Mongoose connections
    await closeDB();

    console.log('👋 Gram2City backend terminated cleanly');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
