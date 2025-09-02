import request from 'supertest';
import { app } from '../../src/app';

async function registerAndLogin(email: string, password = 'password123') {
  const name = 'Empty Pos Tester';
  await request(app).post('/auth/register').send({ name, email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

function auth(token: string) { return { Authorization: `Bearer ${token}` }; }

describe('GET /positions (no positions)', () => {
  beforeAll(() => {
    process.env.QUOTE_PROVIDER = 'stub';
    process.env.QUOTE_STUB_BUY = '121000';
    process.env.QUOTE_STUB_SELL = '120000';
    process.env.QUOTE_STUB_FAIL = '0';
  });

  it('returns empty array when user has no open positions', async () => {
    const token = await registerAndLogin('pos-empty@example.com');
    const res = await request(app).get('/positions').set(auth(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });
});

