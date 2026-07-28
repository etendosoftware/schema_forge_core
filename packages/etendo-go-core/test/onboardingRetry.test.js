import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const setupProgressSrc = readFileSync(
  join(__dirname, '..', 'src', 'onboarding', 'steps', 'SetupProgressStep.jsx'), 'utf8');

// es_AR is the single locale bundled in the repo (tools/etendo-go-ar/app-shell).
// The failed-branch UI resolves both labels through ui(): onboardingRetry (Retry)
// and back (Back). If either key is dropped from the dictionary, the buttons would
// render blank at runtime while the source-level tests above still pass — so we
// pin the keys down against the actual locale JSON.
const locale = JSON.parse(
  readFileSync(
    join(
      __dirname, '..', '..', '..',
      'tools', 'etendo-go-ar', 'app-shell', 'src', 'locales', 'es_AR.json',
    ),
    'utf8',
  ),
);

// ETP-4428: after a failed onboarding the user must get a Retry action (not just a dead-end Back),
// which re-runs the idempotent onboarding chain so a partial failure can be resumed to completion.
describe('Onboarding failure Retry action (ETP-4428)', () => {
  it('renders a Retry button with its own testid and the onboardingRetry label', () => {
    assert.match(setupProgressSrc, /data-testid="Button__retry"/);
    assert.match(setupProgressSrc, /ui\('onboardingRetry'\)/);
  });

  it('wires Retry to runOnboarding in the failed branch (re-runs the idempotent chain)', () => {
    // Isolate the *Retry* <Button> opening tag itself, so we assert the onClick belongs to
    // THIS button and not the sibling Back button rendered in the same row. Checking the
    // whole failed branch would still pass if the two handlers were swapped.
    const retryButtonTag = setupProgressSrc.match(
      /<Button\b[^>]*data-testid="Button__retry"[^>]*>/,
    );
    assert.ok(retryButtonTag, 'expected a <Button data-testid="Button__retry"> element');
    assert.match(retryButtonTag[0], /onClick=\{runOnboarding\}/);
    // Guard against a handler swap: Retry must NOT be wired to onBack.
    assert.doesNotMatch(retryButtonTag[0], /onClick=\{onBack\}/);
  });

  it('renders Retry only inside the failed render branch (not in success/running states)', () => {
    // Anchor on the JSX guard that gates the failure UI. The Retry button must appear
    // after this guard opens and exactly once, so it cannot leak into other states.
    const failedGuard = setupProgressSrc.indexOf("{result?.status === 'failed' && (");
    assert.notEqual(failedGuard, -1, 'expected a {result?.status === "failed" && (...)} guard');
    const retryOccurrences = setupProgressSrc.split('data-testid="Button__retry"').length - 1;
    assert.equal(retryOccurrences, 1, 'Retry testid must appear exactly once');
    assert.ok(
      setupProgressSrc.indexOf('data-testid="Button__retry"') > failedGuard,
      'Retry button must be rendered inside the failed branch',
    );
  });

  it('keeps the Back action available alongside Retry (not replaced by it)', () => {
    // Scope to the failed render branch so Back is asserted where Retry lives.
    const failedBranch = setupProgressSrc.slice(
      setupProgressSrc.lastIndexOf("result?.status === 'failed'"));
    assert.match(failedBranch, /onClick=\{onBack\}/);
    assert.match(failedBranch, /ui\('back'\)/);
  });

  it('defines the onboardingRetry and back labels in the es_AR locale (they must resolve)', () => {
    // W-2: the source uses ui('onboardingRetry') / ui('back'); guard against a future
    // deletion of these keys, which would leave the failed-branch buttons empty.
    const labels = locale.genericLabels || {};
    assert.equal(typeof labels.onboardingRetry, 'string');
    assert.ok(labels.onboardingRetry.trim().length > 0, 'onboardingRetry must be a non-empty label');
    assert.equal(typeof labels.back, 'string');
    assert.ok(labels.back.trim().length > 0, 'back must be a non-empty label');
  });
});
