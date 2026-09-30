// Quantity is stored in MySQL as DECIMAL(18,4) and returned by the driver as string.
// Arithmetic runs in integer units (1/10000) via BigInt to avoid float precision loss.
export const QTY_SCALE = 10_000n;

export function toQtyUnits(value: string | number): bigint {
  const text = typeof value === 'number' ? value.toFixed(4) : value.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,4}))?$/.exec(text);

  if (!match) throw new Error(`Nilai kuantitas tidak valid: "${value}"`);

  const [, sign, whole, fraction = ''] = match;
  const units = BigInt(whole ?? '0') * QTY_SCALE + BigInt((fraction + '0000').slice(0, 4));
  return sign === '-' ? -units : units;
}

export function fromQtyUnits(units: bigint): string {
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const whole = absolute / QTY_SCALE;
  const fraction = (absolute % QTY_SCALE).toString().padStart(4, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}
