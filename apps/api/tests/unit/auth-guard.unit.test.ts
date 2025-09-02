import express from 'express';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { authGuard } from '../../src/middleware/authGuard';
import { requestContext } from '../../src/middleware/requestContext';
import { AppError } from '../../../../packages/shared/src/errors';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(requestContext);

  app.get('/protected', authGuard(), (req, res) => {
    return res.json({ ok: true, userId: res.locals.userId });
  });

  app.use((err: any, req: any, res: any, _next: any) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    return res.status(500).json({ code: 'INTERNAL', message: 'internal' });
  });
  return app;
}

describe('authGuard (unit)', () => {
  it('rejects when Authorization header is missing', async () => {
    const app = buildApp();
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects invalid token', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid.token');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('allows valid token and exposes userId', async () => {
    const app = buildApp();
    const token = jwt.sign({ sub: 'user-123' }, process.env.JWT_SECRET || 'supersecret', { expiresIn: '15m' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.userId).toBe('user-123');
  });
});

