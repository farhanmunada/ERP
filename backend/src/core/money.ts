// Money is stored in MySQL as DECIMAL(18,2) and returned by the driver as string.
// To avoid float precision loss we do arithmetic in integer minor units (cents) via BigInt.
const MINOR_UNITS_PER_MAJOR = 100n;

export function toMinorUnits(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') return value * MINOR_UNITS_PER_MAJOR;

  const text = typeof value === 'number' ? value.toFixed(2) : value.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);

  if (!match) {
    throw new Error(`Nilai uang tidak valid: "${value}"`);
  }

  const [, sign, whole, fraction = ''] = match;
  const cents = BigInt(whole ?? '0') * MINOR_UNITS_PER_MAJOR + BigInt((fraction + '00').slice(0, 2));
  return sign === '-' ? -cents : cents;
}

export function fromMinorUnits(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const whole = absolute / MINOR_UNITS_PER_MAJOR;
  const fraction = (absolute % MINOR_UNITS_PER_MAJOR).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

export function sumMinorUnits(values: readonly (string | number | bigint)[]): bigint {
  return values.reduce<bigint>((total, value) => total + toMinorUnits(value), 0n);
}
