import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  parseTestSuites,
  parseTestCases,
  parseAttrs,
  escapeHtml,
  renderSuite,
  generateReport,
} from '../src/test-report-html.js';

// ---------- parseAttrs ----------

describe('parseAttrs', () => {
  it('parses key="value" pairs', () => {
    const result = parseAttrs('name="MySuite" tests="5"');
    assert.deepStrictEqual(result, { name: 'MySuite', tests: '5' });
  });

  it('returns empty object for empty string', () => {
    assert.deepStrictEqual(parseAttrs(''), {});
  });

  it('handles single attribute', () => {
    assert.deepStrictEqual(parseAttrs('time="1.234"'), { time: '1.234' });
  });
});

// ---------- escapeHtml ----------

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    assert.equal(escapeHtml('a & b'), 'a &amp; b');
  });

  it('escapes angle brackets', () => {
    assert.equal(escapeHtml('<div>'), '&lt;div&gt;');
  });

  it('escapes double quotes', () => {
    assert.equal(escapeHtml('"hello"'), '&quot;hello&quot;');
  });

  it('handles string with no special characters', () => {
    assert.equal(escapeHtml('plain text'), 'plain text');
  });

  it('handles empty string', () => {
    assert.equal(escapeHtml(''), '');
  });

  it('escapes all special chars together', () => {
    assert.equal(
      escapeHtml('<a href="x">&'),
      '&lt;a href=&quot;x&quot;&gt;&amp;'
    );
  });
});

// ---------- parseTestCases ----------

describe('parseTestCases', () => {
  it('parses self-closing test cases', () => {
    const xml = '<testcase name="test1" classname="Suite" time="0.01" />';
    const cases = parseTestCases(xml);
    assert.equal(cases.length, 1);
    assert.equal(cases[0].name, 'test1');
    assert.equal(cases[0].classname, 'Suite');
    assert.equal(cases[0].time, 0.01);
    assert.equal(cases[0].failure, null);
  });

  it('parses test case with failure', () => {
    const xml = `<testcase name="failTest" classname="S" time="0.5">
      <failure message="expected true">AssertionError: false != true</failure>
    </testcase>`;
    const cases = parseTestCases(xml);
    assert.equal(cases.length, 1);
    assert.ok(cases[0].failure);
    assert.equal(cases[0].failure.message, 'expected true');
    assert.ok(cases[0].failure.body.includes('AssertionError'));
  });

  it('returns empty array for no test cases', () => {
    assert.deepStrictEqual(parseTestCases(''), []);
  });

  it('parses multiple test cases', () => {
    const xml = `
      <testcase name="a" classname="S" time="0.1" />
      <testcase name="b" classname="S" time="0.2" />
      <testcase name="c" classname="S" time="0.3" />`;
    const cases = parseTestCases(xml);
    assert.equal(cases.length, 3);
    assert.equal(cases[0].name, 'a');
    assert.equal(cases[2].name, 'c');
  });
});

// ---------- parseTestSuites ----------

describe('parseTestSuites', () => {
  it('parses a single test suite', () => {
    const xml = `<testsuite name="Unit" tests="2" failures="0" errors="0" time="1.0">
      <testcase name="t1" classname="C" time="0.5" />
      <testcase name="t2" classname="C" time="0.5" />
    </testsuite>`;
    const suites = parseTestSuites(xml);
    assert.equal(suites.length, 1);
    assert.equal(suites[0].name, 'Unit');
    assert.equal(suites[0].tests, 2);
    assert.equal(suites[0].failures, 0);
    assert.equal(suites[0].testCases.length, 2);
  });

  it('parses multiple test suites', () => {
    const xml = `
      <testsuite name="A" tests="1" failures="0" errors="0" time="0.1">
        <testcase name="a1" classname="A" time="0.1" />
      </testsuite>
      <testsuite name="B" tests="1" failures="1" errors="0" time="0.2">
        <testcase name="b1" classname="B" time="0.2">
          <failure message="oops">stack trace</failure>
        </testcase>
      </testsuite>`;
    const suites = parseTestSuites(xml);
    assert.equal(suites.length, 2);
    assert.equal(suites[0].name, 'A');
    assert.equal(suites[1].failures, 1);
  });

  it('falls back to top-level test cases when no testsuite tags', () => {
    const xml = `<testsuites>
      <testcase name="solo" classname="X" time="0.1" />
    </testsuites>`;
    const suites = parseTestSuites(xml);
    assert.equal(suites.length, 1);
    assert.equal(suites[0].name, 'Test Suite');
    assert.equal(suites[0].testCases.length, 1);
  });

  it('returns empty array for empty XML', () => {
    assert.deepStrictEqual(parseTestSuites(''), []);
  });

  it('returns empty array for XML with no test elements', () => {
    assert.deepStrictEqual(parseTestSuites('<root>nothing</root>'), []);
  });
});

// ---------- renderSuite ----------

describe('renderSuite', () => {
  it('renders passing suite with suite-pass class', () => {
    const suite = {
      name: 'Passing',
      tests: 2,
      failures: 0,
      errors: 0,
      time: 0.5,
      testCases: [
        { name: 'p1', classname: 'C', time: 0.25, failure: null },
        { name: 'p2', classname: 'C', time: 0.25, failure: null },
      ],
    };
    const html = renderSuite(suite, 0);
    assert.ok(html.includes('suite-pass'));
    assert.ok(html.includes('Passing'));
    assert.ok(html.includes('2/2 passed'));
  });

  it('renders failing suite with suite-fail class', () => {
    const suite = {
      name: 'Failing',
      tests: 1,
      failures: 1,
      errors: 0,
      time: 0.1,
      testCases: [
        {
          name: 'f1',
          classname: 'C',
          time: 0.1,
          failure: { message: 'bad', body: 'stack' },
        },
      ],
    };
    const html = renderSuite(suite, 0);
    assert.ok(html.includes('suite-fail'));
    assert.ok(html.includes('failure-detail'));
  });

  it('escapes HTML in suite name', () => {
    const suite = {
      name: '<script>alert("xss")</script>',
      tests: 0,
      failures: 0,
      errors: 0,
      time: 0,
      testCases: [],
    };
    const html = renderSuite(suite, 0);
    assert.ok(!html.includes('<script>alert'));
    assert.ok(html.includes('&lt;script&gt;'));
  });
});

// ---------- generateReport ----------

describe('generateReport', () => {
  const allPassingXml = `<testsuite name="Unit" tests="3" failures="0" errors="0" time="1.5">
    <testcase name="test1" classname="C" time="0.5" />
    <testcase name="test2" classname="C" time="0.5" />
    <testcase name="test3" classname="C" time="0.5" />
  </testsuite>`;

  const mixedXml = `<testsuite name="Mix" tests="2" failures="1" errors="0" time="0.8">
    <testcase name="pass1" classname="C" time="0.3" />
    <testcase name="fail1" classname="C" time="0.5">
      <failure message="not equal">Expected 1, got 2</failure>
    </testcase>
  </testsuite>`;

  it('generates valid HTML structure', () => {
    const { html } = generateReport(allPassingXml);
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('<html'));
    assert.ok(html.includes('<head>'));
    assert.ok(html.includes('<body>'));
    assert.ok(html.includes('</html>'));
  });

  it('reports correct totals for all passing', () => {
    const result = generateReport(allPassingXml);
    assert.equal(result.totalTests, 3);
    assert.equal(result.totalFailures, 0);
    assert.equal(result.totalPassed, 3);
    assert.equal(result.passRate, '100.0');
  });

  it('reports correct totals for mixed results', () => {
    const result = generateReport(mixedXml);
    assert.equal(result.totalTests, 2);
    assert.equal(result.totalFailures, 1);
    assert.equal(result.totalPassed, 1);
    assert.equal(result.passRate, '50.0');
  });

  it('includes failed-summary section when there are failures', () => {
    const { html } = generateReport(mixedXml);
    assert.ok(html.includes('failed-summary'));
    assert.ok(html.includes('Failed Tests'));
  });

  it('does not include failed-summary div when all pass', () => {
    const { html } = generateReport(allPassingXml);
    // The CSS class name appears in the style block, but the actual
    // <div class="failed-summary"> section should not be present.
    assert.ok(!html.includes('<div class="failed-summary">'));
  });

  it('handles empty XML gracefully', () => {
    const result = generateReport('');
    assert.equal(result.totalTests, 0);
    assert.equal(result.totalFailures, 0);
    assert.equal(result.suites.length, 0);
    assert.ok(result.html.includes('<!DOCTYPE html>'));
  });

  it('handles all-failing suite', () => {
    const xml = `<testsuite name="Bad" tests="2" failures="2" errors="0" time="0.2">
      <testcase name="f1" classname="C" time="0.1">
        <failure message="err1">trace1</failure>
      </testcase>
      <testcase name="f2" classname="C" time="0.1">
        <failure message="err2">trace2</failure>
      </testcase>
    </testsuite>`;
    const result = generateReport(xml);
    assert.equal(result.totalPassed, 0);
    assert.equal(result.totalFailures, 2);
    assert.equal(result.passRate, '0.0');
  });

  it('includes title in HTML', () => {
    const { html } = generateReport(allPassingXml);
    assert.ok(html.includes('<title>Test Report'));
  });

  it('includes suite count in HTML', () => {
    const { html } = generateReport(allPassingXml);
    assert.ok(html.includes('Suites (1)'));
  });
});
