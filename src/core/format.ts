import { formatDimBase, isDimensionless, sameDim } from './dimension';
import type { Quantity } from './evaluate';
import type { UnitExpr } from './parser';
import { namedUnitFor } from './units';

const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '.': '·',
};

/** "m/s^2" → "m/s²", "kg*m" → "kg·m" */
export function prettyUnit(text: string): string {
  return text
    .replace(/\^(-?[0-9.]+)/g, (_, e: string) => (e === '0.5' ? '½' : e.split('').map((c) => SUP[c] ?? c).join('')))
    .replace(/\*/g, '·');
}

/** 4 significant digits; scientific notation (×10ⁿ) for very large/small values. */
export function formatNumber(v: number): string {
  if (Number.isNaN(v)) return '?';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e6 || abs < 1e-3) {
    const exp = Math.floor(Math.log10(abs));
    let mant = Number((v / Math.pow(10, exp)).toPrecision(4));
    let e = exp;
    if (Math.abs(mant) >= 10) {
      mant /= 10;
      e += 1;
    }
    const expStr = String(e).split('').map((c) => SUP[c] ?? c).join('');
    return `${mant} × 10${expStr}`;
  }
  return String(Number(v.toPrecision(4)));
}

export interface FormattedQuantity {
  /** Main display, e.g. "60 km/h" */
  main: string;
  /** Alternative SI form, e.g. "16.67 m/s", if different from main. */
  si?: string;
}

/** Best SI display: a named unit (N, J, W…) if one fits, otherwise base units. */
export function formatSI(q: Quantity): string {
  if (isDimensionless(q.dim)) return formatNumber(q.value);
  const named = namedUnitFor(q.dim);
  const unit = named ? named.symbol : formatDimBase(q.dim);
  if (Number.isNaN(q.value)) return unit;
  return `${formatNumber(q.value)} ${unit}`;
}

export function formatQuantity(q: Quantity, convert?: UnitExpr): FormattedQuantity {
  const si = formatSI(q);
  const target = convert ?? (q.display && sameDim(q.display.dim, q.dim) ? q.display : undefined);
  if (!target || Number.isNaN(q.value)) return { main: si };
  const main = `${formatNumber(q.value / target.factor)} ${prettyUnit(target.text)}`;
  return main === si ? { main } : { main, si };
}
