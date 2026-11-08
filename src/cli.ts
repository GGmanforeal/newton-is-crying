#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { runNotebook, NotebookResult } from './core';

const HELP = `newton — a units checker that cares a little too much about your homework

Usage:
  newton <file.txt>            check a homework sheet line by line
  newton -e "3 m + 2 s"        check a single expression (use \\n for more lines)
  cat sheet.txt | newton       read from stdin

Options:
  --json        machine-readable output
  --no-color    disable colors
  -h, --help    show this help

Exit code is 1 if any line has a units error (handy in CI for lab reports).`;

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  console.log(HELP);
  process.exit(0);
}
const json = args.includes('--json');
const color = !args.includes('--no-color') && !json && process.stdout.isTTY !== false && !process.env.NO_COLOR;
const c = (code: string, s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s: string) => c('31', s);
const green = (s: string) => c('32', s);
const yellow = (s: string) => c('33', s);
const dim = (s: string) => c('2', s);
const bold = (s: string) => c('1', s);
const cyan = (s: string) => c('36', s);

function readInput(): string {
  const eIdx = args.indexOf('-e');
  if (eIdx >= 0) {
    if (!args[eIdx + 1]) fail('-e needs an expression, e.g. newton -e "3 m + 2 s"');
    return args[eIdx + 1].replace(/\\n/g, '\n');
  }
  const file = args.find((a) => !a.startsWith('-'));
  if (file) {
    try {
      return readFileSync(file, 'utf8');
    } catch {
      fail(`Can't read "${file}".`);
    }
  }
  if (process.stdin.isTTY) {
    console.log(HELP);
    process.exit(0);
  }
  return readFileSync(0, 'utf8');
}

function fail(msg: string): never {
  console.error(red(msg));
  process.exit(2);
}

function print(r: NotebookResult): void {
  const width = Math.min(48, Math.max(12, ...r.lines.map((l) => l.source.length)));
  for (const l of r.lines) {
    const num = dim(String(l.line).padStart(3) + ' │ ');
    if (l.status === 'blank') {
      console.log(num + dim(l.source));
      continue;
    }
    const src = l.source.padEnd(width);
    if (l.status === 'ok') {
      console.log(`${num}${src}  ${green('✓')} ${bold(l.output ?? '')} ${dim(l.detail ? `(${l.detail})` : '')}`);
    } else if (l.status === 'skipped') {
      console.log(`${num}${src}  ${dim('… ' + (l.output ?? ''))}`);
    } else {
      console.log(`${num}${src}  ${red('✗ ' + l.error!.message)}`);
      if (l.error!.hint) console.log(`${dim('    │ ')}${' '.repeat(width)}  ${yellow('↳ ' + l.error!.hint)}`);
      if (l.roast) console.log(`${dim('    │ ')}${' '.repeat(width)}  ${cyan(`“${l.roast.text}” — ${l.roast.scientist.name}`)}`);
    }
    for (const w of l.warnings) console.log(`${dim('    │ ')}${' '.repeat(width)}  ${yellow('⚠ ' + w)}`);
  }
  console.log();
  const tears = '💧'.repeat(r.tears) || '😌';
  if (r.errors === 0) {
    console.log(green(bold(`All units check out. ${tears}`)));
  } else {
    console.log(red(bold(`${r.errors} units error${r.errors === 1 ? '' : 's'}. Newton's tear-o-meter: ${tears}`)));
  }
  console.log(dim(`“${r.verdict.text}” — ${r.verdict.scientist.name}`));
}

const result = runNotebook(readInput());
if (json) console.log(JSON.stringify(result, null, 2));
else print(result);
process.exit(result.errors > 0 ? 1 : 0);
