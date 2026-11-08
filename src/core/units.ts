import { DIMENSIONLESS, Dim, dim, sameDim } from './dimension';

export interface UnitDef {
  symbol: string;
  name: string;
  /** Multiply a value in this unit by `factor` to get SI base units. */
  factor: number;
  dim: Dim;
  prefixable: boolean;
}

const L = dim({ m: 1 });
const M = dim({ kg: 1 });
const T = dim({ s: 1 });

const N_ = dim({ kg: 1, m: 1, s: -2 });
const J_ = dim({ kg: 1, m: 2, s: -2 });
const W_ = dim({ kg: 1, m: 2, s: -3 });
const PA_ = dim({ kg: 1, m: -1, s: -2 });
const C_ = dim({ A: 1, s: 1 });
const V_ = dim({ kg: 1, m: 2, s: -3, A: -1 });
const OHM_ = dim({ kg: 1, m: 2, s: -3, A: -2 });

function u(symbol: string, name: string, factor: number, d: Dim, prefixable = true): UnitDef {
  return { symbol, name, factor, dim: d, prefixable };
}

const UNIT_LIST: UnitDef[] = [
  // SI base units (kilogram is handled as k + g)
  u('m', 'metre', 1, L),
  u('g', 'gram', 1e-3, M),
  u('s', 'second', 1, T),
  u('A', 'ampere', 1, dim({ A: 1 })),
  u('K', 'kelvin', 1, dim({ K: 1 })),
  u('mol', 'mole', 1, dim({ mol: 1 })),
  u('cd', 'candela', 1, dim({ cd: 1 })),
  // Named derived units
  u('N', 'newton', 1, N_),
  u('J', 'joule', 1, J_),
  u('W', 'watt', 1, W_),
  u('Pa', 'pascal', 1, PA_),
  u('Hz', 'hertz', 1, dim({ s: -1 })),
  u('C', 'coulomb', 1, C_),
  u('V', 'volt', 1, V_),
  u('Ω', 'ohm', 1, OHM_),
  u('ohm', 'ohm', 1, OHM_),
  u('F', 'farad', 1, dim({ kg: -1, m: -2, s: 4, A: 2 })),
  u('T', 'tesla', 1, dim({ kg: 1, s: -2, A: -1 })),
  u('Wb', 'weber', 1, dim({ kg: 1, m: 2, s: -2, A: -1 })),
  u('H', 'henry', 1, dim({ kg: 1, m: 2, s: -2, A: -2 })),
  // Everyday & homework units
  u('min', 'minute', 60, T, false),
  u('h', 'hour', 3600, T, false),
  u('day', 'day', 86400, T, false),
  u('yr', 'year', 365.25 * 86400, T, false),
  u('L', 'litre', 1e-3, dim({ m: 3 })),
  u('t', 'tonne', 1000, M, false),
  u('eV', 'electronvolt', 1.602176634e-19, J_),
  u('cal', 'calorie', 4.184, J_),
  u('Wh', 'watt-hour', 3600, J_),
  u('bar', 'bar', 1e5, PA_),
  u('atm', 'atmosphere', 101325, PA_, false),
  u('mmHg', 'millimetre of mercury', 133.322387415, PA_, false),
  u('ft', 'foot', 0.3048, L, false),
  u('mi', 'mile', 1609.344, L, false),
  u('mph', 'mile per hour', 0.44704, dim({ m: 1, s: -1 }), false),
  u('rad', 'radian', 1, DIMENSIONLESS, false),
  u('deg', 'degree', Math.PI / 180, DIMENSIONLESS, false),
  u('°', 'degree', Math.PI / 180, DIMENSIONLESS, false),
];

export const UNITS: ReadonlyMap<string, UnitDef> = new Map(UNIT_LIST.map((x) => [x.symbol, x]));

export const PREFIXES: ReadonlyArray<[string, number]> = [
  ['T', 1e12], ['G', 1e9], ['M', 1e6], ['k', 1e3], ['h', 1e2],
  ['d', 1e-1], ['c', 1e-2], ['m', 1e-3], ['µ', 1e-6], ['μ', 1e-6], ['u', 1e-6],
  ['n', 1e-9], ['p', 1e-12], ['f', 1e-15],
];

/** Resolves "km", "mA", "kWh", "µs"… Exact symbols win over prefix splits ("min" is minutes, not milli-inch). */
export function lookupUnit(symbol: string): UnitDef | undefined {
  const exact = UNITS.get(symbol);
  if (exact) return exact;
  for (const [p, f] of PREFIXES) {
    if (!symbol.startsWith(p) || symbol.length <= p.length) continue;
    const base = UNITS.get(symbol.slice(p.length));
    if (base && base.prefixable) {
      return { symbol, name: prefixName(p) + base.name, factor: f * base.factor, dim: base.dim, prefixable: false };
    }
  }
  return undefined;
}

function prefixName(p: string): string {
  const names: Record<string, string> = {
    T: 'tera', G: 'giga', M: 'mega', k: 'kilo', h: 'hecto', d: 'deci', c: 'centi',
    m: 'milli', µ: 'micro', μ: 'micro', u: 'micro', n: 'nano', p: 'pico', f: 'femto',
  };
  return names[p] ?? '';
}

/** Named units we prefer when displaying a result (in order of preference). */
export const DISPLAY_UNITS: ReadonlyArray<UnitDef> = ['N', 'J', 'W', 'Pa', 'C', 'V', 'Ω', 'F', 'T', 'Wb', 'H'].map(
  (s) => UNITS.get(s)!,
);

export function namedUnitFor(d: Dim): UnitDef | undefined {
  return DISPLAY_UNITS.find((x) => sameDim(x.dim, d));
}

export interface ConstantDef {
  value: number;
  dim: Dim;
  description: string;
}

export const CONSTANTS: ReadonlyMap<string, ConstantDef> = new Map<string, ConstantDef>([
  ['pi', { value: Math.PI, dim: DIMENSIONLESS, description: 'π' }],
  ['π', { value: Math.PI, dim: DIMENSIONLESS, description: 'π' }],
  ['g', { value: 9.80665, dim: dim({ m: 1, s: -2 }), description: 'standard gravity' }],
  ['c', { value: 299792458, dim: dim({ m: 1, s: -1 }), description: 'speed of light' }],
  ['G', { value: 6.6743e-11, dim: dim({ m: 3, kg: -1, s: -2 }), description: 'gravitational constant' }],
  ['h', { value: 6.62607015e-34, dim: dim({ kg: 1, m: 2, s: -1 }), description: 'Planck constant' }],
  ['k_B', { value: 1.380649e-23, dim: dim({ kg: 1, m: 2, s: -2, K: -1 }), description: 'Boltzmann constant' }],
  ['N_A', { value: 6.02214076e23, dim: dim({ mol: -1 }), description: 'Avogadro constant' }],
  ['R', { value: 8.314462618, dim: dim({ kg: 1, m: 2, s: -2, K: -1, mol: -1 }), description: 'gas constant' }],
  ['e', { value: 1.602176634e-19, dim: dim({ A: 1, s: 1 }), description: 'elementary charge' }],
  ['m_e', { value: 9.1093837015e-31, dim: dim({ kg: 1 }), description: 'electron mass' }],
  ['m_p', { value: 1.67262192369e-27, dim: dim({ kg: 1 }), description: 'proton mass' }],
  ['epsilon0', { value: 8.8541878128e-12, dim: dim({ kg: -1, m: -3, s: 4, A: 2 }), description: 'vacuum permittivity' }],
  ['mu0', { value: 1.25663706212e-6, dim: dim({ kg: 1, m: 1, s: -2, A: -2 }), description: 'vacuum permeability' }],
]);
