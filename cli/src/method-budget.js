#!/usr/bin/env node
/**
 * method-budget.js — a "ratchet" guard for method count in sensitive Java classes.
 *
 * Philosophy (per user request): do NOT fail the whole build because a class is
 * already over SonarQube's S1448 limit. Instead, freeze a baseline and fail ONLY
 * IF the count grows. This lets us pay down the debt gradually, with no rush, while
 * preventing regressions ("falla si se sube").
 *
 * - current == baseline  -> OK (no change)
 * - current  > baseline  -> FAIL (a method was added; the class got worse)
 * - current  < baseline  -> OK + nudge to lower the baseline (debt was paid down).
 *                           Run with --update to auto-lower and lock in the gain.
 *
 * The counter is deliberately simple and self-contained: it measures a CONSISTENT,
 * MONOTONIC number (methods declared in the file). It does not try to reproduce
 * Sonar's exact metric — it only needs to move the same direction Sonar would when
 * a method is added or removed. The baseline is whatever this counter measures today.
 *
 * Usage:
 *   node cli/src/method-budget.js            # check all entries, exit 1 if any grew
 *   node cli/src/method-budget.js --update   # lower baselines that improved, then pass
 *   node cli/src/method-budget.js --json      # machine-readable report
 *
 * Baseline file: cli/method-budget.json (committed).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');
const BASELINE_PATH = join(__dirname, '..', 'method-budget.json');

/**
 * Remove comments and string/char literals so they cannot produce false method
 * matches (e.g. a "(" inside a string, or `// foo() {` in a comment).
 */
export function stripCommentsAndLiterals(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  let state = 'code'; // code | line | block | string | char
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];
    if (state === 'code') {
      if (c === '/' && next === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && next === '*') { state = 'block'; i += 2; continue; }
      if (c === '"') { out += ' '; state = 'string'; i += 1; continue; }
      if (c === '\'') { out += ' '; state = 'char'; i += 1; continue; }
      out += c; i += 1; continue;
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c; }
      i += 1; continue;
    }
    if (state === 'block') {
      if (c === '*' && next === '/') { state = 'code'; i += 2; continue; }
      if (c === '\n') out += c; // keep line breaks for line counting parity
      i += 1; continue;
    }
    if (state === 'string') {
      if (c === '\\') { i += 2; continue; }
      if (c === '"') { state = 'code'; }
      i += 1; continue;
    }
    if (state === 'char') {
      if (c === '\\') { i += 2; continue; }
      if (c === '\'') { state = 'code'; }
      i += 1; continue;
    }
  }
  return out;
}

const CONTROL_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'new', 'synchronized',
  'else', 'do', 'try', 'finally', 'super', 'this', 'assert', 'throw', 'yield',
]);

/** Index of the matching close paren for an open paren at `open`, or -1. */
function matchParen(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i += 1) {
    if (s[i] === '(') depth += 1;
    else if (s[i] === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Count method (and constructor) declarations in a Java source string.
 *
 * Strategy — robust against package-private methods, nested classes, and call sites:
 * we work on comment/literal-stripped source and look for `identifier(...)` groups.
 *   - If the params are followed by `{` (after an optional `throws` clause), it is a
 *     declaration with a body. A method/constructor call can NEVER be followed by `{`,
 *     so this is an unambiguous method signal — regardless of modifiers or return type.
 *   - If followed by `;`, it is only counted when preceded by a modifier keyword
 *     (abstract / interface methods); otherwise it is a call statement, not a method.
 * Control-flow keywords (`if`, `for`, ...) and `new X(...)` are excluded.
 */
export function countMethods(source) {
  const clean = stripCommentsAndLiterals(source);
  const idParenRe = /([a-zA-Z_$][\w$]*)\s*\(/g;
  let count = 0;
  let m;
  while ((m = idParenRe.exec(clean)) !== null) {
    const name = m[1];
    if (CONTROL_KEYWORDS.has(name)) continue;

    // What precedes the name (skipping whitespace)? `.` => method call; `new` => ctor call.
    let p = m.index - 1;
    while (p >= 0 && /\s/.test(clean[p])) p -= 1;
    if (clean[p] === '.') continue;
    const prevWordMatch = clean.slice(0, p + 1).match(/([a-zA-Z_$][\w$]*)$/);
    const prevWord = prevWordMatch ? prevWordMatch[1] : '';
    if (prevWord === 'new') continue;

    const open = m.index + m[0].length - 1;
    const close = matchParen(clean, open);
    if (close === -1) continue;

    // Skip whitespace + optional `throws ...` clause after the param list.
    let j = close + 1;
    const after = clean.slice(j);
    const tail = after.match(/^\s*(?:throws[\s\w$<>\[\],.&]+?)?\s*([{;])/);
    if (!tail) continue;
    const terminator = tail[1];

    if (terminator === '{') {
      count += 1;
    } else if (terminator === ';' && prevWord && !CONTROL_KEYWORDS.has(prevWord)) {
      // abstract / interface method: `type name(...);` has a type token immediately
      // before the name. A plain call (`helper();`, `x = foo();`) has none — its
      // prevWord is empty (boundary or `=`) or a control keyword.
      count += 1;
    }
  }
  return count;
}

export function countMethodsInFile(absPath) {
  const source = readFileSync(absPath, 'utf8');
  return countMethods(source);
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    throw new Error(`Baseline file not found: ${BASELINE_PATH}`);
  }
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

/**
 * Resolve where the Etendo Go module is checked out. This guard lives in
 * schema_forge but the tracked Java files live in the sibling `com.etendoerp.go`
 * repo, which sits at different relative paths locally vs in CI. Resolution order:
 *   1. --module-root=<path> CLI flag
 *   2. ETENDO_GO_ROOT env var (set by the etendo-go CI workflow)
 *   3. default sibling layout: <schema_forge>/../modules/com.etendoerp.go
 */
export function resolveModuleRoot(opts = {}) {
  if (opts.moduleRoot) return opts.moduleRoot;
  if (process.env.ETENDO_GO_ROOT) return process.env.ETENDO_GO_ROOT;
  return join(ROOT, '..', 'modules', 'com.etendoerp.go');
}

function resolveEntryPath(entry, opts) {
  // `moduleFile` is relative to the Etendo Go module root; `file` is relative to
  // schema_forge root (or absolute). Try every candidate and pick the first that exists.
  const candidates = [];
  if (entry.moduleFile) candidates.push(join(resolveModuleRoot(opts), entry.moduleFile));
  if (entry.file) candidates.push(isAbsolute(entry.file) ? entry.file : join(ROOT, entry.file));
  return candidates.find((p) => existsSync(p)) || candidates[candidates.length - 1] || null;
}

export function evaluate(baseline, opts = {}) {
  return baseline.classes.map((entry) => {
    const absPath = resolveEntryPath(entry, opts);
    if (!absPath || !existsSync(absPath)) {
      return { ...entry, status: 'missing', current: null };
    }
    const current = countMethodsInFile(absPath);
    let status;
    if (current > entry.baseline) status = 'grew';
    else if (current < entry.baseline) status = 'improved';
    else status = 'ok';
    return { ...entry, current, status };
  });
}

function main() {
  const args = process.argv.slice(2);
  const update = args.includes('--update');
  const asJson = args.includes('--json');
  // In CI for a repo that does not check out the Etendo Go module, treat a missing
  // tracked file as a skip (warn) instead of a hard error.
  const skipMissing = args.includes('--skip-missing');
  const moduleRootArg = args.find((a) => a.startsWith('--module-root='));
  const moduleRoot = moduleRootArg ? moduleRootArg.slice('--module-root='.length) : undefined;
  const baseline = loadBaseline();
  const results = evaluate(baseline, { moduleRoot });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  }

  const grew = results.filter((r) => r.status === 'grew');
  const improved = results.filter((r) => r.status === 'improved');
  const missing = results.filter((r) => r.status === 'missing');

  if (!asJson) {
    for (const r of results) {
      if (r.status === 'missing') {
        process.stdout.write(`  ?  ${r.label || r.moduleFile || r.file} — FILE NOT FOUND\n`);
      } else if (r.status === 'grew') {
        process.stdout.write(`  ✗  ${r.label || r.file}: ${r.current} methods > baseline ${r.baseline}\n`);
      } else if (r.status === 'improved') {
        process.stdout.write(`  ↓  ${r.label || r.file}: ${r.current} methods < baseline ${r.baseline} (debt paid — lower the baseline)\n`);
      } else {
        process.stdout.write(`  ✓  ${r.label || r.file}: ${r.current} methods (baseline ${r.baseline})\n`);
      }
    }
  }

  if (update && improved.length > 0) {
    for (const r of improved) {
      const entry = baseline.classes.find(
        (c) => (c.label || c.file) === (r.label || r.file),
      );
      entry.baseline = r.current;
    }
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
    process.stdout.write(`\n  Updated baseline for ${improved.length} class(es). Commit cli/method-budget.json.\n`);
  }

  if (missing.length > 0) {
    if (skipMissing) {
      process.stdout.write(`\n  Skipped ${missing.length} file(s) not present in this checkout (--skip-missing).\n`);
    } else {
      process.stderr.write(`\nERROR: ${missing.length} configured file(s) not found.\n`);
      process.stderr.write('Run from a checkout where the Etendo Go module is a sibling, set ETENDO_GO_ROOT,\n');
      process.stderr.write('pass --module-root=<path>, or use --skip-missing in CI without the module.\n');
      process.exit(2);
    }
  }

  if (grew.length > 0) {
    process.stderr.write(`\nFAIL: ${grew.length} class(es) grew past their method budget.\n`);
    process.stderr.write('A class already over Sonar\'s limit must not get bigger. Extract methods into a helper/handler,\n');
    process.stderr.write('or if you genuinely reduced and re-added, run: node cli/src/method-budget.js --update\n');
    process.exit(1);
  }

  if (!update && improved.length > 0) {
    process.stdout.write('\n  Some classes improved — run `node cli/src/method-budget.js --update` to lock in the lower baseline.\n');
  }
  process.exit(0);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main();
}
