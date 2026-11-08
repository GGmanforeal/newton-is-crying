import {
  DIMENSIONLESS, Dim, dim, describeDim, divDim, formatDimBase, isDimensionless, mulDim, powDim, sameDim,
} from './dimension';
import type { Node, UnitExpr } from './parser';
import { CONSTANTS, lookupUnit } from './units';

/** A value in SI base units plus its dimension. `value` is NaN for symbolic quantities. */
export interface Quantity {
  value: number;
  dim: Dim;
  /** The unit the user typed, kept for nicer display ("120 km" instead of "120000 m"). */
  display?: UnitExpr;
}

export type ErrorKind =
  | 'syntax'
  | 'unknown-name'
  | 'add-mismatch'
  | 'function-arg'
  | 'exponent-units'
  | 'expect-mismatch'
  | 'convert-mismatch'
  | 'equation-mismatch';

export class NewtonError extends Error {
  constructor(
    public kind: ErrorKind,
    message: string,
    public hint?: string,
    public pos?: number,
    /** Values for the scientist's roast template ({a}, {b}, {got}…). */
    public vars: Record<string, string> = {},
  ) {
    super(message);
  }
}

export interface Scope {
  get(name: string): Quantity | undefined;
}

export interface EvalResult {
  q: Quantity;
  warnings: string[];
}

export function evaluate(node: Node, scope: Scope): EvalResult {
  const warnings: string[] = [];
  const q = ev(node, scope, warnings);
  return { q, warnings };
}

function ev(n: Node, scope: Scope, warnings: string[]): Quantity {
  switch (n.k) {
    case 'num':
      return n.unit
        ? { value: n.value * n.unit.factor, dim: n.unit.dim, display: n.unit }
        : { value: n.value, dim: DIMENSIONLESS };
    case 'var': {
      const v = scope.get(n.name);
      if (v) return v;
      const c = CONSTANTS.get(n.name);
      if (c) return { value: c.value, dim: c.dim };
      const u = lookupUnit(n.name);
      if (u) return { value: u.factor, dim: u.dim };
      throw new NewtonError(
        'unknown-name',
        `"${n.name}" is not defined.`,
        `Define it first, e.g. "${n.name} = 5 m", or declare it with "${n.name} : m/s".`,
        n.pos,
        { name: n.name },
      );
    }
    case 'neg': {
      const e = ev(n.e, scope, warnings);
      return { value: -e.value, dim: e.dim };
    }
    case 'bin': {
      const a = ev(n.l, scope, warnings);
      const b = ev(n.r, scope, warnings);
      switch (n.op) {
        case '+':
        case '-':
          if (!sameDim(a.dim, b.dim)) {
            const verb = n.op === '+' ? 'add' : 'subtract';
            throw new NewtonError(
              'add-mismatch',
              `You can't ${verb} ${unitName(b.dim)} ${n.op === '+' ? 'to' : 'from'} ${unitName(a.dim)}.`,
              diffHint(a.dim, b.dim, 'the left part', 'the right part'),
              n.pos,
              { a: shortName(a.dim), b: shortName(b.dim) },
            );
          }
          return { value: n.op === '+' ? a.value + b.value : a.value - b.value, dim: a.dim };
        case '*':
          return { value: a.value * b.value, dim: mulDim(a.dim, b.dim) };
        case '/':
          if (b.value === 0) warnings.push('Division by zero — the universe is not amused.');
          return { value: a.value / b.value, dim: divDim(a.dim, b.dim) };
      }
      break;
    }
    case 'pow': {
      const base = ev(n.base, scope, warnings);
      const exp = ev(n.exp, scope, warnings);
      if (!isDimensionless(exp.dim)) {
        throw new NewtonError(
          'exponent-units',
          `An exponent can't have units — this one is in ${unitName(exp.dim)}.`,
          'Exponents must be pure numbers. Check what you put after "^".',
          n.pos,
          { got: shortName(exp.dim) },
        );
      }
      if (Number.isNaN(exp.value) && !isDimensionless(base.dim)) {
        throw new NewtonError('exponent-units', 'The exponent has no numeric value, so the units of the result are unknown.', undefined, n.pos);
      }
      return { value: Math.pow(base.value, exp.value), dim: powDim(base.dim, exp.value) };
    }
    case 'call':
      return call(n.name, n.args.map((a) => ev(a, scope, warnings)), n.pos, warnings, n.args);
  }
  throw new Error('unreachable');
}

const TRIG = new Set(['sin', 'cos', 'tan']);
const NEEDS_DIMENSIONLESS = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'exp', 'ln', 'log', 'log10']);

function call(name: string, args: Quantity[], pos: number, warnings: string[], argNodes: Node[]): Quantity {
  if (args.length !== 1) {
    throw new NewtonError('function-arg', `${name}() takes exactly one argument.`, undefined, pos);
  }
  const [x] = args;
  if (NEEDS_DIMENSIONLESS.has(name) && !isDimensionless(x.dim)) {
    throw new NewtonError(
      'function-arg',
      `${name}() needs a pure number, but got ${unitName(x.dim)}.`,
      name === 'exp' || name.startsWith('log') || name === 'ln'
        ? 'Logs and exponentials only make sense for ratios. Divide by a reference value first.'
        : 'Trig functions take angles (pure numbers). Did you mix up a length and an angle?',
      pos,
      { fn: `${name}()`, got: shortName(x.dim) },
    );
  }
  const arg = argNodes[0];
  if (TRIG.has(name) && arg.k === 'num' && !arg.unit && Math.abs(arg.value) > 2 * Math.PI) {
    warnings.push(`${name}(${arg.value}) uses radians. Did you mean ${name}(${arg.value} deg)?`);
  }
  const v = x.value;
  switch (name) {
    case 'sqrt':
      if (v < 0) warnings.push('Square root of a negative number — imaginary physics detected.');
      return { value: Math.sqrt(v), dim: powDim(x.dim, 0.5) };
    case 'cbrt':
      return { value: Math.cbrt(v), dim: powDim(x.dim, 1 / 3) };
    case 'abs':
      return { value: Math.abs(v), dim: x.dim };
    case 'sin': return { value: Math.sin(v), dim: DIMENSIONLESS };
    case 'cos': return { value: Math.cos(v), dim: DIMENSIONLESS };
    case 'tan': return { value: Math.tan(v), dim: DIMENSIONLESS };
    case 'asin': return { value: Math.asin(v), dim: DIMENSIONLESS };
    case 'acos': return { value: Math.acos(v), dim: DIMENSIONLESS };
    case 'atan': return { value: Math.atan(v), dim: DIMENSIONLESS };
    case 'exp': return { value: Math.exp(v), dim: DIMENSIONLESS };
    case 'ln':
    case 'log': return { value: Math.log(v), dim: DIMENSIONLESS };
    case 'log10': return { value: Math.log10(v), dim: DIMENSIONLESS };
  }
  throw new NewtonError('unknown-name', `Unknown function ${name}().`, undefined, pos);
}

/** "force" if the dimension has a common name, otherwise "kg·m/s²". */
export function shortName(d: Dim): string {
  if (isDimensionless(d)) return 'a pure number';
  const known = QUANTITY_NAMES.find(([qd]) => sameDim(qd, d));
  return known ? known[1] : formatDimBase(d);
}

/** "kg·m/s² (force)" — short human label for a dimension. */
export function unitName(d: Dim): string {
  if (isDimensionless(d)) return 'a pure number';
  const known = QUANTITY_NAMES.find(([qd]) => sameDim(qd, d));
  return known ? `${known[1]} (${formatDimBase(d)})` : formatDimBase(d);
}

const QUANTITY_NAMES: Array<[Dim, string]> = [
  [dim({ m: 1 }), 'length'],
  [dim({ kg: 1 }), 'mass'],
  [dim({ s: 1 }), 'time'],
  [dim({ m: 2 }), 'area'],
  [dim({ m: 3 }), 'volume'],
  [dim({ m: 1, s: -1 }), 'speed'],
  [dim({ m: 1, s: -2 }), 'acceleration'],
  [dim({ kg: 1, m: 1, s: -2 }), 'force'],
  [dim({ kg: 1, m: 1, s: -1 }), 'momentum'],
  [dim({ kg: 1, m: 2, s: -2 }), 'energy'],
  [dim({ kg: 1, m: 2, s: -3 }), 'power'],
  [dim({ kg: 1, m: -1, s: -2 }), 'pressure'],
  [dim({ kg: 1, m: -3 }), 'density'],
  [dim({ s: -1 }), 'frequency'],
  [dim({ A: 1, s: 1 }), 'charge'],
  [dim({ A: 1 }), 'current'],
  [dim({ kg: 1, m: 2, s: -3, A: -1 }), 'voltage'],
  [dim({ kg: 1, m: 2, s: -3, A: -2 }), 'resistance'],
  [dim({ K: 1 }), 'temperature'],
];

/**
 * Explains how two dimensions differ, e.g. "the left part has an extra factor of s
 * (time) compared to the right part — did you forget to divide by a time?"
 */
export function diffHint(a: Dim, b: Dim, aLabel: string, bLabel: string): string {
  const ratio = divDim(a, b);
  const extra = ratio.map((x) => Math.max(x, 0));
  const missing = ratio.map((x) => Math.max(-x, 0));
  const hasExtra = !isDimensionless(extra);
  const hasMissing = !isDimensionless(missing);
  if (hasExtra && !hasMissing) {
    return `${cap(aLabel)} has an extra factor of ${formatDimBase(extra)} (${describeDim(extra)}) compared to ${bLabel}. Did you forget to divide by ${article(describeDim(extra))}?`;
  }
  if (hasMissing && !hasExtra) {
    return `${cap(aLabel)} is missing a factor of ${formatDimBase(missing)} (${describeDim(missing)}) compared to ${bLabel}. Did you forget to multiply by ${article(describeDim(missing))}?`;
  }
  return `They differ by a factor of ${formatDimBase(ratio)} — these are just different kinds of quantity.`;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const article = (s: string) => (/^[aeiou]/.test(s) ? `an ${s}` : `a ${s}`);
