export type TokenType = 'num' | 'ident' | 'op' | 'eof';

export interface Token {
  type: TokenType;
  text: string;
  value?: number;
  /** Column where the token starts (0-based). */
  pos: number;
  /** True if there was whitespace right before this token. */
  spaceBefore: boolean;
}

export class SyntaxError_ extends Error {
  constructor(message: string, public pos: number) {
    super(message);
  }
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-',
};

const isIdentStart = (c: string) => /[A-Za-z_µͰ-Ͽ°]/.test(c);
const isIdentPart = (c: string) => /[A-Za-z0-9_µͰ-Ͽ]/.test(c);

/** Splits one line into tokens. Comments start with `#` or `//`. */
export function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let space = false;
  const push = (t: Omit<Token, 'spaceBefore'>) => {
    tokens.push({ ...t, spaceBefore: space });
    space = false;
  };

  while (i < line.length) {
    const c = line[i];
    if (c === ' ' || c === '\t' || c === '\r') {
      space = true;
      i++;
      continue;
    }
    if (c === '#' || (c === '/' && line[i + 1] === '/')) break;

    // Numbers: 12, 3.5, .5, 6.02e23, 1.6E-19
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(line[i + 1] ?? ''))) {
      const m = /^(\d*\.?\d+(?:[eE][+-]?\d+)?|\d+\.(?![A-Za-z]))/.exec(line.slice(i))!;
      push({ type: 'num', text: m[0], value: parseFloat(m[0]), pos: i });
      i += m[0].length;
      continue;
    }

    // Superscript exponents: m² → m ^ 2
    if (c in SUPERSCRIPT_DIGITS) {
      let j = i;
      let digits = '';
      while (j < line.length && line[j] in SUPERSCRIPT_DIGITS) digits += SUPERSCRIPT_DIGITS[line[j++]];
      push({ type: 'op', text: '^', pos: i });
      push({ type: 'num', text: digits, value: parseFloat(digits), pos: i });
      i = j;
      continue;
    }

    if (c === 'Ω') {
      push({ type: 'ident', text: 'Ω', pos: i });
      i++;
      continue;
    }

    if (isIdentStart(c)) {
      let j = i + 1;
      // "°" stands alone as the degree unit
      if (c !== '°') while (j < line.length && isIdentPart(line[j])) j++;
      push({ type: 'ident', text: line.slice(i, j), pos: i });
      i = j;
      continue;
    }

    if (c === '-' && line[i + 1] === '>') {
      push({ type: 'op', text: '->', pos: i });
      i += 2;
      continue;
    }
    if (c === '*' && line[i + 1] === '*') {
      push({ type: 'op', text: '^', pos: i });
      i += 2;
      continue;
    }
    if (c === '·' || c === '×' || c === '⋅') {
      push({ type: 'op', text: '*', pos: i });
      i++;
      continue;
    }
    if (c === '÷') {
      push({ type: 'op', text: '/', pos: i });
      i++;
      continue;
    }
    if (c === '−') {
      push({ type: 'op', text: '-', pos: i });
      i++;
      continue;
    }
    if ('+-*/^()=,:[]'.includes(c)) {
      push({ type: 'op', text: c, pos: i });
      i++;
      continue;
    }
    throw new SyntaxError_(`I don't know what "${c}" means here.`, i);
  }
  tokens.push({ type: 'eof', text: '', pos: line.length, spaceBefore: space });
  return tokens;
}
