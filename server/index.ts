// Загружаем переменные окружения в самом начале
import "./config";

import express, { type Request, Response, NextFunction } from "express";
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from 'path';
import net from 'net';
import { randomUUID } from 'crypto';

const app = express();
// Увеличим лимиты тела запроса для надёжности (в частности, если где-то попадёт dataURL)
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: false, limit: '20mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// Attach/propagate request id for better tracing
app.use((req, res, next) => {
  const incomingId = (req.headers['x-request-id'] as string) || (req.headers['x-correlation-id'] as string);
  const requestId = incomingId || randomUUID();
  res.setHeader('x-request-id', requestId);
  // keep in locals for downstream handlers and logging
  (res as any).locals = (res as any).locals || {};
  (res as any).locals.requestId = requestId;
  next();
});

// Безопасные заголовки (минимально совместимые)
// В dev с Vite отключаем CSP, чтобы не ломать HMR
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Общий/узкий rate limit. В е2е можно отключить через RATE_LIMIT_DISABLED=1
const rateLimitDisabled = process.env.RATE_LIMIT_DISABLED === '1';
if (!rateLimitDisabled) {
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 минута
    max: 300, // до 300 запросов в минуту
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests' },
  });
  app.use('/api/', apiLimiter);

  // Более строгий лимит на авторизацию и загрузки
  const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });
  app.use(['/api/login', '/api/register', '/api/register-with-invite'], authLimiter);

  const uploadLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
  app.use(['/api/upload/avatar', '/api/upload/memory-image', '/api/upload/audio', '/api/upload/audio-cover'], uploadLimiter);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
  const rid = (res as any).locals?.requestId;
  let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms${rid ? ` [id:${rid}]` : ''}`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

  // ensure request id header is present on errors as well
  const rid = (res as any).locals?.requestId || res.getHeader('x-request-id') || randomUUID();
  res.setHeader('x-request-id', String(rid));
  res.status(status).json({ message, requestId: String(rid) });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const envPort = process.env.PORT;
  const defaultPort = 5000;
  let port = parseInt(envPort || String(defaultPort), 10);
  const isDev = app.get("env") === "development";
  const hostBind = isDev ? "127.0.0.1" : "0.0.0.0";

  // In development, if default port is busy and no explicit PORT is set,
  // automatically find the next available port to avoid EADDRINUSE.
  async function getAvailablePort(startPort: number, host: string): Promise<number> {
    return await new Promise((resolve) => {
      const tester = net
        .createServer()
        .once('error', (err: any) => {
          if (err && err.code === 'EADDRINUSE') {
            // try next port
            resolve(getAvailablePort(startPort + 1, host));
          } else {
            resolve(startPort);
          }
        })
        .once('listening', () => {
          tester.close(() => resolve(startPort));
        })
        .listen(startPort, host);
    });
  }

  if (isDev && !envPort) {
    port = await getAvailablePort(port, hostBind);
    if (port !== defaultPort) {
      log(`port ${defaultPort} is in use, switched to ${port}`);
    }
  }
  const listenOptions: any = {
    port,
    host: hostBind,
  };
  // SO_REUSEPORT не поддерживается в Windows -> убираем reusePort
  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }

  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);
    log(`open: http://${hostBind}:${port}`);
  });
})();
