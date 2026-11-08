import { DIMENSIONLESS, formatDimBase, sameDim } from './dimension';
import { ErrorKind, NewtonError, Quantity, diffHint, evaluate, shortName, unitName } from './evaluate';
import { formatNumber, formatQuantity, prettyUnit } from './format';
import { SyntaxError_ } from './lexer';
import { Statement, parseLine } from './parser';
import { Roast, roastFor } from './roasts';

export type LineStatus = 'blank' | 'ok' | 'error' | 'skipped';

export interface LineResult {
  /** 1-based line number */
  line: number;
  source: string;
  status: LineStatus;
  /** Short output for the gutter, e.g. "60 km/h" or "✓ balanced". */
  output?: string;
  /** Extra detail, e.g. "speed · 16.67 m/s". */
  detail?: string;
  error?: { kind: ErrorKind; message: string; hint?: string; column?: number };
  warnings: string[];
  roast?: Roast;
}

export interface NotebookResult {
  lines: LineResult[];
  errors: number;
  warnings: number;
  /** 0 (dry) … 5 (Newton is sobbing) */
  tears: number;
  verdict: Roast;
}

/**
 * Runs a whole homework sheet line by line. Variables defined on earlier lines are
 * visible on later lines, exactly like working through a problem on paper.
 */
export function runNotebook(text: string): NotebookResult {
  const scope = new Map<string, Quantity>();
  const symbols = new Set<string>();
  const failed = new Set<string>();
  const ctx = {
    isVariable: (n: string) => scope.has(n) && !symbols.has(n),
    isSymbol: (n: string) => symbols.has(n),
  };
  const lines: LineResult[] = text.replace(/\r?\n$/, '').split(/\n/).map((raw, idx) => {
    const source = raw.replace(/\r$/, '');
    const base: LineResult = { line: idx + 1, source, status: 'ok', warnings: [] };
    let stmt: Statement;
    try {
      stmt = parseLine(source, ctx);
    } catch (e) {
      if (e instanceof SyntaxError_ || e instanceof NewtonError) {
        return withError(base, new NewtonError('syntax', e.message, 'Check the brackets and operators on this line.', e instanceof SyntaxError_ ? e.pos : undefined));
      }
      throw e;
    }
    try {
      return runStatement(stmt, base, scope, symbols, failed);
    } catch (e) {
      if (!(e instanceof NewtonError)) throw e;
      if (stmt.k === 'assign') failed.add(stmt.name);
      if (e.kind === 'unknown-name' && failed.has(e.vars.name)) {
        return { ...base, status: 'skipped', output: `needs ${e.vars.name}`, detail: `"${e.vars.name}" had an error on an earlier line. Fix that first.` };
      }
      return withError(base, e);
    }
  });

  const errors = lines.filter((l) => l.status === 'error').length;
  const warnings = lines.reduce((n, l) => n + l.warnings.length, 0);
  const firstError = lines.find((l) => l.roast);
  return {
    lines,
    errors,
    warnings,
    tears: Math.min(5, errors),
    verdict: firstError?.roast ?? roastFor('success', text.trim()),
  };
}

function withError(base: LineResult, e: NewtonError): LineResult {
  return {
    ...base,
    status: 'error',
    output: 'units error',
    error: { kind: e.kind, message: e.message, hint: e.hint, column: e.pos },
    roast: roastFor(e.kind, base.source, e.vars),
  };
}

function runStatement(
  stmt: Statement,
  base: LineResult,
  scope: Map<string, Quantity>,
  symbols: Set<string>,
  failed: Set<string>,
): LineResult {
  switch (stmt.k) {
    case 'empty':
      return { ...base, status: 'blank' };

    case 'declare': {
      scope.set(stmt.name, { value: NaN, dim: stmt.unit.dim });
      symbols.add(stmt.name);
      failed.delete(stmt.name);
      return { ...base, output: `${stmt.name} : ${prettyUnit(stmt.unit.text)}`, detail: `${unitName(stmt.unit.dim)} — symbolic` };
    }

    case 'assign':
    case 'expr': {
      const { q, warnings } = evaluate(stmt.expr, scope);
      if (stmt.k === 'assign') {
        scope.set(stmt.name, q);
        failed.delete(stmt.name);
      }
      if (stmt.convert && !sameDim(stmt.convert.dim, q.dim)) {
        throw new NewtonError(
          'convert-mismatch',
          `Can't convert ${unitName(q.dim)} to ${prettyUnit(stmt.convert.text)} (${shortName(stmt.convert.dim)}).`,
          diffHint(q.dim, stmt.convert.dim, 'your result', `"${stmt.convert.text}"`),
          undefined,
          { from: shortName(q.dim), to: shortName(stmt.convert.dim) },
        );
      }
      if (stmt.expect && !sameDim(stmt.expect.dim, q.dim)) {
        throw new NewtonError(
          'expect-mismatch',
          `You expected ${prettyUnit(stmt.expect.text)} (${shortName(stmt.expect.dim)}), but this is ${unitName(q.dim)}.`,
          diffHint(q.dim, stmt.expect.dim, 'your result', 'what you expected'),
          undefined,
          { expected: shortName(stmt.expect.dim), got: shortName(q.dim) },
        );
      }
      const f = formatQuantity(q, stmt.convert ?? stmt.expect);
      const prefix = stmt.k === 'assign' ? `${stmt.name} = ` : '';
      const kind = sameDim(q.dim, DIMENSIONLESS) ? 'pure number' : shortName(q.dim);
      return {
        ...base,
        output: prefix + f.main,
        detail: [kind, f.si].filter(Boolean).join(' · '),
        warnings,
      };
    }

    case 'equation': {
      const l = evaluate(stmt.left, scope);
      const r = evaluate(stmt.right, scope);
      const warnings = [...l.warnings, ...r.warnings];
      if (!sameDim(l.q.dim, r.q.dim)) {
        throw new NewtonError(
          'equation-mismatch',
          `The two sides don't match: left is ${unitName(l.q.dim)}, right is ${unitName(r.q.dim)}.`,
          diffHint(l.q.dim, r.q.dim, 'the left side', 'the right side'),
          undefined,
          { left: shortName(l.q.dim), right: shortName(r.q.dim) },
        );
      }
      const lv = l.q.value;
      const rv = r.q.value;
      if (Number.isFinite(lv) && Number.isFinite(rv)) {
        const scale = Math.max(Math.abs(lv), Math.abs(rv), 1e-300);
        if (Math.abs(lv - rv) / scale > 1e-6) {
          warnings.push(`Units match, but the numbers don't: ${formatNumber(lv)} ≠ ${formatNumber(rv)} (in SI).`);
        }
      }
      return {
        ...base,
        output: 'balanced ⚖',
        detail: `both sides: ${sameDim(l.q.dim, DIMENSIONLESS) ? 'pure number' : `${shortName(l.q.dim)} (${formatDimBase(l.q.dim)})`}`,
        warnings,
      };
    }
  }
}
