import type { ErrorKind } from './evaluate';

export type ScientistId = 'newton' | 'einstein' | 'curie' | 'feynman' | 'khwarizmi' | 'ulughbeg' | 'biruni';

export interface Scientist {
  id: ScientistId;
  name: string;
  years: string;
  knownFor: string;
}

export const SCIENTISTS: Record<ScientistId, Scientist> = {
  newton: { id: 'newton', name: 'Isaac Newton', years: '1643–1727', knownFor: 'laws of motion, gravity, calculus' },
  einstein: { id: 'einstein', name: 'Albert Einstein', years: '1879–1955', knownFor: 'relativity, E = mc²' },
  curie: { id: 'curie', name: 'Marie Curie', years: '1867–1934', knownFor: 'radioactivity, two Nobel prizes' },
  feynman: { id: 'feynman', name: 'Richard Feynman', years: '1918–1988', knownFor: 'quantum electrodynamics, great teaching' },
  khwarizmi: { id: 'khwarizmi', name: 'Muhammad al-Khwarizmi', years: 'c. 780–850', knownFor: 'algebra, algorithms (his name!)' },
  ulughbeg: { id: 'ulughbeg', name: 'Ulugh Beg', years: '1394–1449', knownFor: 'Samarkand observatory, star catalogue' },
  biruni: { id: 'biruni', name: 'Abu Rayhan al-Biruni', years: '973–1050', knownFor: "measuring the Earth's radius" },
};

export type Mood = 'crying' | 'furious' | 'disappointed' | 'confused' | 'proud';

interface Line {
  who: ScientistId;
  mood: Mood;
  text: string;
}

/** Placeholders like {a}, {b}, {expected} are filled from the error details. */
const LINES: Record<ErrorKind | 'success', Line[]> = {
  'add-mismatch': [
    { who: 'newton', mood: 'crying', text: 'I gave you three laws AND calculus, and you add {b} to {a}? I am going back under my apple tree.' },
    { who: 'einstein', mood: 'disappointed', text: 'Everything is relative. Except this. This is just wrong.' },
    { who: 'curie', mood: 'furious', text: 'I handled radium with bare hands. Even I will not touch this line.' },
    { who: 'feynman', mood: 'confused', text: 'Nature cannot be fooled. Apparently you can — {a} plus {b} is not a thing.' },
    { who: 'khwarizmi', mood: 'furious', text: 'I invented algebra in Khwarazm so that nobody would ever add {b} to {a}.' },
    { who: 'ulughbeg', mood: 'disappointed', text: 'I measured the length of a year to within a minute in Samarkand. You cannot keep {a} and {b} apart?' },
    { who: 'biruni', mood: 'disappointed', text: "I measured the Earth's radius with a mountain and an astrolabe. You cannot measure this." },
  ],
  'expect-mismatch': [
    { who: 'newton', mood: 'crying', text: 'You promised me {expected}. You delivered {got}. This is how trust dies.' },
    { who: 'feynman', mood: 'disappointed', text: 'The first principle is that you must not fool yourself. You expected {expected} and got {got}.' },
    { who: 'curie', mood: 'confused', text: 'Your answer has decayed from {expected} into {got}. Half-life: one line.' },
    { who: 'einstein', mood: 'furious', text: 'Insanity is expecting {expected} and getting {got} every single time.' },
  ],
  'equation-mismatch': [
    { who: 'newton', mood: 'crying', text: 'Both sides of an equation are supposed to agree. Like my laws. Unlike this.' },
    { who: 'einstein', mood: 'disappointed', text: 'E = mc² balances. Yours does not. Left is {left}, right is {right}.' },
    { who: 'khwarizmi', mood: 'furious', text: "Al-jabr means 'restoring the balance'. I see no balance here: {left} vs {right}." },
    { who: 'ulughbeg', mood: 'disappointed', text: 'Even the stars above the Registan are more balanced than this equation.' },
  ],
  'function-arg': [
    { who: 'feynman', mood: 'confused', text: 'You took {fn} of {got}? Bold. Wrong, but bold.' },
    { who: 'biruni', mood: 'disappointed', text: 'I measured angles with an astrolabe for decades. Angles have no units. Yours does.' },
    { who: 'einstein', mood: 'furious', text: 'God does not play dice — and does not take {fn} of {got} either.' },
  ],
  'exponent-units': [
    { who: 'newton', mood: 'confused', text: 'Raising something to the power of {got}? Not even gravity can pull that off.' },
    { who: 'curie', mood: 'confused', text: 'An exponent with units. I have seen strange radiation, but never this.' },
  ],
  'convert-mismatch': [
    { who: 'curie', mood: 'disappointed', text: 'You cannot turn {from} into {to}. Not even with radioactivity.' },
    { who: 'newton', mood: 'crying', text: 'Alchemy did not work for me either. {from} will never become {to}.' },
  ],
  'unknown-name': [
    { who: 'feynman', mood: 'confused', text: 'Who is "{name}"? We have never been introduced.' },
    { who: 'newton', mood: 'confused', text: 'I stood on the shoulders of giants. "{name}" has no shoulders — it does not exist.' },
  ],
  syntax: [
    { who: 'khwarizmi', mood: 'confused', text: 'I wrote the first algebra book. I cannot read this line.' },
    { who: 'einstein', mood: 'confused', text: 'Make things as simple as possible, but not simpler. This is simpler.' },
  ],
  success: [
    { who: 'ulughbeg', mood: 'proud', text: 'As precise as my star catalogue. Samarkand is proud of you.' },
    { who: 'newton', mood: 'proud', text: 'No tears today. Your units are as consistent as gravity.' },
    { who: 'feynman', mood: 'proud', text: 'It checks out! Now go explain it to a friend — that is how you really learn it.' },
    { who: 'curie', mood: 'proud', text: 'Clean work. Not a single unstable unit.' },
    { who: 'khwarizmi', mood: 'proud', text: 'Perfectly balanced. Al-jabr approves.' },
  ],
};

export interface Roast {
  scientist: Scientist;
  mood: Mood;
  text: string;
}

/** Small stable hash so the same mistake always gets the same scientist (nice for tests & screenshots). */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function roastFor(kind: ErrorKind | 'success', seed: string, vars: Record<string, string> = {}): Roast {
  const options = LINES[kind];
  const line = options[hash(seed + kind) % options.length];
  const text = line.text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '???');
  return { scientist: SCIENTISTS[line.who], mood: line.mood, text };
}

export function allLines(): Record<string, Line[]> {
  return LINES;
}
