#!/usr/bin/env node
/**
 * flag-debt.js — per-flag technical-debt scorer ("flag debt scorecard v0").
 *
 * Reads flag METADATA from flags-registry.json and DERIVES a debt score for
 * each flag from the working tree. Nothing is written back to the registry:
 * the score is always recomputed, never stored.
 *
 * Five dimensions, summed into one score (higher = more debt):
 *
 *   1. touch points — references to the flag outside its own files. Cheap to
 *      remove while there are a few, an archaeology exercise once they spread.
 *   2. tests        — declared specs that do not exist on disk.
 *   3. coverage     — uncovered lines in the flag's owned files, read from an
 *      existing SonarQube analysis. Skipped (0 pts) when unavailable.
 *   4. lifecycle    — how far past its TTL the flag is.
 *   5. open items   — decisions the flag is still holding, scored per item.
 *
 * v0 is report-only: the process always exits 0. Thresholds and CI gating are
 * deliberately out of scope. See docs/flag-debt.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './utils.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/**
 * The repo being scored — the functional repo, not this one.
 *
 * `SF_ROOT` is how the consuming repo says "score my registry": the Makefile and
 * `cli/sf-local` both export it. Without it, a CLI running from core source would
 * resolve core's own directory and silently score the wrong repo, which for a tool
 * whose whole job is honest numbers is the worst available failure. The
 * `__dirname` fallback keeps this script runnable in place inside core.
 */
export const DEFAULT_REPO_ROOT = process.env.SF_ROOT
  ? path.resolve(process.env.SF_ROOT)
  : path.resolve(HERE, '..', '..');
export const REGISTRY_FILENAME = 'flags-registry.json';

/** Every points rule in one place, so the scale is tunable and greppable. */
export const POINTS = {
  /** Touch-point files that are free: a route, a menu entry, a servlet hook. */
  freeTouchPoints: 3,
  /** Cost of every touch-point file beyond the free ones. */
  perExtraTouchPoint: 2,
  /**
   * Flat cost when a spec list has any PENDING entry (missing, but someone is
   * expected to write it). Flat, because the signal is "this suite has a hole".
   * Accepted-debt specs are charged the same amount but PER ITEM — a standing
   * decision not to test something is owned individually and does not go away
   * when the rest of the suite lands.
   */
  missingUnitSpecs: 5,
  missingE2eSpecs: 8,
  /** Uncovered lines that cost one point. */
  uncoveredLinesPerPoint: 10,
  /** Cost per started week past the TTL. */
  perWeekOverdue: 3,
  /**
   * Cost of a deferred open item, by kind. A deferred decision is a standing
   * decision, exactly like an accepted-debt spec, so it is charged per item.
   *
   * `precondition` is anchored at the missing-unit-spec penalty: one decision
   * that blocks the next step costs the same as one untested unit. `cosmetic`
   * is deliberately non-zero — a free bucket is a bucket everything gets
   * labelled into — but small enough not to distort the total.
   */
  deferredItemKind: { precondition: 5, open: 3, cosmetic: 1 },
  /**
   * Added per component beyond the first on a bundled item. Bundling keeps the
   * card readable; this keeps the score honest about breadth, so a bundle of
   * eight does not cost the same as a bundle of one.
   */
  perExtraDeferredComponent: 1,
};

const SOURCE_EXTENSIONS = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.java',
  '.json', '.md', '.yml', '.yaml', '.properties', '.xml', '.sh', '.sql',
]);

/** Owned files worth asking SonarQube about. */
const COVERAGE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.java']);

/**
 * Directories skipped entirely while walking. `generated` and `locales` cover
 * artifacts/<w>/generated and the locale bundles; the rest are build output,
 * dependencies or test reports.
 */
const SKIP_DIR_NAMES = new Set([
  'node_modules', '.git', '.gradle', '.worktrees', '.scannerwork', '.idea',
  'dist', 'build', 'coverage', 'generated', 'locales',
  'test-results', 'playwright-report', 'e2e-report',
  // Tool output that mentions source it analysed. A flag key echoed inside a
  // Sonar report is not a touch point, and counting it charges real debt
  // points for having run a scan.
  'sonar-reports', '.quality-gate-cache', 'logs', 'tmp',
  // A separate, git-ignored checkout (.gitignore line 1) that happens to sit
  // inside this repo. It is not frontend source, and walking it charges the
  // backend module's own owned files as unowned frontend touch points.
  'etendo_core', 'etendo_core_ar',
]);

/** Files that describe the scorecard rather than participate in it. */
const SKIP_FILE_NAMES = new Set([
  REGISTRY_FILENAME, 'package-lock.json', 'flag-debt.js', 'flag-debt.json',
  'flag-debt.html', 'flag-debt.md',
]);

const MAX_SCANNED_BYTES = 512 * 1024;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ── Registry ────────────────────────────────────────────────────────────────

/**
 * Flattens a feature entry into the shape the scoring internals consume.
 *
 * The registry's unit of accounting is the FEATURE; the flag is a temporary
 * attribute nested under it. Durable facts (paths, testSpecs, deferredItems)
 * live on the feature and keep scoring after the flag is retired. Flag-borne
 * facts flatten to `undefined` when there is no flag, which the existing
 * dimensions already treat correctly: no symbols → nothing to grep as a touch
 * point, no ttl → lifecycle scores 0. Retirement therefore LOWERS the score
 * without deleting the accounting — the incentive the inversion exists for.
 */
export function normalizeFeature(entry) {
  const flag = entry.flag || null;
  return {
    ...entry,
    flag,
    key: flag ? flag.key : null,
    defaultValue: flag ? flag.defaultValue : null,
    ttl: flag ? flag.ttl : undefined,
    ttlNote: flag ? flag.ttlNote : null,
    symbols: flag ? flag.symbols || [] : [],
  };
}

export function loadRegistry(registryPath) {
  const raw = fs.readFileSync(registryPath, 'utf8');
  const registry = JSON.parse(raw);
  if (!Array.isArray(registry.features)) {
    throw new Error(`${registryPath}: expected a "features" array (v2 registry — the feature owns the entry, the flag is nested)`);
  }
  for (const feature of registry.features) {
    if (!feature.id) throw new Error(`${registryPath}: every feature needs an "id"`);
  }
  registry.features = registry.features.map(normalizeFeature);
  return registry;
}

/**
 * Resolves the on-disk root for each declared repo root.
 *
 * The backend module is a separate, git-ignored checkout, so it is absent from
 * a worktree. Candidates, in order: an explicit ETENDO_GO_MODULE, the path
 * under the repo root, then the same path under the main checkout (a worktree
 * lives at <main>/.worktrees/<name>). Missing backend is reported, never fatal.
 */
export function resolveRoots(registry, { repoRoot = DEFAULT_REPO_ROOT, env = process.env } = {}) {
  const declared = registry.roots || {};
  const frontend = path.resolve(repoRoot, declared.frontend || '.');

  const backendRelative = declared.backend;
  const candidates = [];
  if (env.ETENDO_GO_MODULE) candidates.push(path.resolve(env.ETENDO_GO_MODULE));
  if (backendRelative) {
    candidates.push(path.resolve(repoRoot, backendRelative));
    candidates.push(path.resolve(repoRoot, '..', '..', backendRelative));
  }
  const backend = candidates.find((dir) => isDirectory(dir)) || null;

  return {
    frontend,
    backend,
    backendUnavailableReason: backend
      ? null
      : `backend module not found (looked in: ${candidates.join(', ') || 'nothing declared'}). `
        + 'Set ETENDO_GO_MODULE to scan it.',
  };
}

function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function isFile(target) {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

// ── Scanning ────────────────────────────────────────────────────────────────

/**
 * Yields every scannable file under `root`, as a path relative to `root`.
 *
 * `skipPaths` blocks specific absolute directories. Roots can nest — the
 * backend module lives inside the repo — and without this a file under the
 * inner root is visited twice: once correctly, and once under the outer root
 * where its owned-path declarations do not apply, turning owned code into a
 * phantom touch point.
 */
/** Directory entries, or nothing at all when the directory cannot be read. */
function readDirSafely(absoluteDir) {
  try {
    return fs.readdirSync(absoluteDir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function isWalkableDir(entry, absolute, { skipDirNames, blocked }) {
  if (skipDirNames.has(entry.name)) return false;
  return !blocked.has(absolute);
}

function isScannableFile(entry, extensions) {
  if (SKIP_FILE_NAMES.has(entry.name)) return false;
  return extensions.has(path.extname(entry.name));
}

export function* walkFiles(root, {
  skipDirNames = SKIP_DIR_NAMES, extensions = SOURCE_EXTENSIONS, skipPaths = [],
} = {}) {
  const blocked = new Set(skipPaths.map((target) => path.resolve(target)));
  const stack = [''];
  while (stack.length > 0) {
    const relativeDir = stack.pop();
    for (const entry of readDirSafely(path.join(root, relativeDir))) {
      const relative = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
      if (entry.isDirectory()) {
        if (isWalkableDir(entry, path.resolve(root, relative), { skipDirNames, blocked })) {
          stack.push(relative);
        }
      } else if (entry.isFile() && isScannableFile(entry, extensions)) {
        yield relative;
      }
    }
  }
}

/** Line numbers and text of every line in `file` containing any symbol. */
export function findSymbolHits(absolutePath, symbols) {
  let stat;
  try {
    stat = fs.statSync(absolutePath);
  } catch {
    return [];
  }
  if (stat.size > MAX_SCANNED_BYTES) return [];

  let content;
  try {
    content = fs.readFileSync(absolutePath, 'utf8');
  } catch {
    return [];
  }
  if (!symbols.some((symbol) => content.includes(symbol))) return [];

  const hits = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (symbols.some((symbol) => lines[i].includes(symbol))) {
      hits.push({ line: i + 1, text: lines[i].trim().slice(0, 160) });
    }
  }
  return hits;
}

// ── Classification ──────────────────────────────────────────────────────────

const toPosix = (relative) => relative.split(path.sep).join('/');

/** True when `relative` is, or lives under, `declared`. */
export function matchesPath(relative, declared) {
  const target = toPosix(relative);
  const prefix = toPosix(declared);
  if (prefix.endsWith('/')) return target.startsWith(prefix);
  return target === prefix || target.startsWith(`${prefix}/`);
}

export function isFrameworkPath(relative, frameworkPaths) {
  const target = toPosix(relative);
  return frameworkPaths.some((fragment) => target.includes(toPosix(fragment)));
}

export function isDocPath(relative) {
  return path.extname(relative) === '.md';
}

export function isTestPath(relative) {
  const target = toPosix(relative);
  return target.includes('/__tests__/')
    || target.startsWith('__tests__/')
    || target.includes('/src-test/')
    || target.startsWith('src-test/')
    || /\.(test|spec|vitest)\.[a-z]+$/.test(target)
    || /Test\.java$/.test(target);
}

/**
 * Buckets one referencing file.
 *
 * `code` is the only bucket that scores. `docs` and `tests` are reported for
 * completeness: they are real references a removal must clean up, but charging
 * for them would double-count the tests dimension and penalise documenting.
 */
export function classifyReference(relative, { ownedPaths, frameworkPaths, specPaths }) {
  if (ownedPaths.some((owned) => matchesPath(relative, owned))) return 'owned';
  if (isFrameworkPath(relative, frameworkPaths)) return 'framework';
  if (specPaths.some((spec) => matchesPath(relative, spec))) return 'tests';
  if (isDocPath(relative)) return 'docs';
  if (isTestPath(relative)) return 'tests';
  return 'code';
}

// ── Dimension 1: touch points ───────────────────────────────────────────────

export function collectTouchPoints(flag, { roots, frameworkPaths }) {
  const buckets = { code: [], docs: [], tests: [] };
  const scannedRoots = [];
  const skippedRoots = [];

  for (const [rootName, rootDir] of Object.entries(roots)) {
    if (!rootDir) {
      skippedRoots.push(rootName);
      continue;
    }
    scannedRoots.push(rootName);
    const ownedPaths = (flag.paths && flag.paths[rootName]) || [];
    const specPaths = allSpecs(flag)
      .filter((spec) => spec.root === rootName)
      .map((spec) => spec.path);

    const nestedRoots = Object.entries(roots)
      .filter(([name, dir]) => name !== rootName && dir)
      .map(([, dir]) => dir);

    for (const relative of walkFiles(rootDir, { skipPaths: nestedRoots })) {
      const hits = findSymbolHits(path.join(rootDir, relative), flag.symbols || []);
      if (hits.length === 0) continue;
      const bucket = classifyReference(relative, { ownedPaths, frameworkPaths, specPaths });
      if (bucket === 'owned' || bucket === 'framework') continue;
      buckets[bucket].push({ root: rootName, path: toPosix(relative), hits });
    }
  }

  for (const list of Object.values(buckets)) {
    list.sort((a, b) => `${a.root}/${a.path}`.localeCompare(`${b.root}/${b.path}`));
  }

  const extra = Math.max(0, buckets.code.length - POINTS.freeTouchPoints);
  return {
    files: buckets.code,
    docReferences: buckets.docs,
    testReferences: buckets.tests,
    freeAllowance: POINTS.freeTouchPoints,
    extraFiles: extra,
    scannedRoots,
    skippedRoots,
    points: extra * POINTS.perExtraTouchPoint,
  };
}

// ── Dimension 2: tests ──────────────────────────────────────────────────────

/** Normalises both spec shapes (a bare string or an object) into objects. */
export function normalizeSpec(spec) {
  if (typeof spec === 'string') {
    return { path: spec, root: 'frontend', expected: false, acceptedDebt: false, note: null };
  }
  return {
    path: spec.path,
    root: spec.root || 'frontend',
    expected: Boolean(spec.expected),
    acceptedDebt: Boolean(spec.acceptedDebt),
    note: spec.note || null,
  };
}

/**
 * A spec is one of four things, and the difference is the whole point:
 *
 *   present      — on disk
 *   pending      — missing, someone is expected to write it (transient)
 *   accepted-debt— missing, the team decided not to write it (standing)
 *   missing      — missing with no declared intent either way
 *
 * `acceptedDebt` wins over `expected`: overloading "expected" to mean both
 * "queued" and "deliberately deferred" is how a registry stops being trusted.
 */
export function specStatus(spec, exists) {
  if (exists) return 'present';
  if (spec.acceptedDebt) return 'accepted-debt';
  if (spec.expected) return 'pending';
  return 'missing';
}

const DEFAULT_SPEC_NOTE = {
  'accepted-debt': 'accepted debt — deliberately not written',
  pending: 'pending Tester',
  missing: 'missing',
};

function allSpecs(flag) {
  const specs = flag.testSpecs || {};
  return [...(specs.unit || []), ...(specs.e2e || [])].map(normalizeSpec);
}

export function checkTestSpecs(flag, { roots }) {
  const kinds = { unit: POINTS.missingUnitSpecs, e2e: POINTS.missingE2eSpecs };
  const result = { kinds: {}, points: 0 };

  for (const [kind, penalty] of Object.entries(kinds)) {
    const specs = ((flag.testSpecs || {})[kind] || []).map(normalizeSpec);
    const checked = specs.map((spec) => {
      const rootDir = roots[spec.root];
      const exists = rootDir ? isFile(path.join(rootDir, spec.path)) : false;
      const status = specStatus(spec, exists);
      return {
        ...spec,
        exists,
        status,
        unverifiable: !rootDir,
        // A declared note wins over the status default.
        note: exists ? null : (spec.note || DEFAULT_SPEC_NOTE[status]),
      };
    });
    const missing = checked.filter((spec) => !spec.exists);
    const acceptedDebt = missing.filter((spec) => spec.status === 'accepted-debt');
    const pending = missing.filter((spec) => spec.status !== 'accepted-debt');

    const flatPoints = pending.length > 0 ? penalty : 0;
    const acceptedDebtPoints = acceptedDebt.length * penalty;
    const points = flatPoints + acceptedDebtPoints;

    result.kinds[kind] = {
      specs: checked, missing, pending, acceptedDebt,
      declared: checked.length, flatPoints, acceptedDebtPoints, points,
    };
    result.points += points;
  }
  return result;
}

// ── Dimension 3: coverage ───────────────────────────────────────────────────

const SONAR_PROJECT_BY_ROOT = { frontend: 'schema-forge', backend: 'etendo-go' };

/** The script ships with the published CLI; a local core checkout wins. */
export function resolveCoverageScript(repoRoot) {
  const candidates = [
    path.join(repoRoot, 'cli', 'sonar-coverage.sh'),
    path.join(repoRoot, 'node_modules', '@etendosoftware', 'schema-forge-cli', 'sonar-coverage.sh'),
  ];
  return candidates.find((candidate) => isFile(candidate)) || null;
}

/** Expands one declared path — a file or a directory — into owned entries. */
function expandDeclaredPath(rootName, rootDir, declared) {
  const absolute = path.join(rootDir, declared);
  if (isFile(absolute)) {
    if (!COVERAGE_EXTENSIONS.has(path.extname(absolute))) return [];
    return [{ root: rootName, path: toPosix(declared) }];
  }
  if (!isDirectory(absolute)) return [];
  return [...walkFiles(absolute, { extensions: COVERAGE_EXTENSIONS })]
    .map((relative) => ({ root: rootName, path: toPosix(path.join(declared, relative)) }));
}

/** Owned source files, expanded from the declared paths (dirs included). */
export function expandOwnedFiles(flag, roots) {
  const files = [];
  for (const [rootName, rootDir] of Object.entries(roots)) {
    if (!rootDir) continue;
    const declaredPaths = (flag.paths && flag.paths[rootName]) || [];
    for (const declared of declaredPaths) {
      files.push(...expandDeclaredPath(rootName, rootDir, declared));
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/** Sums an `Uncovered:` list like `12, 40-44, 91` into a line count. */
function sumUncoveredRanges(list) {
  return list.split(',').reduce((total, chunk) => {
    const span = chunk.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!span) return total;
    const from = Number(span[1]);
    const to = span[2] ? Number(span[2]) : from;
    return total + (to - from + 1);
  }, 0);
}

/**
 * Pulls the uncovered-line count out of sonar-coverage.sh's report.
 *
 * Line scanning with `trim()` rather than regexes carrying leading and trailing
 * `\s*`: those are ambiguous against a long run of whitespace and backtrack
 * super-linearly, which on tool output we do not control is a denial-of-service
 * shape. Splitting first makes the cost linear in the input.
 */
export function parseUncoveredLines(output) {
  const text = String(output ?? '');
  const summary = text.match(/uncovered lines:[ \t]*(\d+)/i);
  if (summary) return Number(summary[1]);
  if (/no coverage data on server/i.test(text)) return null;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!/^uncovered:/i.test(line)) continue;
    const list = line.slice(line.indexOf(':') + 1).trim();
    if (/^none$/i.test(list)) return 0;
    return sumUncoveredRanges(list);
  }
  return null;
}

export function collectCoverage(flag, { roots, repoRoot, env = process.env, runner = runCoverageScript }) {
  const ownedFiles = expandOwnedFiles(flag, roots);

  if (!env.SONAR_TOKEN) {
    return { status: 'unavailable', reason: 'SONAR_TOKEN not set', files: [], points: 0 };
  }
  const script = resolveCoverageScript(repoRoot);
  if (!script) {
    return { status: 'unavailable', reason: 'sonar-coverage.sh not found', files: [], points: 0 };
  }

  const files = [];
  let points = 0;
  for (const owned of ownedFiles) {
    const outcome = runner({ script, cwd: roots[owned.root], file: owned.path, project: SONAR_PROJECT_BY_ROOT[owned.root], env });
    if (outcome.uncovered === null) {
      files.push({ ...owned, uncovered: null, points: 0, note: outcome.reason || 'no analysis' });
      continue;
    }
    const filePoints = Math.floor(outcome.uncovered / POINTS.uncoveredLinesPerPoint);
    points += filePoints;
    files.push({ ...owned, uncovered: outcome.uncovered, points: filePoints, note: null });
  }

  const measured = files.filter((file) => file.uncovered !== null);
  return {
    status: measured.length > 0 ? 'measured' : 'unavailable',
    reason: measured.length > 0 ? null : 'no analysis on server for the owned files',
    files,
    points,
  };
}

function runCoverageScript({ script, cwd, file, project, env }) {
  try {
    const result = spawnSync(script, ['--project', project, file], {
      cwd, env, encoding: 'utf8', timeout: 60_000,
    });
    if (result.error || result.status === null || result.status > 1) {
      return { uncovered: null, reason: 'coverage lookup failed' };
    }
    return { uncovered: parseUncoveredLines(`${result.stdout || ''}\n${result.stderr || ''}`) };
  } catch {
    return { uncovered: null, reason: 'coverage lookup failed' };
  }
}

// ── Dimension 4: lifecycle ──────────────────────────────────────────────────

export function scoreLifecycle(flag, now = new Date()) {
  if (!flag.ttl) {
    return { ttl: null, daysRemaining: null, weeksOverdue: 0, points: 0, note: 'no TTL declared' };
  }
  const ttl = new Date(`${flag.ttl}T00:00:00Z`);
  if (Number.isNaN(ttl.getTime())) {
    return { ttl: flag.ttl, daysRemaining: null, weeksOverdue: 0, points: 0, note: 'unparseable TTL' };
  }
  const daysRemaining = Math.ceil((ttl.getTime() - now.getTime()) / MS_PER_DAY);
  if (daysRemaining >= 0) {
    return { ttl: flag.ttl, daysRemaining, weeksOverdue: 0, points: 0, note: null };
  }
  const weeksOverdue = Math.ceil(-daysRemaining / 7);
  return {
    ttl: flag.ttl,
    daysRemaining,
    weeksOverdue,
    points: weeksOverdue * POINTS.perWeekOverdue,
    note: 'past TTL',
  };
}

// ── Dimension 5: deferred open items ────────────────────────────────────────

/**
 * Scores the open decisions a flag is carrying that are not test gaps.
 *
 * These used to be recorded and left unscored, which was the wrong call: the
 * scale already charges accepted-debt specs per item on the grounds that a
 * standing decision is owned individually, and a deferred item is exactly that
 * — someone decided not to do this yet, and the flag carries the consequence
 * until they do. Recording it on the card but leaving it out of the number made
 * the number describe less than the card did.
 *
 * A bundled item (one theme, several components) costs its kind plus one per
 * component beyond the first, so breadth shows up without one theme swamping
 * the total. Promote a component to its own item once it is scheduled
 * separately — at that point it stops being part of one decision.
 *
 * Pure: no filesystem, no clock. `points` on an item overrides the formula.
 */
export function scoreDeferredItems(flag) {
  const items = (flag.deferredItems || []).map((item) => {
    const kind = item.kind || 'open';
    const kindRecognized = Object.hasOwn(POINTS.deferredItemKind, kind);
    const components = (item.components || []).map((component) => ({
      id: component.id,
      note: component.note || '',
      ref: component.ref || null,
    }));
    const base = kindRecognized
      ? POINTS.deferredItemKind[kind]
      : POINTS.deferredItemKind.open;
    const breadth = Math.max(0, components.length - 1) * POINTS.perExtraDeferredComponent;
    const derived = base + breadth;

    const declared = item.points;
    const hasDeclared = declared !== undefined && declared !== null;
    const declaredUsable = isUsableOverride(declared);

    return {
      id: item.id,
      kind,
      kindRecognized,
      note: item.note || '',
      refs: item.refs || [],
      components,
      points: declaredUsable ? declared : derived,
      pointsOverridden: declaredUsable,
      // A declared value that is not a whole number of points is dropped, not
      // repaired. Debt cannot be negative and the scale has no halves, so there
      // is no honest guess at the intent — and clamping -50 to 0 would make a
      // broken entry indistinguishable from a deliberate zero. The derived
      // score stands instead, and the report says the override was ignored.
      pointsOverrideIgnored: hasDeclared && !declaredUsable,
      declaredPoints: hasDeclared && !declaredUsable ? declared : null,
    };
  });
  return { items, points: items.reduce((total, item) => total + item.points, 0) };
}

/** An override is honoured only as a whole, non-negative number of points. */
export function isUsableOverride(value) {
  return Number.isInteger(value) && value >= 0;
}

// ── Report ──────────────────────────────────────────────────────────────────

export function scoreFlag(flag, context) {
  const touchPoints = collectTouchPoints(flag, context);
  const tests = checkTestSpecs(flag, context);
  const coverage = collectCoverage(flag, context);
  const lifecycle = scoreLifecycle(flag, context.now);
  const deferred = scoreDeferredItems(flag);
  return {
    id: flag.id,
    key: flag.key,
    hasFlag: Boolean(flag.flag),
    description: flag.description || '',
    owner: flag.owner || 'unassigned',
    jira: flag.jira || null,
    created: flag.created || null,
    defaultValue: flag.defaultValue,
    ttlNote: flag.ttlNote || null,
    deferred,
    touchPoints,
    tests,
    coverage,
    lifecycle,
    total: touchPoints.points + tests.points + coverage.points
      + lifecycle.points + deferred.points,
  };
}

export function buildReport(registry, context) {
  return {
    generatedAt: (context.now || new Date()).toISOString(),
    version: registry.version ?? null,
    roots: {
      frontend: context.roots.frontend,
      backend: context.roots.backend,
      backendUnavailableReason: context.backendUnavailableReason || null,
    },
    features: registry.features.map((feature) => scoreFlag(feature, context)),
  };
}

// ── Console rendering ───────────────────────────────────────────────────────

const pad = (value, width) => String(value).padEnd(width);
const padStart = (value, width) => String(value).padStart(width);

/** Word-wraps `text` to `width`, prefixing every line with `indent`. */
export function wrapText(text, width, indent = '') {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    if (`${current} ${word}`.length > width) {
      lines.push(indent + current);
      current = word;
    } else {
      current += ` ${word}`;
    }
  }
  lines.push(indent + current);
  return lines;
}

function renderTouchPointLines(touchPoints) {
  const lines = [];
  for (const file of touchPoints.files) {
    const where = file.hits.map((hit) => hit.line).join(',');
    lines.push(`      ${file.root}: ${file.path}:${where}`);
  }
  if (touchPoints.docReferences.length > 0) {
    lines.push(`      documentation references (not scored): ${touchPoints.docReferences.length} file(s)`);
  }
  if (touchPoints.testReferences.length > 0) {
    lines.push(`      test references (not scored): ${touchPoints.testReferences.length} file(s)`);
  }
  return lines;
}

function renderSpecLines(tests) {
  const lines = [];
  for (const [kind, result] of Object.entries(tests.kinds)) {
    const present = result.declared - result.missing.length;
    const summary = [`${present}/${result.declared} present`];
    if (result.pending.length > 0) {
      summary.push(`${result.pending.length} pending (+${result.flatPoints})`);
    }
    if (result.acceptedDebt.length > 0) {
      summary.push(`${result.acceptedDebt.length} accepted debt (+${result.acceptedDebtPoints})`);
    }
    lines.push(`      ${kind}: ${summary.join(' · ')}`);
    for (const spec of result.pending) {
      lines.push(`        pending — ${spec.root}: ${spec.path} (${spec.note})`);
    }
    for (const spec of result.acceptedDebt) {
      lines.push(`        accepted debt — ${spec.root}: ${spec.path} (${spec.note})`);
    }
  }
  return lines;
}

/** `  <label>   <n> pts  <detail>` — the shape every dimension row shares. */
function dimensionLine(label, points, detail = '') {
  const score = `${points} pts`;
  const tail = detail ? `  ${detail}` : '';
  return `  ${pad(label, 14)} ${padStart(score, 8)}${tail}`;
}

function renderFeatureHeading(flag) {
  // The flag is presented as an attribute of the feature — when it is gone,
  // the feature keeps its line and simply reads "shipped".
  const flagMeta = flag.hasFlag
    ? `flag ${flag.key} · default ${flag.defaultValue}`
    : 'shipped — no flag';
  const meta = [flag.jira, `owner ${flag.owner}`, flagMeta].filter(Boolean).join(' · ');
  return [`${flag.id}  (${meta})`, `  ${flag.description}`, ''];
}

function renderCoverageSection(cov) {
  const summary = cov.status === 'measured'
    ? `${cov.files.length} owned file(s) analysed`
    : `unavailable (${cov.reason})`;
  const lines = [dimensionLine('coverage', cov.points, summary)];
  for (const file of cov.files.filter((entry) => entry.uncovered !== null)) {
    lines.push(`        ${file.path} — ${file.uncovered} uncovered (${file.points} pts)`);
  }
  return lines;
}

function lifecycleSummary(life) {
  if (life.ttl === null) return 'no TTL declared';
  if (life.daysRemaining >= 0) {
    return `ttl ${life.ttl} · ${life.daysRemaining} day(s) remaining`;
  }
  const overdue = -life.daysRemaining;
  return `ttl ${life.ttl} · ${overdue} day(s) overdue (${life.weeksOverdue} week(s))`;
}

function renderLifecycleSection(flag) {
  const lines = [dimensionLine('lifecycle', flag.lifecycle.points, lifecycleSummary(flag.lifecycle))];
  if (flag.ttlNote) lines.push(`        note: ${flag.ttlNote}`);
  return lines;
}

/** `5 pts`, plus whatever the report must disclose about a points override. */
function deferredBreakdown(item) {
  const unit = item.points === 1 ? 'pt' : 'pts';
  let breakdown = `${item.points} ${unit}`;
  if (item.pointsOverridden) breakdown += ', declared';
  if (item.pointsOverrideIgnored) {
    const declared = JSON.stringify(item.declaredPoints);
    breakdown += `, declared ${declared} IGNORED (not a whole number of points)`;
  }
  return breakdown;
}

function renderDeferredItem(item) {
  const label = item.kindRecognized ? item.kind : `${item.kind} → open rate`;
  const lines = [
    `        [${label}] ${item.id} — ${deferredBreakdown(item)}`,
    ...wrapText(item.note, 92, '          '),
  ];
  for (const component of item.components) {
    lines.push(`          · ${component.id}`);
    lines.push(...wrapText(component.note, 88, '              '));
    if (component.ref) lines.push(`              ref: ${component.ref}`);
  }
  for (const ref of item.refs) lines.push(`          ref: ${ref}`);
  return lines;
}

function renderDeferredSection(deferred) {
  if (deferred.items.length === 0) return [];
  const lines = [dimensionLine('open items', deferred.points, `${deferred.items.length} deferred`)];
  for (const item of deferred.items) lines.push(...renderDeferredItem(item));
  return lines;
}

function renderFeatureBlock(flag) {
  const tp = flag.touchPoints;
  const touchDetail = `${tp.files.length} file(s), ${tp.extraFiles} beyond the ${tp.freeAllowance} expected`;
  return [
    ...renderFeatureHeading(flag),
    dimensionLine('touch points', tp.points, touchDetail),
    ...renderTouchPointLines(tp),
    dimensionLine('tests', flag.tests.points),
    ...renderSpecLines(flag.tests),
    ...renderCoverageSection(flag.coverage),
    ...renderLifecycleSection(flag),
    ...renderDeferredSection(flag.deferred),
    '',
    dimensionLine('TOTAL', flag.total),
    '',
  ];
}

function renderSummaryTable(report) {
  const width = Math.max(7, ...report.features.map((flag) => flag.id.length));
  const header = `  ${pad('FEATURE', width)}  ${padStart('TOUCH', 6)}  ${padStart('TESTS', 6)}  `
    + `${padStart('COV', 5)}  ${padStart('LIFE', 5)}  ${padStart('OPEN', 5)}  ${padStart('TOTAL', 6)}`;
  const rows = report.features.map((flag) => `  ${pad(flag.id, width)}  `
    + `${padStart(flag.touchPoints.points, 6)}  ${padStart(flag.tests.points, 6)}  `
    + `${padStart(flag.coverage.points, 5)}  ${padStart(flag.lifecycle.points, 5)}  `
    + `${padStart(flag.deferred.points, 5)}  ${padStart(flag.total, 6)}`);
  return [header, ...rows];
}

export function renderConsole(report) {
  const heading = `Feature debt scorecard — ${report.features.length} feature(s) — ${report.generatedAt}`;
  const lines = ['', heading];
  if (report.roots.backendUnavailableReason) {
    lines.push(`  warning: ${report.roots.backendUnavailableReason}`);
  }
  lines.push('');
  for (const flag of report.features) lines.push(...renderFeatureBlock(flag));
  lines.push(...renderSummaryTable(report));
  lines.push('', '  Report only — v0 never fails a build. Scale: docs/flag-debt.md', '');
  return lines.join('\n');
}

// ── HTML rendering ──────────────────────────────────────────────────────────

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function htmlRow(label, points, detail, slot) {
  // The swatch is what ties a row to its segment in the composition bar; the
  // label carries the identity, so the colour is never the only cue.
  const swatch = slot ? `<span class="dot s${slot}"></span>` : '';
  const zero = points === 0 ? ' class="zero"' : '';
  return `<tr><th>${swatch}${escapeHtml(label)}</th><td class="pts"${zero}>${escapeHtml(points)}</td>`
    + `<td>${detail}</td></tr>`;
}

/** `<ul>…</ul>` around already-rendered `<li>` strings, or nothing when empty. */
function htmlList(items, className = '') {
  if (items.length === 0) return '';
  const attr = className ? ` class="${className}"` : '';
  return `<ul${attr}>${items.join('')}</ul>`;
}

function htmlTouchPointDetail(tp) {
  const summary = `${tp.files.length} file(s), ${tp.extraFiles} beyond the ${tp.freeAllowance} expected`;
  const fileItems = tp.files.map((file) => {
    const lineNumbers = escapeHtml(file.hits.map((hit) => hit.line).join(', '));
    const location = `${escapeHtml(file.root)}: ${escapeHtml(file.path)}`;
    return `<li><code>${location}</code> <span class="muted">lines ${lineNumbers}</span></li>`;
  });
  const parts = [summary, htmlList(fileItems)];
  if (tp.docReferences.length > 0) {
    parts.push(`<p class="muted">${tp.docReferences.length} documentation reference(s), not scored</p>`);
  }
  if (tp.testReferences.length > 0) {
    parts.push(`<p class="muted">${tp.testReferences.length} test reference(s), not scored</p>`);
  }
  return parts.join('');
}

function htmlSpecList(specs, label) {
  const items = specs.map((spec) => {
    const location = `${escapeHtml(spec.root)}: ${escapeHtml(spec.path)}`;
    return `<li><span class="tag">${escapeHtml(label)}</span> <code>${location}</code>`
      + ` <span class="muted">${escapeHtml(spec.note)}</span></li>`;
  });
  return htmlList(items);
}

function htmlTestDetail(tests) {
  return Object.entries(tests.kinds).map(([kind, result]) => {
    const present = result.declared - result.missing.length;
    const summary = [`${present}/${result.declared} present`];
    if (result.pending.length > 0) summary.push(`${result.pending.length} pending (+${result.flatPoints})`);
    if (result.acceptedDebt.length > 0) {
      summary.push(`${result.acceptedDebt.length} accepted debt (+${result.acceptedDebtPoints})`);
    }
    const headline = escapeHtml(summary.join(' · '));
    return `<p><strong>${escapeHtml(kind)}</strong>: ${headline}</p>`
      + htmlSpecList(result.pending, 'pending')
      + htmlSpecList(result.acceptedDebt, 'accepted debt');
  }).join('');
}

function htmlCoverageDetail(cov) {
  if (cov.status !== 'measured') {
    return `<span class="muted">unavailable (${escapeHtml(cov.reason)})</span>`;
  }
  const items = cov.files.map((file) => {
    const state = file.uncovered === null ? escapeHtml(file.note) : `${file.uncovered} uncovered`;
    return `<li><code>${escapeHtml(file.path)}</code> — ${state}</li>`;
  });
  return htmlList(items);
}

function htmlLifecycleDetail(flag) {
  const life = flag.lifecycle;
  const note = flag.ttlNote ? `<p class="muted">${escapeHtml(flag.ttlNote)}</p>` : '';
  if (life.ttl === null) return `<span class="muted">no TTL declared</span>${note}`;
  const ttl = escapeHtml(life.ttl);
  const state = life.daysRemaining >= 0
    ? `${life.daysRemaining} day(s) remaining`
    : `${-life.daysRemaining} day(s) overdue`;
  return `TTL ${ttl} — ${state}${note}`;
}

/** `5 pts`, plus whatever the card must disclose about a points override. */
function htmlItemPoints(item) {
  let text = `${item.points} pts`;
  if (item.pointsOverridden) text += ', declared';
  if (item.pointsOverrideIgnored) {
    const declared = escapeHtml(JSON.stringify(item.declaredPoints));
    text += `, declared ${declared} ignored`;
  }
  return `<span class="pts-inline">${text}</span>`;
}

function htmlDeferredItem(item) {
  const fallback = item.kindRecognized ? '' : ' &rarr; open rate';
  const tag = `<span class="tag ${escapeHtml(item.kind)}">${escapeHtml(item.kind)}${fallback}</span>`;
  const componentItems = item.components.map((component) => {
    const ref = component.ref ? ` <span class="muted">${escapeHtml(component.ref)}</span>` : '';
    return `<li><code>${escapeHtml(component.id)}</code> ${escapeHtml(component.note)}${ref}</li>`;
  });
  const refs = item.refs.length > 0
    ? `<p class="muted">${item.refs.map((ref) => escapeHtml(ref)).join('<br>')}</p>`
    : '';
  return `<li>${tag} <code>${escapeHtml(item.id)}</code> ${htmlItemPoints(item)}`
    + `<p>${escapeHtml(item.note)}</p>`
    + htmlList(componentItems, 'components')
    + refs
    + '</li>';
}

function htmlDeferredSection(deferred) {
  if (deferred.items.length === 0) return '';
  const heading = `— ${deferred.items.length} deferred, ${deferred.points} pts`;
  const items = deferred.items.map(htmlDeferredItem);
  return `
  <div class="deferred">
    <h3>Open items <span class="muted">${heading}</span></h3>
    ${htmlList(items)}
  </div>`;
}

/**
 * The part-to-whole bar plus its legend.
 *
 * The total is the sum of its dimensions, so one bar reads as a magnitude and
 * decomposes without a second chart. Every segment is directly labelled in the
 * legend, which is what discharges the light-mode contrast relief the palette
 * validator asks for, and the aria-label names each dimension for non-visual
 * readers.
 */
function renderComposition(carried) {
  if (carried.length === 0) {
    return '<p class="empty">No debt recorded against this flag.</p>';
  }
  const label = escapeHtml(carried.map((d) => `${d.label} ${d.points} points`).join(', '));
  const segments = carried
    .map((d) => `<span class="seg s${d.slot}" style="flex:${d.points}"></span>`)
    .join('');
  const legend = carried
    .map((d) => `<li><span class="dot s${d.slot}"></span>${escapeHtml(d.label)}`
      + ` <span class="legend-pts">${d.points}</span></li>`)
    .join('');
  return `<div class="bar" role="img" aria-label="${label}">${segments}</div>
    <ul class="legend">${legend}</ul>`;
}

/** The TTL chip in the metadata row: countdown, overdue, or no TTL at all. */
function ttlChip(life) {
  if (life.ttl === null) return 'no TTL';
  if (life.daysRemaining >= 0) return `TTL in ${life.daysRemaining}d`;
  return `TTL ${-life.daysRemaining}d overdue`;
}

function htmlFlagCard(flag) {
  const tp = flag.touchPoints;
  const touchDetail = htmlTouchPointDetail(tp);
  const testDetail = htmlTestDetail(flag.tests);
  const cov = flag.coverage;
  const covDetail = htmlCoverageDetail(cov);
  const life = flag.lifecycle;
  const lifeDetail = htmlLifecycleDetail(flag);
  const deferred = htmlDeferredSection(flag.deferred);

  // The total is the sum of its dimensions, so a part-to-whole bar is the honest
  // form: it reads as one magnitude and decomposes without a second chart. Each
  // segment is directly labelled, which is also what discharges the light-mode
  // contrast relief the palette validator asks for.
  const dimensions = [
    { slot: 1, label: 'Touch points', points: tp.points },
    { slot: 2, label: 'Tests', points: flag.tests.points },
    { slot: 3, label: 'Coverage', points: cov.points },
    { slot: 4, label: 'Lifecycle', points: life.points },
    { slot: 5, label: 'Open items', points: flag.deferred.points },
  ];
  const carried = dimensions.filter((dimension) => dimension.points > 0);

  const composition = renderComposition(carried);

  return `<section class="card">
  <header>
    <div class="ident">
      <h2><code>${escapeHtml(flag.id)}</code></h2>
      <p class="desc">${escapeHtml(flag.description)}</p>
    </div>
    <div class="score">
      <span class="score-num">${flag.total}</span>
      <span class="score-unit">pts</span>
    </div>
  </header>
  <ul class="meta">
    <li>${escapeHtml(flag.jira || 'no Jira')}</li>
    <li>owner ${escapeHtml(flag.owner)}</li>
    <li>default ${escapeHtml(flag.defaultValue)}</li>
    <li>created ${escapeHtml(flag.created || 'unknown')}</li>
    <li>${ttlChip(life)}</li>
  </ul>
  ${composition}
  <table>
    <thead><tr><th>Dimension</th><th class="pts">Points</th><th>Detail</th></tr></thead>
    <tbody>
      ${htmlRow('Touch points', tp.points, touchDetail, 1)}
      ${htmlRow('Tests', flag.tests.points, testDetail, 2)}
      ${htmlRow('Coverage', cov.points, covDetail, 3)}
      ${htmlRow('Lifecycle', life.points, lifeDetail, 4)}
    </tbody>
  </table>${deferred}
</section>`;
}

export function renderHtml(report) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Flag debt scorecard</title>
<style>
  /* Categorical slots are assigned in fixed order and never cycled; dark is the
     same hues re-stepped for the dark surface, not an automatic flip. Both
     orderings pass the CVD and normal-vision floors. */
  :root {
    color-scheme: light dark;
    --bg: #fcfcfb; --fg: #16181d; --muted: #666c78; --line: #dcdcd8; --card: #fff;
    --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a; --s4: #eda100; --s5: #4a3aa7;
    --serious: #ec835a; --critical: #d03b3b;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1a1a19; --fg: #e7e9ee; --muted: #9aa2b1; --line: #2f2f2d; --card: #212120;
      --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s5: #9085e9;
      --serious: #ec835a; --critical: #e26a6a;
    }
  }
  body { margin: 0; padding: 2.5rem 1rem 4rem; background: var(--bg); color: var(--fg);
         font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         -webkit-font-smoothing: antialiased; }
  main { max-width: 64rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; letter-spacing: -.01em; margin: 0 0 .25rem; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9em; }
  .muted { color: var(--muted); font-size: .9em; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px;
          padding: 1.4rem 1.5rem; margin: 1.5rem 0; }
  .card header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; }
  .ident { min-width: 0; }
  .card h2 { font-size: 1.05rem; margin: 0; }
  .desc { margin: .4rem 0 0; max-width: 46rem; }

  /* Hero number: the headline reads before any decomposition. */
  .score { display: flex; align-items: baseline; gap: .2rem; flex-shrink: 0;
           font-variant-numeric: tabular-nums; }
  .score-num { font-size: 2.6rem; font-weight: 650; letter-spacing: -.03em; line-height: 1; }
  .score-unit { font-size: .8rem; color: var(--muted); }

  .meta { display: flex; flex-wrap: wrap; gap: .4rem; list-style: none;
          margin: 1rem 0 1.1rem; padding: 0; }
  .meta li { font-size: .78rem; color: var(--muted); border: 1px solid var(--line);
             border-radius: 999px; padding: .1rem .55rem; }

  /* Part-to-whole bar: 2px surface gaps keep adjacent fills legible, and the
     rounded ends read as one mark rather than four. */
  .bar { display: flex; gap: 2px; height: 10px; border-radius: 5px; overflow: hidden; }
  .seg { min-width: 3px; }
  .empty { color: var(--muted); font-size: .9em; margin: .25rem 0 0; }
  .legend { display: flex; flex-wrap: wrap; gap: .1rem 1.1rem; list-style: none;
            margin: .7rem 0 0; padding: 0; font-size: .85rem; }
  .legend li { display: flex; align-items: center; gap: .4rem; color: var(--muted); }
  .legend-pts { color: var(--fg); font-weight: 600; font-variant-numeric: tabular-nums; }
  .dot { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; display: inline-block; }
  .s1, .dot.s1 { background: var(--s1); }
  .s2, .dot.s2 { background: var(--s2); }
  .s3, .dot.s3 { background: var(--s3); }
  .s4, .dot.s4 { background: var(--s4); }
  .s5, .dot.s5 { background: var(--s5); }
  .zero { color: var(--muted); }
  table { width: 100%; border-collapse: collapse; margin-top: 1.2rem; }
  th, td { text-align: left; vertical-align: top; padding: .6rem .6rem; border-top: 1px solid var(--line); }
  tbody th { font-weight: 600; white-space: nowrap; }
  tbody th .dot { margin-right: .5rem; vertical-align: baseline; }
  thead th { border-top: 0; font-size: .72rem; text-transform: uppercase; letter-spacing: .06em;
             color: var(--muted); font-weight: 600; padding-bottom: .35rem; }
  .pts { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 600; }
  ul { margin: .35rem 0; padding-left: 1.1rem; }
  .tag { display: inline-block; font-size: .7rem; text-transform: uppercase; letter-spacing: .05em;
         border: 1px solid var(--line); border-radius: 4px; padding: 0 .32rem; color: var(--muted);
         white-space: nowrap; }
  /* Status colours are reserved and always ship with the label beside them. */
  .tag.precondition { border-color: var(--serious); color: var(--serious); }
  .tag.cosmetic { opacity: .8; }
  .deferred { margin-top: 1.3rem; border-top: 1px solid var(--line); padding-top: 1rem; }
  .deferred h3 { font-size: .82rem; text-transform: uppercase; letter-spacing: .06em;
                 color: var(--muted); font-weight: 600; margin: 0 0 .5rem; }
  .deferred > ul { list-style: none; padding-left: 0; }
  .deferred > ul > li { margin: .6rem 0; }
  .pts-inline { font-variant-numeric: tabular-nums; font-weight: 600; font-size: .85em; }
  .components { margin: .35rem 0 .35rem .25rem; padding-left: 1rem; border-left: 2px solid var(--line); }
  .components li { margin: .25rem 0; }
  li { margin: .15rem 0; }
  p { margin: .35rem 0; }
  footer { color: var(--muted); font-size: .85em; margin-top: 2rem; }
</style>
</head>
<body>
<main>
  <h1>Flag debt scorecard <span class="muted">v0</span></h1>
  <p class="muted">Generated ${escapeHtml(report.generatedAt)} · ${report.features.length} feature(s)${
    report.roots.backendUnavailableReason ? ` · ${escapeHtml(report.roots.backendUnavailableReason)}` : ''
  }</p>
  ${report.features.map(htmlFlagCard).join('\n')}
  <footer>Higher is worse. Report only — v0 never fails a build. Scale and rules: docs/flag-debt.md</footer>
</main>
</body>
</html>
`;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

/** Flags that stand alone, mapped to the option each one sets. */
const BOOLEAN_ARGS = new Map([
  ['--json', 'json'],
  ['--html', 'html'],
  ['--help', 'help'],
  ['-h', 'help'],
]);

/** Options that take a value, either as `--opt value` or `--opt=value`. */
const VALUE_ARGS = new Map([
  ['--flag', { key: 'flag', parse: (value) => value }],
  ['--root', { key: 'repoRoot', parse: (value) => path.resolve(value) }],
  ['--registry', { key: 'registry', parse: (value) => path.resolve(value) }],
]);

/**
 * Reads a value option at `index`, returning how many argv entries it consumed.
 *
 * The loop counter is never reassigned from inside a branch: the caller advances
 * by what this reports, so the two forms (`--opt value` and `--opt=value`) differ
 * only in the number they return.
 */
function readValueArg(argv, index, options) {
  const arg = argv[index];
  const inline = arg.indexOf('=');
  if (inline !== -1) {
    const spec = VALUE_ARGS.get(arg.slice(0, inline));
    if (!spec) return 0;
    options[spec.key] = spec.parse(arg.slice(inline + 1));
    return 1;
  }
  const spec = VALUE_ARGS.get(arg);
  if (!spec) return 0;
  const value = argv[index + 1];
  if (value === undefined) throw new Error(`${arg} needs a value`);
  options[spec.key] = spec.parse(value);
  return 2;
}

export function parseArgs(argv) {
  const options = {
    json: false, html: false, flag: null, repoRoot: DEFAULT_REPO_ROOT, registry: null, help: false,
  };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    const booleanKey = BOOLEAN_ARGS.get(arg);
    if (booleanKey) {
      options[booleanKey] = true;
      i += 1;
      continue;
    }
    const consumed = readValueArg(argv, i, options);
    if (consumed === 0) throw new Error(`unknown option: ${arg}`);
    i += consumed;
  }
  return options;
}

const HELP = `flag-debt — per-flag technical-debt scorer (v0, report only)

Usage: node cli/src/flag-debt.js [options]

  --flag <key>       Score a single flag instead of every registered one
  --json             Also write flag-debt.json (git-ignored)
  --html             Also write flag-debt.html (git-ignored)
  --registry <path>  Registry file (default: <repo>/flags-registry.json)
  --root <path>      Repo root (default: inferred from this script)
  -h, --help         Show this help

Env: SONAR_TOKEN / SONAR_HOST_URL enable the coverage dimension.
     ETENDO_GO_MODULE points at the com.etendoerp.go checkout.
Docs: docs/flag-debt.md
`;

/**
 * Runs the scorer and returns the report, or `null` when there was nothing to
 * score (help, or a name that matches no feature).
 *
 * It returns the report rather than an exit code because in v0 the exit code
 * carries no information — debt never fails a build — while the report is what
 * a caller actually wants. The CLI wrapper below owns the exit status.
 */
export function main(argv = process.argv.slice(2), { stdout = process.stdout } = {}) {
  const options = parseArgs(argv);
  if (options.help) {
    stdout.write(HELP);
    return null;
  }

  const registryPath = options.registry || path.join(options.repoRoot, REGISTRY_FILENAME);
  const registry = loadRegistry(registryPath);
  if (options.flag) {
    registry.features = registry.features.filter((feature) => feature.id === options.flag || feature.key === options.flag);
    if (registry.features.length === 0) {
      stdout.write(`No feature or flag "${options.flag}" in ${registryPath}\n`);
      return null;
    }
  }

  const { frontend, backend, backendUnavailableReason } = resolveRoots(registry, { repoRoot: options.repoRoot });
  const report = buildReport(registry, {
    roots: { frontend, backend },
    backendUnavailableReason,
    frameworkPaths: (registry.conventions && registry.conventions.frameworkPaths) || [],
    repoRoot: options.repoRoot,
    now: new Date(),
  });

  stdout.write(renderConsole(report));

  if (options.json) {
    const target = path.join(options.repoRoot, 'flag-debt.json');
    fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
    stdout.write(`  JSON written to ${target}\n`);
  }
  if (options.html) {
    const target = path.join(options.repoRoot, 'flag-debt.html');
    fs.writeFileSync(target, renderHtml(report));
    stdout.write(`  HTML written to ${target}\n`);
  }
  return report;
}

if (isMainModule(import.meta.url)) {
  try {
    main();
    // v0 is report-only: debt never sets a non-zero status. Only a usage error
    // does, in the catch below.
    process.exitCode = 0;
  } catch (error) {
    // A broken invocation or an unreadable registry is a usage error, and is the
    // only way this command fails: debt itself never sets a non-zero exit in v0.
    process.stderr.write(`flag-debt: ${error.message}\n`);
    process.exitCode = 2;
  }
}
