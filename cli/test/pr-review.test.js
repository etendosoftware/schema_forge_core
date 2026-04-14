import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  detectDuplicatedBlocks,
  analyzeChangedFiles,
  summarizeReview,
  renderReviewBody,
} from '../src/pr-review.js';

function makeDiff(path, body) {
  return `diff --git a/${path} b/${path}
--- a/${path}
+++ b/${path}
@@ -0,0 +1,12 @@
${body}`;
}

describe('detectDuplicatedBlocks', () => {
  it('flags duplicated added blocks across files', () => {
    const block = [
      '+const normalized = input.trim();',
      '+const parsed = JSON.parse(normalized);',
      '+const customerId = parsed.customerId;',
      '+const orderId = parsed.orderId;',
      '+const total = Number(parsed.total);',
      '+return { customerId, orderId, total };',
    ].join('\n');

    const diff = [
      makeDiff('tools/a.js', block),
      makeDiff('tools/b.js', block),
    ].join('\n');

    const findings = detectDuplicatedBlocks(diff);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, 'DUPLICATED_BLOCK');
    assert.equal(findings[0].severity, 'blocker');
    assert.equal(findings[0].locations.length, 2);
    assert.deepEqual(findings[0].locations.map((location) => location.path), ['tools/a.js', 'tools/b.js']);
  });

  it('ignores short repeated snippets', () => {
    const shortBlock = [
      '+const id = row.id;',
      '+return id;',
    ].join('\n');

    const diff = [
      makeDiff('tools/a.js', shortBlock),
      makeDiff('tools/b.js', shortBlock),
    ].join('\n');

    assert.deepEqual(detectDuplicatedBlocks(diff), []);
  });
});

describe('analyzeChangedFiles', () => {
  it('classifies architecture blockers and warnings', () => {
    const findings = analyzeChangedFiles({
      changedFiles: [
        'src/new-feature.js',
        'src/legacy.js',
        'package.json',
        '.env.production',
        'rules-curated.json',
      ],
      newSourceFiles: ['src/new-feature.js'],
      newTestFiles: [],
      fileContents: {
        'src/legacy.js': 'const lib = require("lib");\nmodule.exports = lib;\n',
        '.env.production': 'SECRET_KEY=top-secret\n',
      },
      packageJsonChanges: [{
        path: 'package.json',
        dependencies: ['left-pad'],
      }],
    });

    assert.ok(findings.some((finding) => finding.code === 'MISSING_TESTS' && finding.severity === 'blocker'));
    assert.ok(findings.some((finding) => finding.code === 'COMMONJS_USAGE' && finding.severity === 'blocker'));
    assert.ok(findings.some((finding) => finding.code === 'ENV_FILE_COMMITTED' && finding.severity === 'blocker'));
    assert.ok(findings.some((finding) => finding.code === 'WRONG_DIRECTORY' && finding.severity === 'blocker'));
    assert.ok(findings.some((finding) => finding.code === 'NEW_DEPENDENCY' && finding.severity === 'warning'));
  });
});

describe('summarizeReview', () => {
  it('requests changes when blockers exist', () => {
    const summary = summarizeReview([
      { code: 'DUPLICATED_BLOCK', severity: 'blocker', title: 'Duplicate block', details: 'Repeated block found.' },
      { code: 'NEW_DEPENDENCY', severity: 'warning', title: 'New dependency', details: 'Dependency added.' },
    ]);

    assert.equal(summary.decision, 'request_changes');
    assert.equal(summary.blockers.length, 1);
    assert.equal(summary.warnings.length, 1);
  });

  it('renders a stable markdown body', () => {
    const body = renderReviewBody({
      decision: 'comment',
      blockers: [],
      warnings: [
        { code: 'NEW_DEPENDENCY', severity: 'warning', title: 'New dependency', details: 'Dependency added.' },
      ],
    });

    assert.match(body, /Copilot PR Review/);
    assert.match(body, /Warnings/);
    assert.match(body, /Dependency added\./);
  });
});
