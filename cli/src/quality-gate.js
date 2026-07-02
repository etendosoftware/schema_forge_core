#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBaseline } from './quality-gate/baseline.js';
import { loadQualityGateConfig, QualityGateConfigError } from './quality-gate/config.js';
import { collectDecisionWindows, detectAffectedWindows, detectAffectedWindowsDetailed, getChangedFiles, resolveGitRef } from './quality-gate/detect.js';
import { runQualityGate } from './quality-gate/runner.js';
import { buildQualityGateAnalysisBundle, buildQualityGateReport } from './quality-gate/report.js';
import { QUALITY_GATE_CHECKS } from './quality-gate/checks/index.js';
import { isMainModule } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = process.env.SF_ROOT || join(__dirname, '..', '..');

function collectRuntimeFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectRuntimeFiles(fullPath));
      continue;
    }
    if (fullPath.endsWith('.js') || fullPath.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function hashCacheInputs(rootDir, config) {
  const hash = createHash('sha1');
  hash.update(JSON.stringify(config));
  for (const filePath of [
    ...collectRuntimeFiles(join(rootDir, 'cli', 'src', 'quality-gate')),
    join(rootDir, 'cli', 'src', 'quality-gate.js'),
    join(rootDir, 'schemas', 'contract.schema.json'),
    join(rootDir, 'schemas', 'quality-gate-config.schema.json'),
  ]) {
    if (!existsSync(filePath)) {
      continue;
    }
    hash.update(filePath);
    hash.update(readFileSync(filePath, 'utf8'));
  }
  return hash.digest('hex').slice(0, 12);
}

function writeTextFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

async function computeBaselineWithWorktree({ rootDir, baselineSha, windowNames, config, runner }) {
  const worktreePath = join(rootDir, '.quality-gate-cache', 'worktree', baselineSha.slice(0, 12));
  mkdirSync(dirname(worktreePath), { recursive: true });

  try {
    execFileSync('git', ['worktree', 'add', '--detach', '--force', worktreePath, baselineSha], {
      cwd: rootDir,
      encoding: 'utf8',
    });

    return await runner({
      windowNames,
      rootDir: worktreePath,
      config,
      checkers: QUALITY_GATE_CHECKS,
    });
  } finally {
    try {
      execFileSync('git', ['worktree', 'remove', '--force', worktreePath], {
        cwd: rootDir,
        encoding: 'utf8',
      });
    } catch {
      // Best effort cleanup; missing baseline should degrade to head-only enforcement.
    }
  }
}

export function parseQualityGateArgs(argv) {
  const options = {
    mode: 'pr-affected',
    windowName: null,
    baselineRef: null,
    headRef: 'HEAD',
    format: 'md',
    outputPath: null,
    jsonPath: null,
    analysisDir: null,
  };

  let index = 0;
  while (index < argv.length) {
    const arg = argv[index];
    if (isWindowFlagWithArgument(arg, argv, index)) {
      options.mode = 'window';
      options.windowName = argv[index + 1];
      index += 2;
    } else if (arg === '--all') {
      options.mode = 'all';
      index += 1;
    } else if (arg === '--pr-affected') {
      options.mode = 'pr-affected';
      index += 1;
    } else if (isBaselineRefFlag(arg, argv, index)) {
      options.baselineRef = argv[index + 1];
      index += 2;
    } else if (isHeadRefFlag(arg, argv, index)) {
      options.headRef = argv[index + 1];
      index += 2;
    } else if (isFormatFlagWithArgument(arg, argv, index)) {
      options.format = argv[index + 1];
      index += 2;
    } else if (isOutputFlagWithArgument(arg, argv, index)) {
      options.outputPath = argv[index + 1];
      index += 2;
    } else if (isJsonFlagWithArgument(arg, argv, index)) {
      options.jsonPath = argv[index + 1];
      index += 2;
    } else if (arg === '--analysis-dir' && argv[index + 1]) {
      options.analysisDir = argv[index + 1];
      index += 2;
    } else {
      index += 1;
    }
  }

  if (options.mode === 'window' && !options.windowName) {
    throw new Error('Usage: quality-gate.js --window <name> | --all | --pr-affected [--baseline-ref <ref>] [--head-ref <ref>] [--format md|json] [--output <path>] [--json <path>] [--analysis-dir <dir>]');
  }

  return options;
}

function isJsonFlagWithArgument(arg, argv, index) {
  return arg === '--json' && argv[index + 1];
}

function isOutputFlagWithArgument(arg, argv, index) {
  return arg === '--output' && argv[index + 1];
}

function isFormatFlagWithArgument(arg, argv, index) {
  return arg === '--format' && argv[index + 1];
}

function isHeadRefFlag(arg, argv, index) {
  return arg === '--head-ref' && argv[index + 1];
}

function isBaselineRefFlag(arg, argv, index) {
  return arg === '--baseline-ref' && argv[index + 1];
}

function isWindowFlagWithArgument(arg, argv, index) {
  return arg === '--window' && argv[index + 1];
}

export async function runQualityGateCli({ args = process.argv.slice(2), rootDir = ROOT, deps = {} } = {}) {
  const options = parseQualityGateArgs(args);

  const loadConfig = deps.loadConfig ?? loadQualityGateConfig;
  const collectWindows = deps.collectDecisionWindows ?? collectDecisionWindows;
  const detectWindows = deps.detectAffectedWindows ?? detectAffectedWindows;
  const detectWindowsDetailed = deps.detectAffectedWindowsDetailed ?? detectAffectedWindowsDetailed;
  const changedFilesForPr = deps.getChangedFiles ?? getChangedFiles;
  const qualityRunner = deps.runQualityGate ?? ((params) => runQualityGate({ ...params, checkers: QUALITY_GATE_CHECKS }));

  const config = await loadConfig(rootDir);
  const baselineRef = options.baselineRef ?? config.gate?.baselineRef ?? 'origin/main';

  const availableWindows = options.mode === 'window'
    ? [options.windowName]
    : collectWindows(rootDir);

  const changedFiles = options.mode === 'pr-affected'
    ? await changedFilesForPr({ rootDir, baselineRef, headRef: options.headRef })
    : [];

  const affectedWindowMetadata = getAffectedWindows(options, availableWindows, detectWindowsDetailed, changedFiles, config);

  const windowNames = getWindowNames(options, availableWindows, detectWindows, changedFiles, config);

  if (windowNames.length === 0) {
    const stdout = '<!-- sfqg-report -->\nNo windows affected; gate skipped\n';
    if (options.outputPath) {
      writeTextFile(options.outputPath, stdout);
    }
    if (options.jsonPath) {
      writeTextFile(options.jsonPath, `${JSON.stringify({ summary: null, windows: [], skipped: true }, null, 2)}\n`);
    }
    return {
      exitCode: 0,
      stdout,
      summary: null,
      report: null,
      analysisDir: null,
    };
  }

  const baselineResult = await (deps.resolveBaseline ?? ((params) => resolveBaseline(params)))({
    baselineRef,
    cacheDir: join(rootDir, '.quality-gate-cache'),
    configHash: hashCacheInputs(rootDir, config),
    resolveRefSha: async (ref) => resolveGitRef(rootDir, ref),
    computeBaseline: async ({ baselineSha }) => computeBaselineWithWorktree({
      rootDir,
      baselineSha,
      windowNames,
      config,
      runner: qualityRunner,
    }),
  });

  const headResult = await qualityRunner({
    windowNames,
    rootDir,
    config,
    checkers: QUALITY_GATE_CHECKS,
  });

  const report = buildQualityGateReport({
    baselineRef,
    headRef: options.headRef,
    baselineSha: baselineResult?.baselineSha ?? null,
    headResult,
    baselineResult: baselineResult?.data ?? null,
    baselineWarning: baselineResult?.warning ?? null,
    affectedWindowMetadata,
  });

  const analysisDir = options.analysisDir ?? (options.mode === 'all'
    ? join(rootDir, '.quality-gate-cache', 'analysis', 'quality-gate-all')
    : null);

  if (options.outputPath) {
    writeTextFile(options.outputPath, report.markdown);
  }
  if (options.jsonPath) {
    writeTextFile(options.jsonPath, `${JSON.stringify(report.json, null, 2)}\n`);
  }
  if (analysisDir) {
    const bundle = buildQualityGateAnalysisBundle(report);
    writeTextFile(join(analysisDir, 'report.json'), bundle.reportJson);
    writeTextFile(join(analysisDir, 'summary.csv'), bundle.summaryCsv);
    writeTextFile(join(analysisDir, 'checks.csv'), bundle.checksCsv);
    writeTextFile(join(analysisDir, 'checks.jsonl'), bundle.checksJsonl);
  }

  return {
    exitCode: report.summary.gateVerdict === 'FAIL' ? 1 : 0,
    stdout: options.format === 'json' ? `${JSON.stringify(report.json, null, 2)}\n` : report.markdown,
    summary: report.summary,
    report,
    analysisDir,
  };
}

const isMain = isMainModule(import.meta.url);

if (isMain) {
  try {
    const result = await runQualityGateCli();
    process.stdout.write(result.stdout);
    process.exit(result.exitCode);
  } catch (error) {
    if (error instanceof QualityGateConfigError) {
      console.error(error.message);
      process.exit(error.exitCode);
    }
    console.error(error.message || String(error));
    process.exit(1);
  }
}
export function getWindowNames(options, availableWindows, detectWindows, changedFiles, config) {
  if (options.mode === 'window') {
    return [options.windowName];
  }
  if (options.mode === 'all') {
    return availableWindows;
  }
  return detectWindows({
    changedFiles,
    blastRadius: config.blastRadius ?? [],
    availableWindows,
  });
}

export function getAffectedWindows(options, availableWindows, detectWindowsDetailed, changedFiles, config) {
  if (options.mode === 'window') {
    return [{ window: options.windowName, source: 'direct' }];
  }
  if (options.mode === 'all') {
    return availableWindows.map((window) => ({ window, source: 'direct' }));
  }
  return detectWindowsDetailed({
    changedFiles,
    blastRadius: config.blastRadius ?? [],
    availableWindows,
  });
}

