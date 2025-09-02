import request from 'supertest';
import { app } from '../../src/app';

async function registerAndLogin(email: string, password = 'password123') {
  const name = 'Volume Empty Tester';
  await request(app).post('/auth/register').send({ name, email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

function auth(token: string) { return { Authorization: `Bearer ${token}` }; }

describe('GET /metrics/daily-volume (empty day)', () => {
  beforeAll(() => {
    process.env.QUOTE_PROVIDER = 'stub';
    process.env.QUOTE_STUB_BUY = '100000';
    process.env.QUOTE_STUB_SELL = '100000';
  });

  it('returns zeros when no operations today', async () => {
    const token = await registerAndLogin('vol-empty@example.com');
    const a = auth(token);
    const res = await request(app).get('/metrics/daily-volume').set(a).expect(200);
    expect(res.body).toHaveProperty('boughtBTC', 0);
    expect(res.body).toHaveProperty('soldBTC', 0);
  });
});

