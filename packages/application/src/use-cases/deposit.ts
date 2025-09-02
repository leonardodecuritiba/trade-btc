import { AppError } from '../../../shared/src/errors';
import { bankersRound2 } from '../../../shared/src/money';

export interface DepositRequest {
  userId: string;
  amountBRL: number;
  clientRequestId: string;
}

export interface DepositResponse {
  id: string;
  amountBRL: number;
  newBalance: number;
  createdAt: Date;
  idempotent?: boolean;
}

export interface IDepositRepository {
  createDepositTx(input: { userId: string; amountBRL: number; clientRequestId: string }): Promise<{
    id: string;
    amountBRL: number;
    createdAt: Date;
    newBalance: number;
    idempotent: boolean;
  }>;
}

export interface IUserReader {
  findById(id: string): Promise<{ id: string; name: string; email: string } | null>;
}

export interface IEmailService {
  sendDepositConfirmation(to: { email: string; name?: string }, payload: { amountBRL: number; newBalance: number }): Promise<void>;
}

export class DepositUseCase {
  constructor(
    private repo: IDepositRepository,
    private users: IUserReader,
    private email: IEmailService
  ) {}

  async execute(req: DepositRequest): Promise<DepositResponse> {
    const amount = bankersRound2(req.amountBRL);
    if (!isFinite(amount) || amount <= 0) {
      throw new AppError(422, 'INVALID_INPUT', 'amountBRL must be > 0');
    }
    if (!req.clientRequestId || req.clientRequestId.trim().length === 0) {
      throw new AppError(422, 'INVALID_INPUT', 'clientRequestId is required');
    }

    const result = await this.repo.createDepositTx({ userId: req.userId, amountBRL: amount, clientRequestId: req.clientRequestId });

    // Fire-and-forget email (do not block / do not rollback)
    // Run in background and swallow errors here (adapter will log)
    (async () => {
      try {
        const user = await this.users.findById(req.userId);
        if (user) {
          await this.email.sendDepositConfirmation({ email: user.email, name: user.name }, { amountBRL: amount, newBalance: result.newBalance });
        }
      } catch { /* ignore */ }
    })();

    return {
      id: result.id,
      amountBRL: result.amountBRL,
      newBalance: result.newBalance,
      createdAt: result.createdAt,
      idempotent: result.idempotent,
    };
  }
}
