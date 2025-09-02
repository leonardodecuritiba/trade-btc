import type { IQuoteProvider } from '../../../../../packages/application/src/use-cases/get-current-quote';

export class StubQuoteProvider implements IQuoteProvider {
  async fetchCurrent() {
    if (process.env.QUOTE_STUB_FAIL === '1') {
      throw new Error('stub fail');
    }
    const buy = Number(process.env.QUOTE_STUB_BUY || 100000);
    const sell = Number(process.env.QUOTE_STUB_SELL || 99000);
    const source = process.env.QUOTE_SOURCE || 'MercadoBitcoin';
    const ts = new Date().toISOString();
    return { buy, sell, source, ts };
  }
}

