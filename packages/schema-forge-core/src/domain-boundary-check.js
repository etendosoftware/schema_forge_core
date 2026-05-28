import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  analyzeBoundary,
  collectArtifactWindows,
  getChangedFiles,
  loadBoundaryPolicy,
  loadPrBody,
  renderBoundaryReport,
} from './domain-boundary/classifier.js';

export {
  DEFAULT_BOUNDARY_POLICY,
  VERTICAL_WINDOWS,
  analyzeBoundary,
  classifyPath,
  collectArtifactWindows,
  getChangedFiles,
  loadBoundaryPolicy,
  loadPrBody,
  renderBoundaryReport,
  verticalForWindows,
} from './domain-boundary/classifier.js';

function parseArgs(argv) {
  const options = {
    rootDir: process.cwd(),
    headRef: 'HEAD',
    labels: [],
    format: 'text',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index];
    if (arg === '--base') {
      options.baseRef = next();
    } else if (arg === '--head') {
      options.headRef = next();
    } else if (arg === '--root') {
      options.rootDir = next();
    } else if (arg === '--labels') {
      options.labels = next().split(',').map((label) => label.trim()).filter(Boolean);
    } else if (arg === '--pr-body-file') {
      options.prBodyFile = next();
    } else if (arg === '--policy-file') {
      options.policyFile = next();
    } else if (arg === '--format') {
      options.format = next();
    } else if (arg === '--output') {
      options.output = next();
    } else if (arg === '--json') {
      options.json = next();
    } else if (arg === '--changed-file') {
      options.changedFiles = [...(options.changedFiles ?? []), next()];
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: sf-domain-boundary-check --base <ref> [--head <ref>]

Options:
  --base <ref>             Base ref/SHA for merge-base diff
  --head <ref>             Head ref/SHA (default: HEAD)
  --labels <csv>           PR labels, comma-separated
  --pr-body-file <path>    PR body markdown used to validate exception plans
  --policy-file <path>     Optional JSON policy override/additions
  --changed-file <path>    Explicit changed file; may be repeated (skips git diff)
  --format text|json       Console format (default: text)
  --output <path>          Write markdown report
  --json <path>            Write JSON report
`);
}

export function runDomainBoundaryCheckCli(argv = process.argv.slice(2), {
  cwd = process.cwd(),
  stdout = console.log,
  stderr = console.error,
} = {}) {
  try {
    const options = parseArgs(argv);
    if (options.help) {
      printHelp();
      return 0;
    }

    const rootDir = resolve(cwd, options.rootDir);
    const policy = loadBoundaryPolicy(
      rootDir,
      options.policyFile ? resolve(rootDir, options.policyFile) : null,
    );
    const knownWindows = collectArtifactWindows(rootDir);
    let changedFiles = options.changedFiles;
    let diff = null;

    if (!changedFiles) {
      if (!options.baseRef) {
        throw new Error('--base is required unless --changed-file is provided');
      }
      diff = getChangedFiles({
        rootDir,
        baseRef: options.baseRef,
        headRef: options.headRef,
      });
      changedFiles = diff.changedFiles;
    }

    const report = analyzeBoundary({
      changedFiles,
      knownWindows,
      labels: options.labels,
      prBody: loadPrBody(options.prBodyFile),
      policy,
    });

    const payload = {
      ...report,
      diff: diff ? {
        mergeBase: diff.mergeBase,
        baseRef: options.baseRef,
        headRef: options.headRef,
      } : null,
    };
    const markdown = renderBoundaryReport(payload);

    if (options.output) {
      writeFileSync(options.output, markdown);
    }
    if (options.json) {
      writeFileSync(options.json, `${JSON.stringify(payload, null, 2)}\n`);
    }

    if (options.format === 'json') {
      stdout(JSON.stringify(payload, null, 2));
    } else {
      stdout(markdown);
    }

    return report.decision === 'fail' ? 1 : 0;
  } catch (error) {
    stderr(`domain-boundary-check: ${error.message}`);
    return 2;
  }
}
