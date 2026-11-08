import { describe, expect, it } from 'vitest';
import { runNotebook } from '../src/core';
import { EXAMPLES } from '../src/web/examples';

// Every built-in example must run, and the "with mistakes" ones must contain
// exactly the mistakes we planted — no more, no less.
const EXPECTED_ERRORS: Record<string, number> = {
  'road-trip': 2,
  formulas: 1,
  kettle: 0,
  circuits: 1,
  space: 1,
};

describe('built-in examples', () => {
  for (const ex of EXAMPLES) {
    it(`${ex.id} has ${EXPECTED_ERRORS[ex.id]} planted error(s)`, () => {
      const r = runNotebook(ex.text);
      const errs = r.lines.filter((l) => l.status === 'error');
      expect(errs.map((l) => `${l.line}: ${l.error!.message}`)).toHaveLength(EXPECTED_ERRORS[ex.id]);
      expect(r.lines.some((l) => l.status === 'skipped')).toBe(false);
    });
  }

  it('kettle example gives a sensible boiling time', () => {
    const r = runNotebook(EXAMPLES.find((e) => e.id === 'kettle')!.text);
    const time = r.lines.find((l) => l.source.startsWith('time'))!;
    expect(time.output).toBe('time = 4.186 min');
  });

  it('ISS orbit is about 92 minutes', () => {
    const r = runNotebook(EXAMPLES.find((e) => e.id === 'space')!.text);
    const T = r.lines.find((l) => l.source.startsWith('T ='))!;
    expect(T.output).toMatch(/^T = 92\.\d+ min$/);
  });
});
