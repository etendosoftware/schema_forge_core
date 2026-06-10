#!/usr/bin/env node
/**
 * window-leak-budget.js — a "ratchet" guard for window/entity-specific literals that
 * leak into the GENERIC contract-ui components (DetailView.jsx, DataTable.jsx, ...).
 *
 * Same philosophy as method-budget.js (per user request): do NOT fail just because
 * leaks exist today. Freeze a baseline of how many there are now and fail ONLY IF the
 * count GROWS. As we declarativize leaks (move `=== 'contact'`, `'custom:sif'`,
 * `'internal-consumption-product'` ... into contract/metadata) the number drops and
 * we lock in the win with --update. The target is 0, reached gradually with no rush.
 *
 *   - current == baseline  -> OK
 *   - current  > baseline  -> FAIL (a new window literal was hardcoded)
 *   - current  < baseline  -> OK + nudge (run --update to lower the baseline)
 *
 * Findings inside comments are ignored (a comment describing a removed branch is not a
 * leak). String/JSX literals are kept — that is exactly where the leaks live.
 *
 * Usage:
 *   node cli/src/window-leak-budget.js            # check, exit 1 if it grew
 *   node cli/src/window-leak-budget.js --list     # enumerate every finding (file:line)
 *   node cli/src/window-leak-budget.js --update    # lower the baseline after paying debt
 *   node cli/src/window-leak-budget.js --json
 *
 * Config: cli/window-leak-budget.json (committed).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');
const CONFIG_PATH = join(__dirname, '..', 'window-leak-budget.json');

/**
 * Strip line and block comments while KEEPING string/char literals intact (the leaks
 * are string literals). Comment bytes are replaced with spaces so line/column numbers
 * are preserved for accurate reporting.
 */
export function stripCommentsKeepStrings(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  let state = 'code'; // code | line | block | string | char | template
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];
    if (state === 'code') {
      if (c === '/' && next === '/') { out += '  '; state = 'line'; i += 2; continue; }
      if (c === '/' && next === '*') { out += '  '; state = 'block'; i += 2; continue; }
      if (c === '"') { out += c; state = 'string'; i += 1; continue; }
      if (c === '\'') { out += c; state = 'char'; i += 1; continue; }
      if (c === '`') { out += c; state = 'template'; i += 1; continue; }
      out += c; i += 1; continue;
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c; } else { out += ' '; }
      i += 1; continue;
    }
    if (state === 'block') {
      if (c === '*' && next === '/') { state = 'code'; out += '  '; i += 2; continue; }
      out += c === '\n' ? '\n' : ' ';
      i += 1; continue;
    }
    if (state === 'string') {
      out += c;
      if (c === '\\') { out += next ?? ''; i += 2; continue; }
      if (c === '"') state = 'code';
      i += 1; continue;
    }
    if (state === 'char') {
      out += c;
      if (c === '\\') { out += next ?? ''; i += 2; continue; }
      if (c === '\'') state = 'code';
      i += 1; continue;
    }
    if (state === 'template') {
      out += c;
      if (c === '\\') { out += next ?? ''; i += 2; continue; }
      if (c === '`') state = 'code';
      i += 1; continue;
    }
  }
  return out;
}

function listFiles(dir, extensions) {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      result.push(...listFiles(full, extensions));
      continue;
    }
    if (extensions.includes(extname(entry.name))) result.push(full);
  }
  return result.sort((a, b) => a.localeCompare(b));
}

/** Scan one source string, returning [{ line, match, pattern }] (comments ignored). */
export function findLeaksInSource(source, patterns) {
  const clean = stripCommentsKeepStrings(source);
  const lines = clean.split('\n');
  const findings = [];
  for (const p of patterns) {
    const re = new RegExp(p, 'g');
    lines.forEach((text, idx) => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        findings.push({ line: idx + 1, match: m[0].trim(), pattern: p });
        if (m.index === re.lastIndex) re.lastIndex += 1;
      }
    });
  }
  return findings;
}

export function scan(config, opts = {}) {
  const root = opts.root || ROOT;
  const extensions = config.extensions || ['.js', '.jsx'];
  const findings = [];
  for (const rel of config.paths) {
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    const files = statSync(abs).isDirectory() ? listFiles(abs, extensions) : [abs];
    for (const file of files) {
      const hits = findLeaksInSource(readFileSync(file, 'utf8'), config.patterns);
      for (const h of hits) findings.push({ file: file.replace(`${root}/`, ''), ...h });
    }
  }
  return findings;
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) throw new Error(`Config not found: ${CONFIG_PATH}`);
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

function main() {
  const args = process.argv.slice(2);
  const update = args.includes('--update');
  const asJson = args.includes('--json');
  const list = args.includes('--list');
  const config = loadConfig();
  const findings = scan(config);
  const current = findings.length;
  const baseline = config.baseline;

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ baseline, current, findings }, null, 2)}\n`);
  } else {
    if (list || current > baseline) {
      for (const f of findings) {
        process.stdout.write(`  • ${f.file}:${f.line}  ${f.match}\n`);
      }
      if (findings.length) process.stdout.write('\n');
    }
    const verb = current > baseline ? '✗' : current < baseline ? '↓' : '✓';
    process.stdout.write(`  ${verb}  window-literal leaks in contract-ui: ${current} (baseline ${baseline})\n`);
  }

  if (current < baseline && update) {
    config.baseline = current;
    writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
    process.stdout.write(`\n  Lowered baseline ${baseline} → ${current}. Commit cli/window-leak-budget.json.\n`);
    process.exit(0);
  }

  if (current > baseline) {
    process.stderr.write(`\nFAIL: window-specific leaks grew (${current} > ${baseline}).\n`);
    process.stderr.write('A generic component must not learn new window/entity literals. Move it to contract/metadata\n');
    process.stderr.write('(see docs/reports/contract-ui-churn-analysis.md §8). The goal is 0 — but it must never go UP.\n');
    process.exit(1);
  }

  if (current < baseline && !update) {
    process.stdout.write('\n  Leaks decreased — run `node cli/src/window-leak-budget.js --update` to lock in the lower baseline.\n');
  }
  process.exit(0);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main();
}
