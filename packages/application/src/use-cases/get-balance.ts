import { bankersRound2 } from '../../../shared/src/money';

export interface GetBalanceResponse {
  balanceBRL: number;
  currency: 'BRL';
  updatedAt: Date;
}

export interface IAccountReader {
  getByUserId(userId: string): Promise<{ fiatBalanceBRL: number; updatedAt: Date } | null>;
}

export class GetBalanceUseCase {
  constructor(private accounts: IAccountReader) {}
  async execute(userId: string): Promise<GetBalanceResponse> {
    const acc = await this.accounts.getByUserId(userId);
    const balanceRaw = acc ? Number(acc.fiatBalanceBRL) : 0;
    const balance = bankersRound2(balanceRaw);
    const updatedAt = acc ? acc.updatedAt : new Date(0);
    return { balanceBRL: balance, currency: 'BRL', updatedAt };
  }
}
