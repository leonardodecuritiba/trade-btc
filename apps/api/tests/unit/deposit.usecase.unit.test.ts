import { DepositUseCase, IDepositRepository, IUserReader, IEmailService } from '../../../../packages/application/src/use-cases/deposit';
import { AppError } from '../../../../packages/shared/src/errors';

class FakeRepo implements IDepositRepository {
  lastInput?: { userId: string; amountBRL: number; clientRequestId: string };
  constructor(private response: { id: string; amountBRL: number; createdAt: Date; newBalance: number; idempotent: boolean }) {}
  async createDepositTx(input: { userId: string; amountBRL: number; clientRequestId: string }) {
    this.lastInput = input;
    return this.response;
  }
}

class FakeUsers implements IUserReader {
  constructor(private email: string, private name = 'User') {}
  async findById(id: string) { return { id, email: this.email, name: this.name }; }
}

class FakeEmail implements IEmailService {
  public sent: { to: { email: string; name?: string }, payload: { amountBRL: number; newBalance: number } }[] = [];
  constructor(private shouldFail = false) {}
  async sendDepositConfirmation(to: { email: string; name?: string }, payload: { amountBRL: number; newBalance: number }): Promise<void> {
    if (this.shouldFail) throw new Error('email fail');
    this.sent.push({ to, payload });
  }
}

describe('DepositUseCase (unit)', () => {
  it('validates amount > 0 and clientRequestId', async () => {
    const repo = new FakeRepo({ id: 't1', amountBRL: 1, createdAt: new Date(), newBalance: 1, idempotent: false });
    const users = new FakeUsers('a@b.com');
    const email = new FakeEmail();
    const uc = new DepositUseCase(repo, users, email);

    await expect(uc.execute({ userId: 'u1', amountBRL: 0, clientRequestId: 'x' })).rejects.toBeInstanceOf(AppError);
    await expect(uc.execute({ userId: 'u1', amountBRL: -1, clientRequestId: 'x' })).rejects.toBeInstanceOf(AppError);
    await expect(uc.execute({ userId: 'u1', amountBRL: 10, clientRequestId: '' })).rejects.toBeInstanceOf(AppError);
  });

  it('rounds amount with banker\'s rounding before repository call', async () => {
    const repo = new FakeRepo({ id: 't2', amountBRL: 1.00, createdAt: new Date(), newBalance: 101.00, idempotent: false });
    const users = new FakeUsers('a@b.com');
    const email = new FakeEmail();
    const uc = new DepositUseCase(repo, users, email);

    await uc.execute({ userId: 'u1', amountBRL: 1.005, clientRequestId: 'crid-1' });
    expect(repo.lastInput?.amountBRL).toBe(1.00);

    await uc.execute({ userId: 'u1', amountBRL: 1.015, clientRequestId: 'crid-2' });
    expect(repo.lastInput?.amountBRL).toBe(1.02);
  });

  it('calls email service and does not fail the deposit if email throws', async () => {
    const repo = new FakeRepo({ id: 't3', amountBRL: 50.00, createdAt: new Date(), newBalance: 150.00, idempotent: false });
    const users = new FakeUsers('user@example.com', 'User');
    const email = new FakeEmail(true); // force failure
    const uc = new DepositUseCase(repo, users, email);

    const res = await uc.execute({ userId: 'u1', amountBRL: 50, clientRequestId: 'em1' });
    expect(res.id).toBe('t3');
    expect(res.newBalance).toBe(150.00);
  });
});

