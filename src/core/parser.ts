import { DIMENSIONLESS, Dim, divDim, mulDim, powDim } from './dimension';
import { SyntaxError_, Token, tokenize } from './lexer';
import { CONSTANTS, lookupUnit } from './units';

/** A unit expression such as "km/h" or "kg·m/s²", already resolved to SI. */
export interface UnitExpr {
  text: string;
  factor: number;
  dim: Dim;
}

export type Node =
  | { k: 'num'; value: number; unit?: UnitExpr; pos: number }
  | { k: 'var'; name: string; pos: number }
  | { k: 'bin'; op: '+' | '-' | '*' | '/'; l: Node; r: Node; pos: number }
  | { k: 'neg'; e: Node; pos: number }
  | { k: 'pow'; base: Node; exp: Node; pos: number }
  | { k: 'call'; name: string; args: Node[]; pos: number };

export type Statement =
  | { k: 'empty' }
  | { k: 'declare'; name: string; unit: UnitExpr }
  | { k: 'assign'; name: string; expr: Node; expect?: UnitExpr; convert?: UnitExpr }
  | { k: 'equation'; left: Node; right: Node }
  | { k: 'expr'; expr: Node; expect?: UnitExpr; convert?: UnitExpr };

export interface ParseContext {
  /** Names that currently hold a value (they shadow units *except* right after a number). */
  isVariable(name: string): boolean;
  /** Names declared with `name : unit` (symbolic, no value). */
  isSymbol(name: string): boolean;
}

export const FUNCTIONS = [
  'sqrt', 'cbrt', 'abs', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'exp', 'ln', 'log', 'log10',
] as const;

const EMPTY_CTX: ParseContext = { isVariable: () => false, isSymbol: () => false };

export function parseLine(line: string, ctx: ParseContext = EMPTY_CTX): Statement {
  return new Parser(tokenize(line), ctx).statement();
}

/** Parses a standalone unit expression like "km/h". Throws on unknown units. */
export function parseUnit(text: string): UnitExpr {
  const p = new Parser(tokenize(text), EMPTY_CTX);
  const u = p.unitExpr();
  p.expectEof();
  return u;
}

class Parser {
  private i = 0;
  constructor(private tokens: Token[], private ctx: ParseContext) {}

  private get t(): Token {
    return this.tokens[this.i];
  }
  private peek(n = 1): Token {
    return this.tokens[Math.min(this.i + n, this.tokens.length - 1)];
  }
  private isOp(text: string, tok: Token = this.t): boolean {
    return tok.type === 'op' && tok.text === text;
  }
  private next(): Token {
    return this.tokens[this.i++];
  }
  private fail(msg: string, tok: Token = this.t): never {
    throw new SyntaxError_(msg, tok.pos);
  }
  private eat(text: string): Token {
    if (!this.isOp(text)) this.fail(this.t.type === 'eof' ? `Expected "${text}" before the end of the line.` : `Expected "${text}" but found "${this.t.text}".`);
    return this.next();
  }
  private atEnd(): boolean {
    return this.t.type === 'eof';
  }
  expectEof(): void {
    if (this.t.type !== 'eof') this.fail(`Unexpected "${this.t.text}".`);
  }

  statement(): Statement {
    if (this.t.type === 'eof') return { k: 'empty' };

    // Declaration:  v : m/s
    if (this.t.type === 'ident' && this.isOp(':', this.peek())) {
      const name = this.next().text;
      this.next();
      const unit = this.unitExpr();
      this.expectEof();
      return { k: 'declare', name, unit };
    }

    const equalsCount = this.tokens.filter((tk) => this.isOp('=', tk)).length;
    if (equalsCount > 1) this.fail('One "=" per line, please. Newton only has so much patience.');

    if (equalsCount === 1) {
      const isPlainAssign =
        this.t.type === 'ident' && this.isOp('=', this.peek()) && !this.ctx.isSymbol(this.t.text);
      if (isPlainAssign) {
        const name = this.next().text;
        this.next();
        if (this.atEnd()) this.fail(`"${name} =" what? The right side is empty.`);
        const expr = this.expr();
        const tail = this.tail();
        return { k: 'assign', name, expr, ...tail };
      }
      const left = this.expr();
      this.eat('=');
      if (this.atEnd()) this.fail('The right side of the equation is empty.');
      const right = this.expr();
      this.expectEof();
      return { k: 'equation', left, right };
    }

    const expr = this.expr();
    const tail = this.tail();
    return { k: 'expr', expr, ...tail };
  }

  /** Optional "[expected unit]" and/or "-> target unit" at the end of a line. */
  private tail(): { expect?: UnitExpr; convert?: UnitExpr } {
    const out: { expect?: UnitExpr; convert?: UnitExpr } = {};
    while (this.t.type !== 'eof') {
      if (this.isOp('[')) {
        this.next();
        out.expect = this.unitExpr();
        this.eat(']');
      } else if (this.isOp('->')) {
        this.next();
        out.convert = this.unitExpr();
      } else {
        this.fail(`Unexpected "${this.t.text}".`);
      }
    }
    return out;
  }

  expr(): Node {
    let l = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next();
      const r = this.term();
      l = { k: 'bin', op: op.text as '+' | '-', l, r, pos: op.pos };
    }
    return l;
  }

  private term(): Node {
    let l = this.unary();
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = this.next();
        const r = this.unary();
        l = { k: 'bin', op: op.text as '*' | '/', l, r, pos: op.pos };
      } else if (this.t.type === 'ident' || this.t.type === 'num' || this.isOp('(')) {
        // Implicit multiplication: "2 pi r", "(a+b)(a-b)"
        const pos = this.t.pos;
        const r = this.unary();
        l = { k: 'bin', op: '*', l, r, pos };
      } else {
        return l;
      }
    }
  }

  private unary(): Node {
    if (this.isOp('-')) {
      const op = this.next();
      return { k: 'neg', e: this.unary(), pos: op.pos };
    }
    if (this.isOp('+')) {
      this.next();
      return this.unary();
    }
    return this.power();
  }

  private power(): Node {
    const base = this.primary();
    if (this.isOp('^')) {
      const op = this.next();
      const exp = this.unary(); // right-associative, allows 2^-1
      return { k: 'pow', base, exp, pos: op.pos };
    }
    return base;
  }

  private primary(): Node {
    const tok = this.t;
    if (tok.type === 'num') {
      this.next();
      const unit = this.unitSuffix();
      return { k: 'num', value: tok.value!, unit, pos: tok.pos };
    }
    if (tok.type === 'ident') {
      this.next();
      if (this.isOp('(') && !this.t.spaceBefore && (FUNCTIONS as readonly string[]).includes(tok.text)) {
        this.next();
        const args: Node[] = [this.expr()];
        while (this.isOp(',')) {
          this.next();
          args.push(this.expr());
        }
        this.eat(')');
        return { k: 'call', name: tok.text, args, pos: tok.pos };
      }
      return { k: 'var', name: tok.text, pos: tok.pos };
    }
    if (this.isOp('(')) {
      this.next();
      const e = this.expr();
      this.eat(')');
      return e;
    }
    if (tok.type === 'eof') this.fail('The line ends too early — something is missing.');
    return this.fail(`Unexpected "${tok.text}".`);
  }

  private isUnitName(tok: Token): boolean {
    return tok.type === 'ident' && lookupUnit(tok.text) !== undefined;
  }

  /**
   * Units written right after a number: "9.8 m/s^2", "3 kg m s^-2", "60 km/h".
   * The first identifier after a number is always read as a unit if it is one.
   * Later identifiers are units only if no variable with that name exists, and
   * "10 kg * g" (spaced multiplication by a constant name) means standard gravity.
   */
  private unitSuffix(): UnitExpr | undefined {
    if (!this.isUnitName(this.t)) return undefined;
    if (this.isOp('(', this.peek()) && !this.peek().spaceBefore) return undefined; // e.g. "2 h(…)" – not a unit

    let acc = this.unitFactor();
    for (;;) {
      const op = this.t;
      const nxt = this.peek();
      const unitFollows = (tok: Token) => this.isUnitName(tok) && !this.ctx.isVariable(tok.text) && !this.ctx.isSymbol(tok.text);
      const spacedConstant = this.isOp('*') && (op.spaceBefore || nxt.spaceBefore) && CONSTANTS.has(nxt.text);
      if ((this.isOp('*') || this.isOp('/')) && unitFollows(nxt) && !spacedConstant) {
        this.next();
        const f = this.unitFactor();
        acc = combine(acc, f, op.text as '*' | '/');
      } else if (this.t.type === 'ident' && unitFollows(this.t)) {
        const f = this.unitFactor();
        acc = combine(acc, f, '*');
      } else {
        return acc;
      }
    }
  }

  /** Standalone unit expression (inside [..], after -> or :). Every identifier is a unit. */
  unitExpr(): UnitExpr {
    let acc: UnitExpr;
    if (this.t.type === 'num' && this.t.value === 1 && this.isOp('/', this.peek())) {
      this.next();
      acc = { text: '1', factor: 1, dim: DIMENSIONLESS };
    } else {
      acc = this.unitAtom();
    }
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = this.next();
        acc = combine(acc, this.unitAtom(), op.text as '*' | '/');
      } else if (this.t.type === 'ident' || this.isOp('(')) {
        acc = combine(acc, this.unitAtom(), '*');
      } else {
        return acc;
      }
    }
  }

  private unitAtom(): UnitExpr {
    if (this.isOp('(')) {
      this.next();
      const inner = this.unitExpr();
      this.eat(')');
      return this.unitPower({ ...inner, text: `(${inner.text})` });
    }
    return this.unitFactor();
  }

  private unitFactor(): UnitExpr {
    const tok = this.t;
    if (tok.type !== 'ident') this.fail(tok.type === 'eof' ? 'A unit is missing at the end.' : `Expected a unit but found "${tok.text}".`);
    const def = lookupUnit(tok.text);
    if (!def) this.fail(`"${tok.text}" is not a unit I know.`, tok);
    this.next();
    return this.unitPower({ text: tok.text, factor: def.factor, dim: def.dim });
  }

  private unitPower(u: UnitExpr): UnitExpr {
    if (!this.isOp('^')) return u;
    this.next();
    let sign = 1;
    if (this.isOp('-')) {
      this.next();
      sign = -1;
    }
    const n = this.t;
    if (n.type !== 'num') this.fail('Unit powers must be plain numbers, like s^2 or s^-1.');
    this.next();
    const e = sign * n.value!;
    return { text: `${u.text}^${e}`, factor: Math.pow(u.factor, e), dim: powDim(u.dim, e) };
  }
}

function combine(a: UnitExpr, b: UnitExpr, op: '*' | '/'): UnitExpr {
  return op === '*'
    ? { text: `${a.text}·${b.text}`, factor: a.factor * b.factor, dim: mulDim(a.dim, b.dim) }
    : { text: `${a.text}/${b.text}`, factor: a.factor / b.factor, dim: divDim(a.dim, b.dim) };
}
