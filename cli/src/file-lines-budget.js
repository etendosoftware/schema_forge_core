#!/usr/bin/env node
/**
 * file-lines-budget.js — a "ratchet" guard for the SIZE (line count) of the files
 * that concentrate churn, primarily the generic contract-ui components
 * (DetailView.jsx, DataTable.jsx).
 *
 * Same philosophy as method-budget.js and window-leak-budget.js: do NOT fail just
 * because a file is already huge. Freeze a baseline of how many lines it has now and
 * fail ONLY IF it GROWS. As the file is decomposed into sub-components the count drops
 * and we lock in the win with --update. The target is "no file over ~600 lines"
 * (docs/reports/contract-ui-churn-analysis.md §9.2), reached gradually with no rush.
 *
 *   - current == baseline  -> OK
 *   - current  > baseline  -> FAIL (the god component got bigger)
 *   - current  < baseline  -> OK + nudge (run --update to lower the baseline)
 *
 * This is the T01 guardrail of that report ("ESLint max-lines that fails CI if they
 * grow"), implemented as a ratchet instead of a fixed threshold: a threshold either
 * blocks every PR today (the files are already over any sane limit) or is set so high
 * it permits the very growth it should stop.
 *
 * The metric is deliberately trivial — physical lines, comments and blanks included.
 * It does not try to reproduce ESLint's `max-lines` options (skipComments /
 * skipBlankLines); it only needs to be CONSISTENT and MONOTONIC: adding a line moves
 * it up, deleting a line moves it down. The baseline is whatever this counter
 * measures today.
 *
 * Usage:
 *   node cli/src/file-lines-budget.js            # check, exit 1 if any file grew
 *   node cli/src/file-lines-budget.js --list     # print every tracked file (current vs baseline)
 *   node cli/src/file-lines-budget.js --update   # lower baselines after paying debt
 *   node cli/src/file-lines-budget.js --json
 *
 * Config: cli/file-lines-budget.json in the CONSUMING repo (committed), resolved via
 * SF_ROOT exactly like window-leak-budget.json — the tracked files live in the
 * functional repo, so its baseline does too.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = process.env.SF_ROOT || join(__dirname, '..', '..');
const CONFIG_PATH = join(ROOT, 'cli', 'file-lines-budget.json');

/**
 * Physical line count of a source string. Matches `wc -l` for newline-terminated
 * files (the norm in this repo) and additionally counts a final unterminated line,
 * so it always equals what an editor shows.
 */
export function countLines(source) {
  if (source === '') return 0;
  const parts = source.split('\n');
  return source.endsWith('\n') ? parts.length - 1 : parts.length;
}

export function countLinesInFile(absPath) {
  return countLines(readFileSync(absPath, 'utf8'));
}

/** Resolve a tracked entry's `path` (repo-relative, or absolute) against the root. */
function resolveEntryPath(entry, root) {
  return isAbsolute(entry.path) ? entry.path : join(root, entry.path);
}

/**
 * Evaluate every tracked file against its baseline.
 * Returns [{ ...entry, current, status }] with status in
 * `grew` | `improved` | `ok` | `missing`.
 */
export function evaluate(config, opts = {}) {
  const root = opts.root || ROOT;
  return config.files.map((entry) => {
    const absPath = resolveEntryPath(entry, root);
    if (!existsSync(absPath)) return { ...entry, current: null, status: 'missing' };
    const current = countLinesInFile(absPath);
    let status;
    if (current > entry.baseline) status = 'grew';
    else if (current < entry.baseline) status = 'improved';
    else status = 'ok';
    return { ...entry, current, status };
  });
}

export function loadConfig(configPath = CONFIG_PATH) {
  if (!existsSync(configPath)) throw new Error(`Config not found: ${configPath}`);
  return JSON.parse(readFileSync(configPath, 'utf8'));
}

function label(entry) {
  return entry.label || entry.path;
}

function printHumanResults(results, { list }) {
  for (const r of results) {
    if (r.status === 'missing') {
      process.stdout.write(`  ?  ${label(r)} — FILE NOT FOUND\n`);
    } else if (r.status === 'grew') {
      process.stdout.write(`  ✗  ${label(r)}: ${r.current} lines > baseline ${r.baseline} (+${r.current - r.baseline})\n`);
    } else if (r.status === 'improved') {
      process.stdout.write(`  ↓  ${label(r)}: ${r.current} lines < baseline ${r.baseline} (debt paid — lower the baseline)\n`);
    } else if (list) {
      process.stdout.write(`  ✓  ${label(r)}: ${r.current} lines (baseline ${r.baseline})\n`);
    }
  }
}

function lockInImprovements(config, improved, configPath) {
  for (const r of improved) {
    const entry = config.files.find((f) => label(f) === label(r));
    entry.baseline = r.current;
  }
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  process.stdout.write(`\n  Updated baseline for ${improved.length} file(s). Commit cli/file-lines-budget.json.\n`);
}

/** A tracked file that cannot be found means the config or SF_ROOT is wrong — exit(2). */
function reportMissingOrExit(missing) {
  if (missing.length === 0) return;
  process.stderr.write(`\nERROR: ${missing.length} tracked file(s) not found.\n`);
  process.stderr.write('Check the paths in cli/file-lines-budget.json, or set SF_ROOT to the repo that owns them.\n');
  process.exit(2);
}

/** The whole point of the guard: a tracked file must never get bigger — exit(1). */
function failIfGrew(grew) {
  if (grew.length === 0) return;
  process.stderr.write(`\nFAIL: ${grew.length} tracked file(s) grew past their line budget.\n`);
  process.stderr.write('These files are already too big — new code must go into a sub-component or a hook, not into them\n');
  process.stderr.write('(see docs/reports/contract-ui-churn-analysis.md §9.2). If you genuinely shrank and re-added lines,\n');
  process.stderr.write('run: node cli/src/file-lines-budget.js --update\n');
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  const update = args.includes('--update');
  const asJson = args.includes('--json');
  const list = args.includes('--list');
  const config = loadConfig();
  const results = evaluate(config);

  const grew = results.filter((r) => r.status === 'grew');
  const improved = results.filter((r) => r.status === 'improved');
  const missing = results.filter((r) => r.status === 'missing');

  if (asJson) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } else {
    printHumanResults(results, { list });
    const tracked = results.length;
    const total = results.reduce((sum, r) => sum + (r.current || 0), 0);
    process.stdout.write(`  ${grew.length ? '✗' : '✓'}  file-lines budget: ${tracked} file(s) tracked, ${total} lines total\n`);
  }

  if (update && improved.length > 0) lockInImprovements(config, improved, CONFIG_PATH);
  reportMissingOrExit(missing);
  failIfGrew(grew);

  if (!update && improved.length > 0) {
    process.stdout.write('\n  Some files shrank — run `node cli/src/file-lines-budget.js --update` to lock in the lower baseline.\n');
  }
  process.exit(0);
}

const isMain = isMainModule(import.meta.url);
if (isMain) {
  main();
}
