import type { IQuoteProvider } from '../../../../../packages/application/src/use-cases/get-current-quote';

export class MercadoBitcoinProvider implements IQuoteProvider {
  private base = 'https://www.mercadobitcoin.net/api';
  async fetchCurrent() {
    const pair = 'BTC';
    // public API ticker
    const url = `${this.base}/${pair}/ticker/`;
    const res = await fetch(url, { method: 'GET', headers: { 'accept': 'application/json' } });
    if (!res.ok) throw new Error(`provider http ${res.status}`);
    const json = await res.json() as any;
    const buy = Number(json.ticker.buy);
    const sell = Number(json.ticker.sell);
    const ts = new Date(Number(json.ticker.date) * 1000).toISOString();
    return { buy, sell, source: 'MercadoBitcoin', ts };
  }
}

