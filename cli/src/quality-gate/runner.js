import { join } from 'node:path';

function normalizeCheckResult(check, severity, result) {
  return {
    check,
    severity,
    status: result?.status ?? 'skip',
    detail: result?.detail ?? '',
  };
}

function getVerdict(blockerChecks, skippedBlockers, blockerFailures) {
  if (blockerChecks > 0 && blockerChecks === skippedBlockers) {
    return 'NO-OP';
  } else {
    return blockerFailures.length > 0
        ? 'FAIL'
        : 'PASS';
  }
}

async function runChecker(checkers, check, windowName, rootDir, windowDir, config) {

  try {
    const checker = checkers[check];
    if (checker) {
      return await checker(windowName, {rootDir, windowDir, config});
    } else {
      return {status: 'skip', detail: `Check '${check}' is not registered`};
    }
  } catch (error) {
    return {
      status: 'error',
      detail: error?.stack || error?.message || String(error),
    };
  }
}

async function evaluateWindowChecks(enabledChecks, checkers, windowName, rootDir, windowDir, config) {
  const checks = [];
  const blockerFailures = [];
  let applicableChecks = 0;
  let passingChecks = 0;
  let blockerChecks = 0;
  let skippedBlockers = 0;

  for (const {check, severity} of enabledChecks) {
    let result = await runChecker(checkers, check, windowName, rootDir, windowDir, config);

    const normalized = normalizeCheckResult(check, severity, result);
    checks.push(normalized);

    if (normalized.status !== 'skip') {
      applicableChecks += 1;
    }
    if (normalized.status === 'pass') {
      passingChecks += 1;
    }

    if (severity === 'blocker') {
      blockerChecks += 1;
      if (normalized.status === 'skip') {
        skippedBlockers += 1;
      }
      if (normalized.status === 'fail' || normalized.status === 'error') {
        blockerFailures.push(check);
      }
    }
  }
  return {checks, blockerFailures, applicableChecks, passingChecks, blockerChecks, skippedBlockers};
}

export async function runQualityGate({ windowNames, rootDir, config, checkers }) {
  const enabledChecks = Object.entries(config.checks ?? {})
    .filter(([, definition]) => definition?.enabled)
    .map(([check, definition]) => ({ check, severity: definition.severity ?? 'blocker' }));

  const windows = [];

  for (const windowName of windowNames) {
    const windowDir = join(rootDir, 'artifacts', windowName);
    let {
      checks,
      blockerFailures,
      applicableChecks,
      passingChecks,
      blockerChecks,
      skippedBlockers
    } = await evaluateWindowChecks(enabledChecks, checkers, windowName, rootDir, windowDir, config);

    let verdict = getVerdict(blockerChecks, skippedBlockers, blockerFailures);

    windows.push({
      window: windowName,
      verdict,
      score: {
        passed: passingChecks,
        total: applicableChecks,
      },
      blockerFailures,
      checks,
    });
  }

  const scoredWindows = windows.filter((window) => window.verdict !== 'NO-OP');
  const failedWindows = scoredWindows.filter((window) => window.verdict === 'FAIL');

  return {
    windows,
    summary: {
      gateVerdict: failedWindows.length > 0 ? 'FAIL' : 'PASS',
      affectedWindows: windows.length,
      scoredWindows: scoredWindows.length,
      failedWindows: failedWindows.length,
    },
  };
}
