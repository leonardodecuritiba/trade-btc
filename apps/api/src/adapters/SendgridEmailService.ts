import { IEmailService } from '../../../../packages/application/src/use-cases/deposit';
import { IPurchaseEmailService } from '../../../../packages/application/src/use-cases/buy-btc';
import { baseLogger } from '../lib/logger';
import { ISaleEmailService } from '../../../../packages/application/src/use-cases/sell-btc';

export class SendgridEmailService implements IEmailService, IPurchaseEmailService, ISaleEmailService {
  async sendDepositConfirmation(to: { email: string; name?: string }, payload: { amountBRL: number; newBalance: number }): Promise<void> {
    const forceFail = process.env.EMAIL_FORCE_FAIL === '1';
    if (forceFail) {
      baseLogger.error({ to, payload }, 'email send failed (forced)');
      throw new Error('email forced failure');
    }
    // In this MVP, just log; real integration would call SendGrid
    baseLogger.info({ to, payload }, 'email sent: deposit confirmation');
  }

  async sendPurchaseConfirmation(to: { email: string; name?: string }, payload: { amountBRL: number; qtyBTC: number; unitPriceBRL: number }): Promise<void> {
    const forceFail = process.env.EMAIL_FORCE_FAIL === '1';
    if (forceFail) {
      baseLogger.error({ to, payload }, 'email send failed (forced)');
      throw new Error('email forced failure');
    }
    baseLogger.info({ to, payload }, 'email sent: purchase confirmation');
  }

  async sendSaleConfirmation(to: { email: string; name?: string }, payload: { amountBRL: number; qtyBTC: number; unitPriceBRL: number }): Promise<void> {
    const forceFail = process.env.EMAIL_FORCE_FAIL === '1';
    if (forceFail) {
      baseLogger.error({ to, payload }, 'email send failed (forced)');
      throw new Error('email forced failure');
    }
    baseLogger.info({ to, payload }, 'email sent: sale confirmation');
  }
}
