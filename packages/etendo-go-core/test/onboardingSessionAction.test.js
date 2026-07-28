import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const onboardingSrc = join(__dirname, '..', 'src', 'onboarding');
const read = (...path) => readFileSync(join(onboardingSrc, ...path), 'utf8');

describe('authenticated onboarding session action (ETP-4584)', () => {
  it('uses one accessible shared button instead of step-specific logout controls', () => {
    const action = read('components', 'OnboardingSessionAction.jsx');

    assert.match(action, /export function OnboardingSessionAction\(\{ onLogout, label \}\)/);
    assert.match(action, /type="button"/);
    assert.match(action, /onClick=\{onLogout\}/);
    assert.match(action, /data-testid="onboarding-logout"/);
    assert.match(action, /\{label\}/);
  });

  it('renders the shared action in Profile and Company from SetupShell headerContent when a token exists', () => {
    for (const step of ['ProfileStep.jsx', 'CompanyStep.jsx']) {
      const source = read('steps', step);

      assert.match(source, /token, onLogout/);
      assert.match(source, /const sessionAction = token && \(/);
      assert.match(source, /<OnboardingSessionAction onLogout=\{onLogout\} label=\{ui\('logout'\)\} \/>/);
      assert.match(source, /headerContent=\{sessionAction\}/);
    }
  });

  it('keeps environment selection visible without account data and only requires a platform token', () => {
    const pageHeader = read('components', 'PageHeader.jsx');
    const envSelect = read('steps', 'EnvSelectStep.jsx');

    assert.match(pageHeader, /isAuthenticated && \(/);
    assert.doesNotMatch(pageHeader, /isAuthenticated && accountName/);
    assert.match(envSelect, /isAuthenticated=\{Boolean\(token\)\}/);
  });

  it('offers logout during provisioning and prevents a detached stream from starting a new environment session', () => {
    const progress = read('steps', 'SetupProgressStep.jsx');
    const shell = read('components', 'SetupProgressShell.jsx');

    assert.match(progress, /token, routeByEnvironments, onLogout/);
    assert.match(progress, /const handleLogout = \(\) => \{/);
    assert.match(progress, /isMountedRef\.current = false;/);
    assert.match(progress, /return onLogout\(\);/);
    assert.match(progress, /<OnboardingSessionAction onLogout=\{handleLogout\} label=\{ui\('logout'\)\} \/>/);
    assert.match(progress, /if \(!isMountedRef\.current\) return;/);
    assert.match(progress, /if \(succeeded && isMountedRef\.current\)/);
    assert.match(shell, /headerContent/);
    assert.match(shell, /pointer-events-none absolute inset-x-0 top-0/);
    assert.match(shell, /pointer-events-auto/);
  });
});
