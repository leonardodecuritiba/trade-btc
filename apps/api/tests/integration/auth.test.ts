import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';

describe('Auth Endpoints', () => {
  it('should register a new user and create an account with zero balance', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.email).toBe('test@example.com');
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('createdAt');

    const userInDb = await prisma.user.findUnique({ 
      where: { email: 'test@example.com' }, 
      include: { account: true } 
    });
    expect(userInDb).not.toBeNull();
    // Accept either 0 or 0.00 string formats; assert numeric zero
    // @ts-ignore Prisma Decimal has toNumber()
    const bal = userInDb?.account?.fiatBalanceBRL?.toNumber ? userInDb?.account?.fiatBalanceBRL.toNumber() : Number(userInDb?.account?.fiatBalanceBRL);
    expect(bal).toBe(0);
  });

  it('should return 409 if email is already taken', async () => {
    await request(app)
      .post('/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

    const response = await request(app)
      .post('/auth/register')
      .send({
        name: 'Another User',
        email: 'test@example.com',
        password: 'password456',
      });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EMAIL_TAKEN');
  });

  it('should login a registered user and return a JWT token', async () => {
    await request(app)
      .post('/auth/register')
      .send({
        name: 'Test User',
        email: 'login@example.com',
        password: 'password123',
      });

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'login@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body.expiresIn).toBe('15m');
  });

  it('should return 401 for invalid credentials', async () => {
    await request(app)
      .post('/auth/register')
      .send({
        name: 'Test User',
        email: 'login@example.com',
        password: 'password123',
      });

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'login@example.com',
        password: 'wrongpassword',
      });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('should enforce rate limit on login route', async () => {
    // ensure a user exists
    await request(app)
      .post('/auth/register')
      .send({
        name: 'Rate Limited User',
        email: 'ratelimit@example.com',
        password: 'password123',
      });

    const max = Number(process.env.RATE_LIMIT_MAX_LOGIN || 10);
    const attempts = max + 2;
    let lastStatus = 200;
    for (let i = 0; i < attempts; i++) {
      const resp = await request(app)
        .post('/auth/login')
        .send({ email: 'ratelimit@example.com', password: 'wrong' });
      lastStatus = resp.status;
    }
    expect(lastStatus).toBe(429);
  });
});
