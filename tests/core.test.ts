import { describe, expect, it } from 'vitest';
import {
  dim, formatDimBase, formatNumber, lookupUnit, parseLine, parseUnit, runNotebook, sameDim, tokenize, superscript,
} from '../src/core';

const one = (src: string) => runNotebook(src).lines[0];
const last = (src: string) => {
  const r = runNotebook(src).lines;
  return r[r.length - 1];
};

describe('dimensions', () => {
  it('formats base dimensions readably', () => {
    expect(formatDimBase(dim({ kg: 1, m: 1, s: -2 }))).toBe('kg·m/s²');
    expect(formatDimBase(dim({ m: 1, s: -1 }))).toBe('m/s');
    expect(formatDimBase(dim({ s: -1 }))).toBe('1/s');
    expect(formatDimBase(dim({ kg: 1, m: -1, s: -2 }))).toBe('kg/m·s²');
  });
  it('formats fractional exponents', () => {
    expect(superscript(0.5)).toBe('½');
    expect(superscript(-2)).toBe('⁻²');
  });
});

describe('units', () => {
  it('resolves prefixes', () => {
    expect(lookupUnit('km')!.factor).toBe(1000);
    expect(lookupUnit('kg')!.factor).toBe(1);
    expect(lookupUnit('mA')!.factor).toBeCloseTo(1e-3);
    expect(lookupUnit('µs')!.factor).toBeCloseTo(1e-6);
    expect(lookupUnit('kWh')!.factor).toBe(3.6e6);
  });
  it('prefers exact symbols over prefix splits', () => {
    expect(lookupUnit('min')!.name).toBe('minute');
    expect(lookupUnit('h')!.name).toBe('hour');
    expect(lookupUnit('Pa')!.name).toBe('pascal');
    expect(lookupUnit('mol')!.name).toBe('mole');
  });
  it('rejects prefixes on non-prefixable units', () => {
    expect(lookupUnit('kmin')).toBeUndefined();
    expect(lookupUnit('banana')).toBeUndefined();
  });
  it('parses compound unit expressions', () => {
    const u = parseUnit('km/h');
    expect(u.factor).toBeCloseTo(1000 / 3600);
    expect(sameDim(u.dim, dim({ m: 1, s: -1 }))).toBe(true);
    expect(sameDim(parseUnit('kg*m/s^2').dim, parseUnit('N').dim)).toBe(true);
    expect(sameDim(parseUnit('kg m s^-2').dim, parseUnit('N').dim)).toBe(true);
    expect(sameDim(parseUnit('1/s').dim, parseUnit('Hz').dim)).toBe(true);
  });
});

describe('lexer', () => {
  it('turns superscripts and fancy operators into plain tokens', () => {
    const texts = tokenize('3 m·s⁻² × 2').map((t) => t.text);
    expect(texts).toEqual(['3', 'm', '*', 's', '^', '-2', '*', '2', '']);
  });
  it('reads scientific notation', () => {
    expect(tokenize('6.02e23')[0].value).toBe(6.02e23);
    expect(tokenize('1.6E-19')[0].value).toBeCloseTo(1.6e-19);
  });
  it('ignores comments', () => {
    expect(tokenize('# hello').length).toBe(1);
    expect(tokenize('2 m // note').length).toBe(3);
  });
});

describe('parser', () => {
  it('recognises statement types', () => {
    expect(parseLine('').k).toBe('empty');
    expect(parseLine('v : m/s').k).toBe('declare');
    expect(parseLine('x = 3 m').k).toBe('assign');
    expect(parseLine('3 m + 2 m').k).toBe('expr');
    expect(parseLine('2*x = 4 m').k).toBe('equation');
  });
  it('treats the word after a number as a unit', () => {
    const s = parseLine('9.8 m/s^2');
    expect(s.k).toBe('expr');
    if (s.k === 'expr' && s.expr.k === 'num') expect(s.expr.unit?.text).toBe('m/s^2');
  });
  it('rejects two equals signs', () => {
    expect(() => parseLine('a = b = c')).toThrow(/One "="/);
  });
});

describe('evaluation', () => {
  it('converts km/h to m/s', () => {
    const r = last('d = 120 km\nt = 2 h\nv = d / t -> m/s');
    expect(r.status).toBe('ok');
    expect(r.output).toBe('v = 16.67 m/s');
  });
  it('keeps the unit you typed for display', () => {
    expect(one('d = 120 km').output).toBe('d = 120 km');
    expect(one('d = 120 km').detail).toContain('120000 m');
  });
  it('names derived units', () => {
    expect(last('m = 2 kg\na = 3 m/s^2\nF = m*a').output).toBe('F = 6 N');
    expect(one('0.5 * 2 kg * (3 m/s)^2').output).toBe('9 J');
  });
  it('a number before a variable name still reads the unit (3 m is metres even if m is a mass)', () => {
    expect(last('m = 5 kg\nd = 3 m').output).toBe('d = 3 m');
  });
  it('later identifiers prefer variables over units', () => {
    expect(last('t = 2 s\nx = 10 m / t').output).toBe('x = 5 m/s');
  });
  it('supports implicit multiplication', () => {
    expect(last('r = 2 m\nC = 2 pi r').output).toBe('C = 12.57 m');
  });
  it('supports constants', () => {
    expect(one('E = 1 kg * c^2').output).toBe('E = 8.988 × 10¹⁶ J');
    expect(one('W = 10 kg * g').output).toBe('W = 98.07 N');
    expect(one('m = 10 kg*g').output).toBe('m = 10 kg·g');
    expect(one('v = 60 km / h -> m/s').output).toBe('v = 16.67 m/s');
  });
  it('supports sqrt and powers with units', () => {
    expect(last('A = 16 m^2\nside = sqrt(A)').output).toBe('side = 4 m');
    expect(one('(2 s)^-1').output).toBe('0.5 1/s');
  });
  it('accepts unicode superscripts', () => {
    expect(one('a = 9.8 m/s²').output).toBe('a = 9.8 m/s²');
  });
});

describe('unit errors (the fun part)', () => {
  it('refuses to add metres and seconds, with a hint', () => {
    const r = one('3 m + 2 s');
    expect(r.status).toBe('error');
    expect(r.error!.kind).toBe('add-mismatch');
    expect(r.error!.message).toMatch(/can't add time \(s\) to length \(m\)/);
    expect(r.roast).toBeDefined();
    expect(r.roast!.text).not.toContain('???');
  });
  it('explains what factor is missing', () => {
    const r = last('d = 5 m\nv = 2 m/s\nx = d + v');
    expect(r.error!.hint).toMatch(/extra factor of s \(time\)/);
    expect(one('3 m + 2 s').error!.hint).toMatch(/different kinds of quantity/);
  });
  it('checks an expected unit', () => {
    const r = last('d = 100 m\nt = 10 s\nv = d / t^2 [m/s]');
    expect(r.error!.kind).toBe('expect-mismatch');
    expect(r.error!.hint).toMatch(/missing a factor of s/);
  });
  it('rejects trig of a length', () => {
    expect(one('sin(3 m)').error!.kind).toBe('function-arg');
  });
  it('warns about degrees vs radians', () => {
    const r = one('sin(30)');
    expect(r.status).toBe('ok');
    expect(r.warnings[0]).toMatch(/30 deg/);
    expect(one('sin(30 deg)').output).toBe('0.5');
  });
  it('rejects exponents with units', () => {
    expect(one('2^(3 m)').error!.kind).toBe('exponent-units');
  });
  it('rejects impossible conversions', () => {
    expect(one('5 kg -> m').error!.kind).toBe('convert-mismatch');
  });
  it('reports unknown names', () => {
    expect(one('x = y + 2').error!.kind).toBe('unknown-name');
  });
  it('reports syntax errors with a roast', () => {
    const r = one('3 * (2 m');
    expect(r.error!.kind).toBe('syntax');
    expect(r.roast).toBeDefined();
  });
  it('does not cascade errors to later lines', () => {
    const lines = runNotebook('x = 3 m + 2 s\ny = 2 * x').lines;
    expect(lines[0].status).toBe('error');
    expect(lines[1].status).toBe('skipped');
  });
});

describe('symbolic formula checking', () => {
  it('accepts a dimensionally correct formula', () => {
    const r = last('v : m/s\nu : m/s\na : m/s^2\ns : m\nv^2 = u^2 + 2*a*s');
    expect(r.status).toBe('ok');
    expect(r.output).toBe('balanced ⚖');
  });
  it('rejects a broken formula', () => {
    const r = last('v : m/s\na : m/s^2\nt : s\nv = a*t^2');
    expect(r.status).toBe('error');
    expect(r.error!.kind).toBe('equation-mismatch');
    expect(r.error!.hint).toMatch(/missing a factor of s \(time\)/);
  });
  it('catches inconsistent sums inside a formula', () => {
    const r = last('v : m/s\nu : m/s\na : m/s^2\nt : s\nv = u + a*t^2');
    expect(r.error!.kind).toBe('add-mismatch');
  });
  it('flags numeric mismatches even when units agree', () => {
    const r = one('2 m + 3 m = 6 m');
    expect(r.status).toBe('ok');
    expect(r.warnings[0]).toMatch(/numbers don't/);
  });
});

describe('notebook summary', () => {
  it('counts tears', () => {
    const r = runNotebook('3 m + 2 s\nsin(2 kg)\n5 kg -> m');
    expect(r.errors).toBe(3);
    expect(r.tears).toBe(3);
    expect(r.verdict.mood).not.toBe('proud');
  });
  it('is proud when everything is right', () => {
    const r = runNotebook('F = 2 kg * 3 m/s^2');
    expect(r.errors).toBe(0);
    expect(r.verdict.mood).toBe('proud');
  });
  it('is deterministic', () => {
    expect(runNotebook('3 m + 2 s').verdict.text).toBe(runNotebook('3 m + 2 s').verdict.text);
  });
});

describe('number formatting', () => {
  it('uses scientific notation for extremes', () => {
    expect(formatNumber(6.02214076e23)).toBe('6.022 × 10²³');
    expect(formatNumber(1.6e-19)).toBe('1.6 × 10⁻¹⁹');
    expect(formatNumber(12.3456)).toBe('12.35');
    expect(formatNumber(0)).toBe('0');
  });
});
