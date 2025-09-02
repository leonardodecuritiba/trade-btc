import { bankersRound2 } from '../../../shared/src/money';

export interface PositionDTO {
  positionId: string;
  openedAt: Date;
  qtyBTC: number; // 8d
  unitPriceBRL: number; // 2d
  investedBRL: number; // 2d
  currentPriceBRL: number; // 2d
  changePct: number; // 4d
  currentGrossBRL: number; // 2d
  priceTs: string; // ISO
}

export interface IPositionRepo {
  findOpenByUser(userId: string): Promise<Array<{ id: string; openedAt: Date; qtyBTC: number; unitPriceBRL: number }>>;
}

export interface IQuoteSellBuyService {
  getBuy(): Promise<{ priceBRL: number; ts: string }>;
}

function round4(n: number): number { return Math.round(n * 1e4) / 1e4; }

export class GetPositionsUseCase {
  constructor(private positions: IPositionRepo, private quotes: IQuoteSellBuyService) {}

  async execute(userId: string): Promise<PositionDTO[]> {
    const { priceBRL: buyPrice, ts } = await this.quotes.getBuy();
    const list = await this.positions.findOpenByUser(userId);
    // sort by openedAt asc
    list.sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
    return list.map(p => {
      const invested = bankersRound2(p.qtyBTC * p.unitPriceBRL);
      const currentGross = bankersRound2(p.qtyBTC * buyPrice);
      const changePct = p.unitPriceBRL > 0 ? round4((buyPrice - p.unitPriceBRL) / p.unitPriceBRL) : 0;
      return {
        positionId: p.id,
        openedAt: p.openedAt,
        qtyBTC: p.qtyBTC,
        unitPriceBRL: p.unitPriceBRL,
        investedBRL: invested,
        currentPriceBRL: buyPrice,
        changePct,
        currentGrossBRL: currentGross,
        priceTs: ts,
      };
    });
  }
}

