function scoreText(score) {
  return `${score.passed}/${score.total}`;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function isFailureStatus(status) {
  return status === 'fail' || status === 'error';
}

function baselineWindowMap(baselineResult) {
  const map = new Map();
  for (const window of baselineResult?.windows ?? []) {
    map.set(window.window, window);
  }
  return map;
}

function summarizeRegressionChecks(windows) {
  const counts = new Map();
  for (const window of windows) {
    for (const check of window.introducedFailures) {
      counts.set(check.check, (counts.get(check.check) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([check, count]) => `${check} (${count})`);
}

function renderRegressionDetails(window) {
  if (window.introducedFailures.length === 0) {
    return [
      `### ${window.window} — score regression`,
      '',
      `- Score regressed from ${scoreText(window.baseline)} to ${scoreText(window.score)}.`,
      '',
    ].join('\n');
  }

  return window.introducedFailures.map((check) => {
    return [
      `### ${window.window} — ${check.check}`,
      '',
      `**${check.check}** (${check.severity})`,
      `- ${check.detail}`,
      '',
    ].join('\n');
  }).join('\n');
}

function renderNextActions({ gateVerdict, baselineRef, regressionWindows, regressionChecks }) {
  if (gateVerdict !== 'FAIL') {
    return [
      '### What to do next',
      '',
      '- No regressions were introduced by this PR compared with baseline.',
      '- Existing baseline debt in affected windows is intentionally omitted from this comment.',
      '',
    ].join('\n');
  }

  const lines = [
    '### What to do next',
    '',
    `- Fix the regressions introduced in ${pluralize(regressionWindows.length, 'window')}.`,
  ];

  if (regressionChecks.length > 0) {
    lines.push(`- Start with the new blocker checks that hit the most windows: ${regressionChecks.join(', ')}.`);
  }

  const scoreOnlyWindows = regressionWindows.filter((window) => window.scoreRegression && window.introducedFailures.length === 0);
  if (scoreOnlyWindows.length > 0) {
    lines.push(`- Investigate score-only regressions in: ${scoreOnlyWindows.map((window) => window.window).join(', ')}.`);
  }

  lines.push(
    `- Re-run \`node cli/src/quality-gate.js --pr-affected --baseline-ref ${baselineRef}\` locally before pushing.`,
    '- Use the regression details below to jump directly to the failing files or score drops introduced by this PR.',
    '',
  );

  return lines.join('\n');
}

export function buildQualityGateReport({ baselineRef, baselineSha, headResult, baselineResult, baselineWarning = null }) {
  const baselineByWindow = baselineWindowMap(baselineResult);
  const windows = headResult.windows.map((window) => {
    const baselineWindow = baselineByWindow.get(window.window) ?? null;
    const baseline = baselineWindow?.score ?? null;
    const baselineChecks = new Map((baselineWindow?.checks ?? []).map((check) => [check.check, check]));
    const introducedFailures = window.checks.filter((check) => {
      if (!isFailureStatus(check.status)) {
        return false;
      }
      const baselineCheck = baselineChecks.get(check.check);
      return !baselineCheck || !isFailureStatus(baselineCheck.status);
    });
    const delta = baseline ? window.score.passed - baseline.passed : 0;
    const scoreRegression = Boolean(baseline) && delta < 0 && window.verdict !== 'NO-OP';
    return {
      ...window,
      baseline,
      delta,
      introducedFailures,
      introducedFailureChecks: introducedFailures.map((check) => check.check),
      scoreRegression,
    };
  });

  const regressionWindows = windows.filter((window) => window.introducedFailures.length > 0 || window.scoreRegression);
  const gateVerdict = regressionWindows.length > 0 ? 'FAIL' : 'PASS';
  const regressionChecks = summarizeRegressionChecks(regressionWindows);

  const summary = {
    gateVerdict,
    baselineRef,
    baselineSha,
    affectedWindows: headResult.summary.affectedWindows,
    regressionWindows: regressionWindows.length,
    regressionFailures: regressionWindows.map((window) => window.window),
    regressionChecks,
    windows: windows.map((window) => ({
      window: window.window,
      verdict: window.verdict,
      score: window.score,
      baseline: window.baseline,
      delta: window.delta,
      blockerFailures: window.blockerFailures,
      introducedFailureChecks: window.introducedFailureChecks,
      scoreRegression: window.scoreRegression,
    })),
  };

  const lines = [
    '<!-- sfqg-report -->',
    '## Schema Forge Quality Gate',
    '',
    'This comment lists only regressions introduced by this PR compared with the baseline branch.',
    '',
    `Baseline: ${baselineRef}${baselineSha ? ` @ ${baselineSha}` : ''}`,
    `Affected windows: ${summary.affectedWindows}`,
    `Regressing windows: ${summary.regressionWindows}`,
    `Gate verdict: ${summary.gateVerdict}`,
  ];

  if (baselineWarning) {
    lines.push('', `Warning: ${baselineWarning}`);
  }
  if (summary.regressionChecks.length > 0) {
    lines.push('', `Regressing checks: ${summary.regressionChecks.join(', ')}`);
  }

  lines.push('', renderNextActions({
    gateVerdict,
    baselineRef,
    regressionWindows,
    regressionChecks,
  }));

  if (regressionWindows.length > 0) {
    lines.push(
      '<details>',
      '<summary>Regression details</summary>',
      '',
      '| Window | PR score | Baseline | Delta | New blockers |',
      '|---|---:|---:|---:|---|',
      ...regressionWindows.map((window) => {
        const blockers = window.introducedFailureChecks.length > 0
          ? window.introducedFailureChecks.join(', ')
          : 'score regression';
        return `| ${window.window} | ${scoreText(window.score)} | ${window.baseline ? scoreText(window.baseline) : '—'} | ${window.delta} | ${blockers} |`;
      }),
      '',
      ...regressionWindows.map(renderRegressionDetails).filter(Boolean),
      '</details>',
      '',
    );
  }

  return {
    summary,
    markdown: lines.join('\n').trimEnd() + '\n',
    json: {
      summary,
      windows,
      regressionWindows,
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
