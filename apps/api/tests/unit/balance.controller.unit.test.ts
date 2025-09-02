import { BalanceController } from '../../src/http/controllers/BalanceController';
import { GetBalanceUseCase } from '../../../../packages/application/src/use-cases/get-balance';

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (payload: any) => { res.body = payload; return res; };
  res.locals = {} as any;
  return res;
}

describe('BalanceController (unit)', () => {
  it('calls use case and returns 200 with payload', async () => {
    const fakeUc: Partial<GetBalanceUseCase> = {
      execute: async (_userId: string) => ({ balanceBRL: 77, currency: 'BRL', updatedAt: new Date('2024-01-01T00:00:00Z') }) as any,
    };
    const controller = new BalanceController(fakeUc as GetBalanceUseCase);
    const req: any = { user: { id: 'u-1' } };
    const res: any = mockRes();
    await controller.show(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.balanceBRL).toBe(77);
    expect(res.body.currency).toBe('BRL');
  });
});

