import { AppError } from '../../../shared/src/errors';

export interface QuoteDTO {
  buy: number;
  sell: number;
  source: string;
  ts: string; // ISO-8601
  ageMs: number;
}

export interface IQuoteProvider {
  fetchCurrent(): Promise<{ buy: number; sell: number; source: string; ts: string }>;
}

export interface IQuoteCache {
  get(): Promise<{ buy: number; sell: number; source: string; ts: string } | null>;
  set(value: { buy: number; sell: number; source: string; ts: string }): Promise<void>;
}

export class GetCurrentQuoteUseCase {
  constructor(private cache: IQuoteCache, private provider: IQuoteProvider) {}

  async execute(): Promise<QuoteDTO> {
    const cached = await this.cache.get();
    if (cached) {
      return this.toDTO(cached);
    }
    try {
      const fresh = await this.provider.fetchCurrent();
      await this.cache.set(fresh);
      return this.toDTO(fresh);
    } catch (_err) {
      // provider failed; try cache again (fallback if available)
      const fallback = await this.cache.get();
      if (fallback) return this.toDTO(fallback);
      throw new AppError(503, 'PROVIDER_UNAVAILABLE', 'Quote provider is unavailable.');
    }
  }

  private toDTO(src: { buy: number; sell: number; source: string; ts: string }): QuoteDTO {
    const now = Date.now();
    const tsNum = Date.parse(src.ts);
    const ageMs = isFinite(tsNum) ? Math.max(0, now - tsNum) : 0;
    return { ...src, ageMs };
  }
}

