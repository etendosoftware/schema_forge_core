function scoreText(score) {
  return `${score.passed}/${score.total}`;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function baselineScoreMap(baselineResult) {
  const map = new Map();
  for (const window of baselineResult?.windows ?? []) {
    map.set(window.window, window.score ?? null);
  }
  return map;
}
function renderFailures(window) {
  const failingChecks = window.checks.filter((check) => check.status === 'fail' || check.status === 'error');
  if (failingChecks.length === 0) {
    return '';
  }

  return failingChecks.map((check) => {
    return [
      `### ${window.window} — ${check.check}`,
      '',
      `**${check.check}** (${check.severity})`,
      `- ${check.detail}`,
      '',
    ].join('\n');
  }).join('\n');
}

function summarizeFailingChecks(windows) {
  const counts = new Map();
  for (const window of windows) {
    for (const check of window.checks.filter((entry) => entry.status === 'fail' || entry.status === 'error')) {
      counts.set(check.check, (counts.get(check.check) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([check, count]) => `${check} (${count})`);
}

function renderNextActions({ gateVerdict, baselineRef, failingWindows, regressionWindows, failingChecks }) {
  if (gateVerdict !== 'FAIL') {
    return [
      '### What to do next',
      '',
      '- No blocker or regression failures detected.',
      '- Merge or continue review as usual.',
      '',
    ].join('\n');
  }

  const lines = [
    '### What to do next',
    '',
    `- Fix the blocker failures in ${pluralize(failingWindows.length, 'window')}.`,
  ];

  if (failingChecks.length > 0) {
    lines.push(`- Start with the failing checks that hit the most windows: ${failingChecks.join(', ')}.`);
  }
  if (regressionWindows.length > 0) {
    lines.push(`- Recover the windows that regressed below baseline: ${regressionWindows.map((window) => window.window).join(', ')}.`);
  }

  lines.push(
    `- Re-run \`node cli/src/quality-gate.js --pr-affected --baseline-ref ${baselineRef}\` locally before pushing.`,
    '- Use the detailed sections below to jump directly to the failing files and invariants.',
    '',
  );

  return lines.join('\n');
}

export function buildQualityGateReport({ baselineRef, baselineSha, headResult, baselineResult, baselineWarning = null }) {
  const baselineByWindow = baselineScoreMap(baselineResult);
  const windows = headResult.windows.map((window) => {
    const baseline = baselineByWindow.get(window.window) ?? null;
    const delta = baseline ? window.score.passed - baseline.passed : 0;
    return {
      ...window,
      baseline,
      delta,
    };
  });

  const regressionWindows = windows.filter((window) => window.baseline && window.delta < 0 && window.verdict !== 'NO-OP');
  const gateVerdict = headResult.summary.gateVerdict === 'FAIL' || regressionWindows.length > 0 ? 'FAIL' : 'PASS';

  const failingWindows = windows.filter((window) => window.verdict === 'FAIL');
  const failingChecks = summarizeFailingChecks(failingWindows);

  const summary = {
    gateVerdict,
    baselineRef,
    baselineSha,
    affectedWindows: headResult.summary.affectedWindows,
    failingWindows: failingWindows.length,
    regressionFailures: regressionWindows.map((window) => window.window),
    failingChecks,
    windows: windows.map((window) => ({
      window: window.window,
      verdict: window.verdict,
      score: window.score,
      baseline: window.baseline,
      delta: window.delta,
      blockerFailures: window.blockerFailures,
    })),
  };

  const lines = [
    '<!-- sfqg-report -->',
    '## Schema Forge Quality Gate',
    '',
    `Baseline: ${baselineRef}${baselineSha ? ` @ ${baselineSha}` : ''}`,
    `Affected windows: ${summary.affectedWindows}`,
    `Failing windows: ${summary.failingWindows}`,
    `Gate verdict: ${summary.gateVerdict}`,
  ];

  if (baselineWarning) {
    lines.push('', `Warning: ${baselineWarning}`);
  }
  if (summary.regressionFailures.length > 0) {
    lines.push('', `Regression failures: ${summary.regressionFailures.join(', ')}`);
  }
  if (summary.failingChecks.length > 0) {
    lines.push('', `Failing checks: ${summary.failingChecks.join(', ')}`);
  }

  lines.push('', renderNextActions({
    gateVerdict,
    baselineRef,
    failingWindows,
    regressionWindows,
    failingChecks,
  }));

  lines.push(
    '',
    '| Window | Score | Baseline | Delta | Blockers failed |',
    '|---|---:|---:|---:|---|',
    ...windows.map((window) => {
      const baseline = window.baseline ? scoreText(window.baseline) : '—';
      const blockerFailures = window.blockerFailures.length > 0 ? window.blockerFailures.join(', ') : '—';
      return `| ${window.window} | ${scoreText(window.score)} | ${baseline} | ${window.delta} | ${blockerFailures} |`;
    }),
    '',
  );

  const failureSections = windows.map(renderFailures).filter(Boolean);
  if (failureSections.length > 0) {
    lines.push(...failureSections);
  }

  return {
    summary,
    markdown: lines.join('\n').trimEnd() + '\n',
    json: {
      summary,
      windows,
      baselineWarning,
    },
  };
}

function csvCell(value) {
  const normalized = value == null ? '' : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replaceAll('"', '""')}"`;
  }
  return normalized;
}

function toCsv(columns, rows) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row[column])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function buildQualityGateAnalysisBundle(report) {
  const windows = report.json.windows ?? [];
  const summaryRows = windows.map((window) => ({
    window: window.window,
    verdict: window.verdict,
    score_passed: window.score?.passed ?? 0,
    score_total: window.score?.total ?? 0,
    baseline_passed: window.baseline?.passed ?? '',
    baseline_total: window.baseline?.total ?? '',
    delta: window.delta ?? 0,
    blocker_failures: (window.blockerFailures ?? []).join('|'),
  }));

  const checkRows = windows.flatMap((window) => (window.checks ?? []).map((check) => ({
    window: window.window,
    verdict: window.verdict,
    check: check.check,
    severity: check.severity,
    status: check.status,
    detail: check.detail,
    score_passed: window.score?.passed ?? 0,
    score_total: window.score?.total ?? 0,
    baseline_passed: window.baseline?.passed ?? '',
    baseline_total: window.baseline?.total ?? '',
    delta: window.delta ?? 0,
  })));

  return {
    summaryCsv: toCsv([
      'window',
      'verdict',
      'score_passed',
      'score_total',
      'baseline_passed',
      'baseline_total',
      'delta',
      'blocker_failures',
    ], summaryRows),
    checksCsv: toCsv([
      'window',
      'check',
      'severity',
      'status',
      'detail',
      'verdict',
      'score_passed',
      'score_total',
      'baseline_passed',
      'baseline_total',
      'delta',
    ], checkRows),
    checksJsonl: checkRows.map((row) => JSON.stringify(row)).join('\n') + (checkRows.length > 0 ? '\n' : ''),
    reportJson: `${JSON.stringify(report.json, null, 2)}\n`,
  };
}
