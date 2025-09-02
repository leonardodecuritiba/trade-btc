import { AppError } from '../../../shared/src/errors';

export type StatementType = 'DEPOSIT' | 'BUY' | 'SELL' | 'REBOOK';

export interface StatementQuery {
  from?: Date;
  to?: Date;
  types?: StatementType[];
  cursor?: string; // base64 of { createdAt: string, id: string }
  limit?: number; // 1..100 default 50
}

export interface StatementItemDTO {
  id: string;
  type: StatementType;
  createdAt: string; // ISO
  amountBRL?: number | null;
  qtyBTC?: number | null;
  quoteSide?: 'buy' | 'sell' | null;
  quotePriceBRL?: number | null;
  unitPriceBRL?: number | null; // only for REBOOK
}

export interface StatementPageDTO {
  items: StatementItemDTO[];
  page: { nextCursor?: string };
}

export interface ITransactionRepo {
  findForStatement(input: {
    userId: string;
    from: Date;
    to: Date;
    types?: StatementType[];
    cursor?: { createdAt: Date; id: string };
    limit: number;
  }): Promise<{ rows: Array<{
    id: string; type: StatementType; createdAt: Date;
    amountBRL: number | null; qtyBTC: number | null; quotePriceBRL: number | null;
  }>; hasMore: boolean; nextCursor?: { createdAt: Date; id: string } }>; 
}

function decodeCursor(cursor?: string): { createdAt: Date; id: string } | undefined {
  if (!cursor) return undefined;
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf8');
    const obj = JSON.parse(raw) as { createdAt: string; id: string };
    const d = new Date(obj.createdAt);
    if (isNaN(d.getTime()) || !obj.id) return undefined;
    return { createdAt: d, id: obj.id };
  } catch {
    return undefined;
  }
}

function encodeCursor(v: { createdAt: Date; id: string } | undefined): string | undefined {
  if (!v) return undefined;
  return Buffer.from(JSON.stringify({ createdAt: v.createdAt.toISOString(), id: v.id }), 'utf8').toString('base64');
}

export class GetStatementUseCase {
  private maxRangeMs = 90 * 24 * 60 * 60 * 1000; // 90 days
  constructor(private txRepo: ITransactionRepo) {}

  async execute(userId: string, query: StatementQuery): Promise<StatementPageDTO> {
    const now = new Date();
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const tz = 'America/Sao_Paulo';
    const toRaw = query.to ?? now;
    const fromRaw = query.from ?? new Date(toRaw.getTime() - this.maxRangeMs);
    // Validate raw range (without normalization)
    if (fromRaw > toRaw) {
      throw new AppError(422, 'INVALID_RANGE', '`from` must be <= `to`');
    }
    if (toRaw.getTime() - fromRaw.getTime() > this.maxRangeMs) {
      throw new AppError(422, 'INVALID_RANGE', 'Range cannot exceed 90 days');
    }
    // Normalize to start/end of day in America/Sao_Paulo to avoid day-boundary issues
    const to = this.endOfDayInTZ(toRaw, tz);
    const from = this.startOfDayInTZ(fromRaw, tz);
    const cursorObj = decodeCursor(query.cursor);
    const types = query.types && query.types.length ? query.types : undefined;
    const { rows, hasMore, nextCursor } = await this.txRepo.findForStatement({ userId, from, to, types, cursor: cursorObj, limit });
    const items = rows.map((r) => this.mapRow(r));
    return { items, page: { nextCursor: encodeCursor(nextCursor) } };
  }

  private mapRow(r: { id: string; type: StatementType; createdAt: Date; amountBRL: number | null; qtyBTC: number | null; quotePriceBRL: number | null; }): StatementItemDTO {
    const base = { id: r.id, type: r.type, createdAt: r.createdAt.toISOString() } as StatementItemDTO;
    switch (r.type) {
      case 'DEPOSIT':
        return { ...base, amountBRL: r.amountBRL ?? 0, qtyBTC: null, quoteSide: null, quotePriceBRL: null, unitPriceBRL: null };
      case 'BUY':
        return { ...base, amountBRL: r.amountBRL != null ? -Math.abs(r.amountBRL) : null, qtyBTC: r.qtyBTC ?? null, quoteSide: 'sell', quotePriceBRL: r.quotePriceBRL ?? null, unitPriceBRL: null };
      case 'SELL':
        return { ...base, amountBRL: r.amountBRL ?? null, qtyBTC: r.qtyBTC != null ? -Math.abs(r.qtyBTC) : null, quoteSide: 'buy', quotePriceBRL: r.quotePriceBRL ?? null, unitPriceBRL: null };
      case 'REBOOK':
        return { ...base, amountBRL: null, qtyBTC: r.qtyBTC ?? null, quoteSide: null, quotePriceBRL: null, unitPriceBRL: r.quotePriceBRL ?? null };
      default:
        return { ...base } as any;
    }
  }

  // TZ helpers as private methods
  private startOfDayInTZ(date: Date, timeZone: string): Date {
    const targetYMD = getTZParts(date, timeZone);
    let guess = new Date(Date.UTC(targetYMD.y, targetYMD.m - 1, targetYMD.d, 0, 0, 0, 0));
    const p = getTZParts(guess, timeZone);
    guess = new Date(guess.getTime() - p.H * 3600_000 - p.M * 60_000 - p.S * 1_000);
    let local = getTZParts(guess, timeZone);
    const desired = { y: targetYMD.y, m: targetYMD.m, d: targetYMD.d };
    if (!ymdEqual({ y: local.y, m: local.m, d: local.d }, desired)) {
      const step = 24 * 3600_000;
      while (!ymdEqual({ y: local.y, m: local.m, d: local.d }, desired)) {
        const cmp = new Date(Date.UTC(local.y, local.m - 1, local.d)).getTime() - new Date(Date.UTC(desired.y, desired.m - 1, desired.d)).getTime();
        guess = new Date(guess.getTime() + (cmp < 0 ? step : -step));
        local = getTZParts(guess, timeZone);
      }
    }
    return guess;
  }

  private endOfDayInTZ(date: Date, timeZone: string): Date {
    const start = this.startOfDayInTZ(date, timeZone);
    return new Date(start.getTime() + 24 * 3600_000 - 1);
  }
}

// Helpers for TZ normalization (without external libs)
function getTZParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day'), H: get('hour'), M: get('minute'), S: get('second') };
}

function ymdEqual(a: { y: number; m: number; d: number }, b: { y: number; m: number; d: number }) {
  return a.y === b.y && a.m === b.m && a.d === b.d;
}
