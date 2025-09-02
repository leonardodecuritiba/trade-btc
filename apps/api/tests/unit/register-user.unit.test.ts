import { RegisterUserUseCase, IUserRepository, IPasswordHasher } from '../../../../packages/application/src/use-cases';

class InMemoryUserRepo implements IUserRepository {
  private users: any[] = [];
  async findByEmail(email: string) {
    return this.users.find(u => u.email === email) || null;
  }
  async create(user: any, account: { fiatBalanceBRL: number }) {
    const created = { id: 'u1', createdAt: new Date(), ...user, account: { id: 'a1', ...account } };
    this.users.push(created);
    return created;
  }
}

class FakeHasher implements IPasswordHasher {
  async hash(password: string) { return `hash:${password}`; }
  async compare(password: string, hash: string) { return hash === `hash:${password}`; }
}

describe('RegisterUserUseCase (unit)', () => {
  it('normalizes email to lowercase/trim and hashes password', async () => {
    const repo = new InMemoryUserRepo();
    const hasher = new FakeHasher();
    const uc = new RegisterUserUseCase(repo, hasher);

    const result = await uc.execute({ name: 'X', email: '  Foo@Bar.com  ', password: 'secret123' });
    expect(result.email).toBe('foo@bar.com');
    const stored = await repo.findByEmail('foo@bar.com');
    expect(stored?.passwordHash).toBe('hash:secret123');
  });
});

