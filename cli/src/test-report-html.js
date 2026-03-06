#!/usr/bin/env node
// test-report-html.js — Convert JUnit XML test report to self-contained HTML
// Zero dependencies: parses JUnit XML with regex (simple, predictable format)

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const inputPath = resolve(process.argv[2] || 'artifacts/test-report.xml');
const outputPath = resolve(process.argv[3] || 'artifacts/test-report.html');

const xml = readFileSync(inputPath, 'utf8');

// --- Parse JUnit XML ---

function parseTestSuites(xml) {
  const suites = [];
  // Match each <testsuite ...>...</testsuite> block
  const suiteRegex = /<testsuite\s([^>]*)>([\s\S]*?)<\/testsuite>/g;
  let match;

  while ((match = suiteRegex.exec(xml)) !== null) {
    const attrs = parseAttrs(match[1]);
    const body = match[2];
    const tests = parseTestCases(body);
    suites.push({
      name: attrs.name || 'Unknown Suite',
      tests: parseInt(attrs.tests || '0', 10),
      failures: parseInt(attrs.failures || '0', 10),
      errors: parseInt(attrs.errors || '0', 10),
      time: parseFloat(attrs.time || '0'),
      testCases: tests,
    });
  }

  // If no <testsuite> found, try top-level <testsuites> with direct <testcase>
  if (suites.length === 0) {
    const cases = parseTestCases(xml);
    if (cases.length > 0) {
      suites.push({
        name: 'Test Suite',
        tests: cases.length,
        failures: cases.filter(t => t.failure).length,
        errors: 0,
        time: cases.reduce((s, t) => s + t.time, 0),
        testCases: cases,
      });
    }
  }

  return suites;
}

function parseTestCases(body) {
  const cases = [];
  // Self-closing: <testcase ... />
  // With body: <testcase ...>...(failure)...</testcase>
  const caseRegex = /<testcase\s([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
  let m;
  while ((m = caseRegex.exec(body)) !== null) {
    const attrs = parseAttrs(m[1]);
    const inner = m[2] || '';
    let failure = null;
    const failMatch = inner.match(/<failure([^>]*)>([\s\S]*?)<\/failure>/);
    if (failMatch) {
      const failAttrs = parseAttrs(failMatch[1]);
      failure = {
        message: failAttrs.message || '',
        body: escapeHtml(failMatch[2].trim()),
      };
    }
    cases.push({
      name: attrs.name || 'Unknown Test',
      classname: attrs.classname || '',
      time: parseFloat(attrs.time || '0'),
      failure,
    });
  }
  return cases;
}

function parseAttrs(str) {
  const attrs = {};
  const re = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Build HTML ---

const suites = parseTestSuites(xml);

const totalTests = suites.reduce((s, su) => s + su.tests, 0);
const totalFailures = suites.reduce((s, su) => s + su.failures + su.errors, 0);
const totalPassed = totalTests - totalFailures;
const totalTime = suites.reduce((s, su) => s + su.time, 0).toFixed(3);
const timestamp = new Date().toISOString();
const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';

function renderSuite(suite, index) {
  const failed = suite.failures + suite.errors;
  const passed = suite.tests - failed;
  const statusClass = failed > 0 ? 'suite-fail' : 'suite-pass';
  const icon = failed > 0 ? 'x-icon' : 'check-icon';

  const casesHtml = suite.testCases
    .map((tc) => {
      const isFail = !!tc.failure;
      const tcIcon = isFail ? '<span class="x-icon">&#x2717;</span>' : '<span class="check-icon">&#x2713;</span>';
      const failBlock = isFail
        ? `<div class="failure-detail">
            <div class="failure-msg">${escapeHtml(tc.failure.message)}</div>
            <pre class="failure-body">${tc.failure.body}</pre>
          </div>`
        : '';
      return `<div class="test-case ${isFail ? 'tc-fail' : 'tc-pass'}">
        <div class="tc-row">
          ${tcIcon}
          <span class="tc-name">${escapeHtml(tc.name)}</span>
          <span class="tc-time">${tc.time.toFixed(3)}s</span>
        </div>
        ${failBlock}
      </div>`;
    })
    .join('\n');

  return `<div class="suite ${statusClass}">
    <div class="suite-header" onclick="this.parentElement.classList.toggle('open')">
      <span class="${icon}">${failed > 0 ? '&#x2717;' : '&#x2713;'}</span>
      <span class="suite-name">${escapeHtml(suite.name)}</span>
      <span class="suite-stats">${passed}/${suite.tests} passed &middot; ${suite.time.toFixed(3)}s</span>
      <span class="chevron">&#x25B6;</span>
    </div>
    <div class="suite-body">
      ${casesHtml}
    </div>
  </div>`;
}

// Collect failed tests for prominent display
const failedTests = [];
for (const suite of suites) {
  for (const tc of suite.testCases) {
    if (tc.failure) {
      failedTests.push({ suite: suite.name, ...tc });
    }
  }
}

const failedSection =
  failedTests.length > 0
    ? `<div class="failed-summary">
        <h2>Failed Tests (${failedTests.length})</h2>
        ${failedTests
          .map(
            (t) => `<div class="failed-item">
            <span class="x-icon">&#x2717;</span>
            <strong>${escapeHtml(t.name)}</strong>
            <span class="failed-suite">in ${escapeHtml(t.suite)}</span>
            <div class="failure-detail">
              <div class="failure-msg">${escapeHtml(t.failure.message)}</div>
              <pre class="failure-body">${t.failure.body}</pre>
            </div>
          </div>`
          )
          .join('\n')}
      </div>`
    : '';

const barWidth = totalTests > 0 ? (totalPassed / totalTests) * 100 : 100;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Test Report — Schema Forge</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;
    background: #1a1b26; color: #c0caf5; line-height: 1.6; padding: 2rem;
  }
  .container { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 1.6rem; font-weight: 600; margin-bottom: 0.5rem; color: #e0e0e0; }
  .meta { font-size: 0.85rem; color: #787c99; margin-bottom: 1.5rem; }

  /* Header stats */
  .stats { display: flex; gap: 1.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
  .stat { background: #24283b; border-radius: 8px; padding: 1rem 1.5rem; flex: 1; min-width: 120px; text-align: center; }
  .stat-value { font-size: 1.8rem; font-weight: 700; }
  .stat-label { font-size: 0.75rem; text-transform: uppercase; color: #787c99; letter-spacing: 0.05em; }
  .stat-pass .stat-value { color: #9ece6a; }
  .stat-fail .stat-value { color: #f7768e; }
  .stat-total .stat-value { color: #7aa2f7; }
  .stat-time .stat-value { color: #bb9af7; }

  /* Progress bar */
  .bar-container { background: #f7768e; border-radius: 6px; height: 10px; margin-bottom: 2rem; overflow: hidden; }
  .bar-pass { background: #9ece6a; height: 100%; transition: width 0.3s; }

  /* Failed summary */
  .failed-summary { background: #2a1f2e; border: 1px solid #f7768e44; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; }
  .failed-summary h2 { color: #f7768e; font-size: 1.1rem; margin-bottom: 1rem; }
  .failed-item { margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #f7768e22; }
  .failed-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .failed-suite { color: #787c99; font-size: 0.85rem; margin-left: 0.5rem; }

  /* Suite */
  .suite { background: #24283b; border-radius: 8px; margin-bottom: 0.5rem; overflow: hidden; }
  .suite-header {
    display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem;
    cursor: pointer; user-select: none; transition: background 0.15s;
  }
  .suite-header:hover { background: #2a2e42; }
  .suite-name { flex: 1; font-weight: 500; }
  .suite-stats { font-size: 0.8rem; color: #787c99; }
  .chevron { font-size: 0.7rem; color: #787c99; transition: transform 0.2s; }
  .suite.open .chevron { transform: rotate(90deg); }
  .suite-body { display: none; padding: 0 1rem 0.75rem; }
  .suite.open .suite-body { display: block; }

  /* Test case */
  .test-case { padding: 0.4rem 0; border-bottom: 1px solid #1a1b26; }
  .test-case:last-child { border-bottom: none; }
  .tc-row { display: flex; align-items: center; gap: 0.5rem; }
  .tc-name { flex: 1; font-size: 0.9rem; }
  .tc-time { font-size: 0.8rem; color: #787c99; font-variant-numeric: tabular-nums; }

  /* Icons */
  .check-icon { color: #9ece6a; font-weight: 700; }
  .x-icon { color: #f7768e; font-weight: 700; }

  /* Failure detail */
  .failure-detail { margin: 0.5rem 0 0.5rem 1.5rem; }
  .failure-msg { color: #f7768e; font-size: 0.85rem; margin-bottom: 0.25rem; }
  .failure-body {
    background: #1a1b26; color: #a9b1d6; border-radius: 4px; padding: 0.75rem;
    font-size: 0.8rem; overflow-x: auto; white-space: pre-wrap; word-break: break-word;
  }

  /* Auto-expand failed suites */
  .suite-fail { border-left: 3px solid #f7768e; }
  .suite-pass { border-left: 3px solid #9ece6a; }
</style>
</head>
<body>
<div class="container">
  <h1>Test Report</h1>
  <div class="meta">Generated ${timestamp} &middot; Schema Forge</div>

  <div class="stats">
    <div class="stat stat-total"><div class="stat-value">${totalTests}</div><div class="stat-label">Total</div></div>
    <div class="stat stat-pass"><div class="stat-value">${totalPassed}</div><div class="stat-label">Passed</div></div>
    <div class="stat stat-fail"><div class="stat-value">${totalFailures}</div><div class="stat-label">Failed</div></div>
    <div class="stat stat-time"><div class="stat-value">${totalTime}s</div><div class="stat-label">Duration</div></div>
  </div>

  <div class="bar-container"><div class="bar-pass" style="width:${barWidth}%"></div></div>

  ${failedSection}

  <h2 style="font-size:1.1rem; margin-bottom:0.75rem;">Suites (${suites.length})</h2>
  ${suites.map(renderSuite).join('\n')}
</div>
<script>
  // Auto-expand failed suites
  document.querySelectorAll('.suite-fail').forEach(s => s.classList.add('open'));
</script>
</body>
</html>`;

writeFileSync(outputPath, html, 'utf8');

const status = totalFailures > 0 ? 'FAIL' : 'PASS';
console.log(`[test-report] ${status} — ${totalPassed}/${totalTests} passed (${passRate}%) in ${totalTime}s`);
console.log(`[test-report] HTML report: ${outputPath}`);
