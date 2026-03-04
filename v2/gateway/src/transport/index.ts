import cors from 'cors';
import express from 'express';
import { requestIdMiddleware, logRequest } from './middleware.js';
import { createChatRouter } from './routes.js';

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);
  app.use(logRequest);
  app.use(createChatRouter());
  return app;
}
