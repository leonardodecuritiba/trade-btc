import { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { AppError } from '../../../../packages/shared/src/errors';

export function authGuard() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = req.headers['authorization'];
      if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
        res.setHeader('WWW-Authenticate', 'Bearer realm="api"');
        throw new AppError(401, 'UNAUTHORIZED', 'Missing bearer token.');
      }
      const token = auth.slice('Bearer '.length).trim();
      const secret = process.env.JWT_SECRET || 'supersecret';
      const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
      const sub = decoded && decoded.sub;
      if (!sub || typeof sub !== 'string') {
        res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
        throw new AppError(401, 'UNAUTHORIZED', 'Invalid token.');
      }
      // Attach context for downstream logging/handlers
      res.locals.userId = sub;
      if (res.locals.logger) {
        res.locals.logger = res.locals.logger.child({ userId: sub });
      }
      (req as any).user = { id: sub };
      return next();
    } catch (err: any) {
      // Differentiate token expiration if possible, but keep code stable
      if (err && err.name === 'TokenExpiredError') {
        res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token", error_description="token_expired"');
        return next(new AppError(401, 'UNAUTHORIZED', 'Token expired.'));
      }
      if (err instanceof AppError) return next(err);
      res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
      return next(new AppError(401, 'UNAUTHORIZED', 'Invalid token.'));
    }
  };
}

