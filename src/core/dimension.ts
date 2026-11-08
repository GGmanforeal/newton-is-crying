/**
 * A physical dimension is a vector of exponents over the 7 SI base quantities.
 * Example: velocity = length¹ · time⁻¹  →  [1, 0, -1, 0, 0, 0, 0]
 */
export const BASE_SYMBOLS = ['m', 'kg', 's', 'A', 'K', 'mol', 'cd'] as const;
export const BASE_NAMES = [
  'length',
  'mass',
  'time',
  'electric current',
  'temperature',
  'amount of substance',
  'luminous intensity',
] as const;

export type BaseSymbol = (typeof BASE_SYMBOLS)[number];
export type Dim = readonly number[];

export const DIMENSIONLESS: Dim = Object.freeze([0, 0, 0, 0, 0, 0, 0]);

/** Exponents are rounded so that sqrt(m^2) is exactly m again. */
const clean = (x: number): number => {
  const r = Math.round(x * 1e9) / 1e9;
  return Object.is(r, -0) ? 0 : r;
};

export function dim(parts: Partial<Record<BaseSymbol, number>>): Dim {
  return BASE_SYMBOLS.map((s) => clean(parts[s] ?? 0));
}

export const mulDim = (a: Dim, b: Dim): Dim => a.map((x, i) => clean(x + b[i]));
export const divDim = (a: Dim, b: Dim): Dim => a.map((x, i) => clean(x - b[i]));
export const powDim = (a: Dim, n: number): Dim => a.map((x) => clean(x * n));
export const sameDim = (a: Dim, b: Dim): boolean => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
export const isDimensionless = (a: Dim): boolean => sameDim(a, DIMENSIONLESS);

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '.': '·',
};

const FRACTIONS: Array<[number, string]> = [
  [0.5, '½'], [1 / 3, '⅓'], [2 / 3, '⅔'], [0.25, '¼'], [0.75, '¾'],
];

/** Formats an exponent as a superscript: 2 → "²", -1 → "⁻¹", 0.5 → "½". */
export function superscript(n: number): string {
  const sign = n < 0 ? '⁻' : '';
  const abs = Math.abs(n);
  const whole = Math.floor(abs + 1e-9);
  const frac = abs - whole;
  if (frac > 1e-6) {
    const f = FRACTIONS.find(([v]) => Math.abs(v - frac) < 1e-6);
    if (f) return sign + (whole > 0 ? String(whole).split('').map((c) => SUPERSCRIPT[c]).join('') : '') + f[1];
    return '^' + String(Number(n.toFixed(3)));
  }
  return sign + String(whole).split('').map((c) => SUPERSCRIPT[c] ?? c).join('');
}

/** "kg·m/s²" style formatting using only base units. */
export function formatDimBase(d: Dim): string {
  if (isDimensionless(d)) return '1';
  const num: string[] = [];
  const den: string[] = [];
  // kg first reads more naturally (kg·m/s²)
  const order = [1, 0, 2, 3, 4, 5, 6];
  for (const i of order) {
    const e = d[i];
    if (Math.abs(e) < 1e-9) continue;
    const sym = BASE_SYMBOLS[i];
    const abs = Math.abs(e);
    const part = Math.abs(abs - 1) < 1e-9 ? sym : sym + superscript(abs);
    (e > 0 ? num : den).push(part);
  }
  const top = num.length ? num.join('·') : '1';
  if (!den.length) return top;
  return `${top}/${den.length > 1 ? den.join('·') : den[0]}`;
}

/** Plain-English description, e.g. "length per time²". */
export function describeDim(d: Dim): string {
  if (isDimensionless(d)) return 'a pure number';
  const num: string[] = [];
  const den: string[] = [];
  d.forEach((e, i) => {
    if (Math.abs(e) < 1e-9) return;
    const abs = Math.abs(e);
    const part = Math.abs(abs - 1) < 1e-9 ? BASE_NAMES[i] : BASE_NAMES[i] + superscript(abs);
    (e > 0 ? num : den).push(part);
  });
  const top = num.length ? num.join(' × ') : '1';
  return den.length ? `${top} per ${den.join(' × ')}` : top;
}
