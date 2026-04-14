import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  extractSummaryBullets,
  parseReviewReport,
  renderEpicRollupReport,
} from '../src/epic-rollup-report.js';

describe('extractSummaryBullets', () => {
  it('returns bullets from the PR summary section', () => {
    const body = `## Summary
- add deterministic review automation
- document the workflow

## Test Plan
- [x] make test
`;

    assert.deepEqual(extractSummaryBullets(body), [
      'add deterministic review automation',
      'document the workflow',
    ]);
  });

  it('falls back to an empty list when no summary section exists', () => {
    assert.deepEqual(extractSummaryBullets('No headings here'), []);
  });
});

describe('parseReviewReport', () => {
  it('extracts outcome, blockers, and warnings from the review comment body', () => {
    const body = `<!-- copilot-pr-review -->
## Copilot PR Review
Outcome: **Request changes**

### Blocking findings

- **Duplicated added block** (\`DUPLICATED_BLOCK\`)
The same normalized block appears twice.

- **Missing tests** (\`MISSING_TESTS\`)
Add coverage.

### Warnings

- **New npm dependency added** (\`NEW_DEPENDENCY\`)
Justify it.
`;

    const report = parseReviewReport(body);
    assert.equal(report.outcome, 'Request changes');
    assert.deepEqual(report.blockers, [
      'Duplicated added block',
      'Missing tests',
    ]);
    assert.deepEqual(report.warnings, [
      'New npm dependency added',
    ]);
  });

  it('returns an empty report when the marker is absent', () => {
    const report = parseReviewReport('plain comment');
    assert.equal(report.outcome, 'Not found');
    assert.deepEqual(report.blockers, []);
    assert.deepEqual(report.warnings, []);
  });
});

describe('renderEpicRollupReport', () => {
  it('renders included PR summaries and review findings', () => {
    const markdown = renderEpicRollupReport({
      epicPullRequest: {
        number: 400,
        title: 'Promote epic to develop',
        url: 'https://github.com/acme/repo/pull/400',
        baseRefName: 'develop',
        headRefName: 'epic/ETP-3504',
      },
      includedPullRequests: [
        {
          number: 321,
          title: 'Add Copilot PR review gate',
          url: 'https://github.com/acme/repo/pull/321',
          author: 'sebastianbarrozo',
          mergedAt: '2026-04-14T20:18:29Z',
          summaryBullets: [
            'add deterministic PR review automation',
            'document the Copilot review gate',
          ],
          reviewReport: {
            outcome: 'Request changes',
            blockers: ['Duplicated added block'],
            warnings: ['New npm dependency added'],
          },
        },
        {
          number: 322,
          title: 'Clean follow-up',
          url: 'https://github.com/acme/repo/pull/322',
          author: 'another-user',
          mergedAt: '2026-04-15T10:00:00Z',
          summaryBullets: [],
          reviewReport: {
            outcome: 'Clean',
            blockers: [],
            warnings: [],
          },
        },
      ],
    });

    assert.match(markdown, /Epic rollout report/);
    assert.match(markdown, /Included PRs \(2\)/);
    assert.match(markdown, /Add Copilot PR review gate/);
    assert.match(markdown, /Duplicated added block/);
    assert.match(markdown, /New npm dependency added/);
    assert.match(markdown, /Clean follow-up/);
  });
});
