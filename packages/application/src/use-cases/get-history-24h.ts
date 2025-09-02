export interface HistoryItemDTO {
  ts: string; // ISO-8601
  buy?: number | null;
  sell?: number | null;
  source?: string | null;
}

export interface HistoryDTO {
  timezone: string; // 'America/Sao_Paulo'
  slots: number; // 144
  startTs: string; // ISO of first slot
  endTs: string;   // ISO of last slot
  items: HistoryItemDTO[];
}

export interface IQuoteHistoryRepo {
  findSnapshots(from: Date, to: Date): Promise<Array<{ ts: Date; buy?: number | null; sell?: number | null; source?: string | null }>>;
}

export class GetHistory24hUseCase {
  constructor(private repo: IQuoteHistoryRepo, private tz: string = 'America/Sao_Paulo') {}

  async execute(now: Date = new Date()): Promise<HistoryDTO> {
    const end = floor10minInTZ(now, this.tz);
    // Include endTs and produce exactly 144 points equally spaced by 10 minutes.
    // First slot is endTs - 143*10min.
    const start = new Date(end.getTime() - 143 * 10 * 60 * 1000);
    const snaps = await this.repo.findSnapshots(start, end);
    const map = new Map<number, { buy?: number | null; sell?: number | null; source?: string | null }>();
    for (const s of snaps) map.set(s.ts.getTime(), { buy: s.buy ?? null, sell: s.sell ?? null, source: s.source ?? null });
    const items: HistoryItemDTO[] = [];
    let ts = start; // already aligned by construction
    for (let i = 0; i < 144; i++) {
      const key = ts.getTime();
      const found = map.get(key);
      items.push({ ts: ts.toISOString(), buy: found?.buy ?? null, sell: found?.sell ?? null, source: found?.source ?? null });
      ts = new Date(ts.getTime() + 10 * 60 * 1000);
    }
    return { timezone: this.tz, slots: 144, startTs: items[0].ts, endTs: items[items.length - 1].ts, items };
  }
}

function floor10minInTZ(date: Date, timeZone: string): Date {
  const p = getTZParts(date, timeZone);
  const flooredMin = Math.floor(p.M / 10) * 10;
  return toUTC({ y: p.y, m: p.m, d: p.d, H: p.H, M: flooredMin, S: 0, ms: 0 }, timeZone);
}

function startSlot(date: Date, timeZone: string): Date {
  // return first slot boundary >= date
  const p = getTZParts(date, timeZone);
  const flooredMin = Math.floor(p.M / 10) * 10;
  const candidate = toUTC({ y: p.y, m: p.m, d: p.d, H: p.H, M: flooredMin, S: 0, ms: 0 }, timeZone);
  // If candidate is before the original date, move to next slot
  if (candidate.getTime() < date.getTime()) {
    return new Date(candidate.getTime() + 10 * 60 * 1000);
  }
  return candidate;
}

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

function toUTC(p: { y: number; m: number; d: number; H: number; M: number; S: number; ms: number }, timeZone: string): Date {
  // Construct a date that when formatted in TZ yields the given parts.
  let guess = new Date(Date.UTC(p.y, p.m - 1, p.d, p.H, p.M, p.S, p.ms));
  let parts = getTZParts(guess, timeZone);
  const deltaMs = (p.H - parts.H) * 3600_000 + (p.M - parts.M) * 60_000 + (p.S - parts.S) * 1000;
  guess = new Date(guess.getTime() + deltaMs);
  // Ensure YMD matches; if not, adjust by whole days (handles DST edge cases)
  parts = getTZParts(guess, timeZone);
  const currentYMD = new Date(Date.UTC(parts.y, parts.m - 1, parts.d)).getTime();
  const desiredYMD = new Date(Date.UTC(p.y, p.m - 1, p.d)).getTime();
  const dayDelta = Math.round((desiredYMD - currentYMD) / (24 * 3600_000));
  if (dayDelta !== 0) guess = new Date(guess.getTime() + dayDelta * 24 * 3600_000);
  return guess;
}
