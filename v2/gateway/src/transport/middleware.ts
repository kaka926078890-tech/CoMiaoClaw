import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface RequestWithId extends Request {
  requestId?: string;
}

export function requestIdMiddleware(req: RequestWithId, _res: Response, next: NextFunction): void {
  req.requestId = req.headers['x-request-id'] as string || randomUUID();
  next();
}

export function logRequest(req: RequestWithId, _res: Response, next: NextFunction): void {
  const id = req.requestId ?? '-';
  const line = JSON.stringify({
    level: 'info',
    requestId: id,
    path: req.path,
    method: req.method,
  });
  process.stderr.write(line + '\n');
  next();
}
