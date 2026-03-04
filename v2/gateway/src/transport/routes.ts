import { Router, Request, Response } from 'express';
import { singleTurnChat, singleTurnChatStream } from '../application/chat.js';
import { config } from '../shared/config.js';
import type { ChatRequest, ChatResponse, ConfigResponse } from '../shared/types.js';
import type { RequestWithId } from './middleware.js';

function getRequestId(req: Request): string {
  return (req as RequestWithId).requestId ?? '-';
}

function writeSSE(res: Response, data: object): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function createChatRouter(): Router {
  const router = Router();

  router.get('/config', (_req: Request, res: Response) => {
    const body: ConfigResponse = {
      models: [...config.allowedModels],
      defaultModel: config.defaultModel,
    };
    res.json(body);
  });

  router.post('/chat', async (req: Request, res: Response) => {
    const requestId = getRequestId(req);
    const raw = req.body as Record<string, unknown> | undefined;
    if (!raw || typeof raw !== 'object') {
      res.status(400).json({ error: 'body must be a JSON object' });
      return;
    }
    const message = raw.message;
    if (typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'message must be a non-empty string' });
      return;
    }
    const MAX_MESSAGE_LENGTH = 64 * 1024;
    if (message.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: 'message too long' });
      return;
    }
    const model = typeof raw.model === 'string' ? raw.model : undefined;
    const stream = raw.stream === true;
    const payload: ChatRequest = { message: message.trim(), model, sessionId: undefined };

    const t0 = Date.now();
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      try {
        const gen = singleTurnChatStream({ message: payload.message, model: payload.model });
        let result: ChatResponse | null = null;
        while (true) {
          const { value, done } = await gen.next();
          if (done && value && 'reply' in value) {
            result = value;
            break;
          }
          const delta = value as { reasoning_content?: string; content?: string } | undefined;
          if (delta?.reasoning_content) writeSSE(res, { type: 'thinking', text: delta.reasoning_content });
          if (delta?.content) writeSSE(res, { type: 'content', text: delta.content });
        }
        if (result) writeSSE(res, { type: 'done', reply: result.reply, model: result.model });
        else writeSSE(res, { type: 'done', reply: '', model: config.defaultModel });
        const elapsed = Date.now() - t0;
        process.stderr.write(JSON.stringify({
          level: 'info',
          requestId,
          event: 'chat_stream_complete',
          elapsedMs: elapsed,
        }) + '\n');
      } catch (err) {
        process.stderr.write(JSON.stringify({
          level: 'error',
          requestId,
          event: 'chat_stream_error',
          error: err instanceof Error ? err.message : String(err),
        }) + '\n');
        writeSSE(res, { type: 'error', error: err instanceof Error ? err.message : String(err) });
      } finally {
        res.end();
      }
      return;
    }

    try {
      const result = await singleTurnChat({
        message: payload.message,
        model: payload.model,
      });
      const elapsed = Date.now() - t0;
      process.stderr.write(JSON.stringify({
        level: 'info',
        requestId,
        event: 'chat_complete',
        model: result.model,
        elapsedMs: elapsed,
      }) + '\n');
      const body: ChatResponse = { reply: result.reply, model: result.model };
      res.json(body);
    } catch (err) {
      const elapsed = Date.now() - t0;
      process.stderr.write(JSON.stringify({
        level: 'error',
        requestId,
        event: 'chat_error',
        elapsedMs: elapsed,
        error: err instanceof Error ? err.message : String(err),
      }) + '\n');
      res.status(500).json({ error: 'Chat request failed' });
    }
  });

  return router;
}
