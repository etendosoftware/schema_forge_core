import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  detectDuplicatedBlocks,
  analyzeChangedFiles,
  summarizeReview,
  renderReviewBody,
  reviewPullRequest,
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

  it('ignores duplicated blocks in artifact files', () => {
    const block = [
      '+"key": "cancel",',
      '+"label": "Cancel",',
      '+"labelKey": "cancel",',
      '+"destructive": true,',
      '+"visibleWhenStatus": "CO",',
      '+"documentAction": "CL"',
    ].join('\n');

    const diff = [
      makeDiff('artifacts/sales-invoice/decisions.json', block),
      makeDiff('artifacts/sales-invoice/contract.json', block),
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

describe('reviewPullRequest', () => {
  it('uses the merge base so only files introduced by the PR head are blocked', () => {
    const originalCwd = process.cwd();
    const repoDir = mkdtempSync(join(tmpdir(), 'pr-review-'));

    try {
      execFileSync('git', ['init', '-b', 'develop'], { cwd: repoDir });
      execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });

      writeFileSync(join(repoDir, 'shared.txt'), 'base\n');
      execFileSync('git', ['add', 'shared.txt'], { cwd: repoDir });
      execFileSync('git', ['commit', '-m', 'base'], { cwd: repoDir });

      execFileSync('git', ['checkout', '-b', 'epic/ETP-3504'], { cwd: repoDir });
      writeFileSync(join(repoDir, 'base-only.txt'), 'changed on epic\n');
      execFileSync('git', ['add', 'base-only.txt'], { cwd: repoDir });
      execFileSync('git', ['commit', '-m', 'epic change'], { cwd: repoDir });

      execFileSync('git', ['checkout', '-b', 'feature/ETP-3775'], { cwd: repoDir });
      writeFileSync(join(repoDir, 'feature-only.txt'), 'changed on feature\n');
      execFileSync('git', ['add', 'feature-only.txt'], { cwd: repoDir });
      execFileSync('git', ['commit', '-m', 'feature change'], { cwd: repoDir });

      execFileSync('git', ['checkout', 'epic/ETP-3504'], { cwd: repoDir });
      writeFileSync(join(repoDir, 'epic-after-branch.txt'), 'changed on epic after feature branch\n');
      execFileSync('git', ['add', 'epic-after-branch.txt'], { cwd: repoDir });
      execFileSync('git', ['commit', '-m', 'later epic change'], { cwd: repoDir });

      execFileSync('git', ['checkout', 'feature/ETP-3775'], { cwd: repoDir });

      const baseSha = execFileSync('git', ['rev-parse', 'epic/ETP-3504'], { cwd: repoDir, encoding: 'utf8' }).trim();
      const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf8' }).trim();

      process.chdir(repoDir);
      const result = reviewPullRequest(baseSha, headSha);

      assert.deepEqual(result.changedFiles, ['feature-only.txt']);
    } finally {
      process.chdir(originalCwd);
      rmSync(repoDir, { recursive: true, force: true });
    }
  });
});

describe('analyzeChangedFiles string-literal safety', () => {
  it('does not block string literals that merely mention require or secret markers', () => {
    const findings = analyzeChangedFiles({
      changedFiles: ['cli/test/pr-review.test.js'],
      newSourceFiles: [],
      newTestFiles: ['cli/test/pr-review.test.js'],
      fileContents: {
        'cli/test/pr-review.test.js': "const fixture = 'module.exports = lib; SECRET_KEY=top-secret; const lib = require(\"lib\");';\n",
      },
      packageJsonChanges: [],
      addedLineContents: {
        'cli/test/pr-review.test.js': ["const fixture = 'module.exports = lib; SECRET_KEY=top-secret; const lib = require(\"lib\");';"],
      },
    });

    assert.ok(!findings.some((finding) => finding.code === 'COMMONJS_USAGE'));
    assert.ok(!findings.some((finding) => finding.code === 'POTENTIAL_SECRET'));
  });
});
