import { truncate8 } from '../../../shared/src/number';

export interface DailyVolumeDTO {
  date: string; // YYYY-MM-DD in America/Sao_Paulo
  timezone: string; // 'America/Sao_Paulo'
  boughtBTC: number; // 8d
  soldBTC: number;   // 8d
}

export interface IDailyVolumeRepo {
  sumQtyBTC(where: { type: 'BUY' | 'SELL'; from: Date; to: Date }): Promise<number>;
}

export class GetDailyVolumeUseCase {
  constructor(private repo: IDailyVolumeRepo, private tz: string = 'America/Sao_Paulo') {}

  async execute(now: Date = new Date()): Promise<DailyVolumeDTO> {
    const start = this.startOfDayInTZ(now, this.tz);
    const end = this.endOfDayInTZ(now, this.tz);
    const boughtRaw = await this.repo.sumQtyBTC({ type: 'BUY', from: start, to: end });
    const soldRaw = await this.repo.sumQtyBTC({ type: 'SELL', from: start, to: end });
    const boughtBTC = truncate8(boughtRaw || 0);
    const soldBTC = truncate8(Math.abs(soldRaw || 0));
    const date = this.formatDateTZ(now, this.tz);
    return { date, timezone: this.tz, boughtBTC, soldBTC };
  }

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

  private formatDateTZ(date: Date, timeZone: string): string {
    const p = getTZParts(date, timeZone);
    const mm = String(p.m).padStart(2, '0');
    const dd = String(p.d).padStart(2, '0');
    return `${p.y}-${mm}-${dd}`;
  }
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

function ymdEqual(a: { y: number; m: number; d: number }, b: { y: number; m: number; d: number }) {
  return a.y === b.y && a.m === b.m && a.d === b.d;
}

