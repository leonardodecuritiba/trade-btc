export function bankersRound2(n: number): number {
  const factor = 100;
  const scaled = n * factor;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  const isHalf = Math.abs(diff - 0.5) < 1e-10;
  if (isHalf) {
    const rounded = (floor % 2 === 0) ? floor : floor + 1;
    return rounded / factor;
  }
  return Math.round(scaled) / factor;
}

