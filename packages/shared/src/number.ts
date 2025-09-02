export function truncate8(n: number): number {
  const factor = 1e8;
  return Math.trunc(n * factor) / factor;
}

export function ceil8(n: number): number {
  const factor = 1e8;
  return Math.ceil(n * factor) / factor;
}
