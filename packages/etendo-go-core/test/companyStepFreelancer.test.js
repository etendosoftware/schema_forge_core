import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stepPath = join(__dirname, '..', 'src', 'onboarding', 'steps', 'CompanyStep.jsx');
const step = readFileSync(stepPath, 'utf8');

// ETP-4673 — Step 3 ("Details to start invoicing") must hide and stop requiring
// the "Company name" field for freelancers: their personal full name (captured
// in the profile step) is used as the invoicing name instead, pushed via
// onChange on mount so it reaches the backend payload unchanged.
describe('CompanyStep freelancer clientName handling (ETP-4673)', () => {
  it('derives isFreelancer from stepData.businessType', () => {
    assert.match(step, /const isFreelancer = stepData\.businessType === 'freelancer'/);
  });

  it('seeds form.clientName from stepData.fullName when freelancer, ignoring any stale stepData.clientName', () => {
    // Must NOT read stepData.clientName at all in the freelancer branch: a
    // prior Company/Advisory selection in the same session (Back + switch to
    // Freelancer) can leave a stale, non-empty stepData.clientName behind,
    // which must never leak into the freelancer's auto-filled value.
    assert.match(
      step,
      /clientName: isFreelancer \? \(stepData\.fullName \?\? ''\) : \(stepData\.clientName \?\? config\.defaultForm\?\.clientName \?\? ''\)/,
    );
  });

  it('pushes the auto-filled clientName upstream on mount for freelancers only', () => {
    assert.match(
      step,
      /useEffect\(\(\) => \{\s*if \(isFreelancer && onChange\) onChange\(\{ clientName: form\.clientName \}\);/,
    );
    // Mount-only effect (empty dependency array) — must not re-fire on every keystroke.
    assert.match(step, /\}, \[\]\);/);
  });

  it('hides the clientName SetupField entirely when freelancer', () => {
    assert.match(
      step,
      /\{!isFreelancer && \(\s*<SetupField\s*\n\s*id="clientName"/,
    );
  });

  it('keeps the clientName field required and rendered for non-freelancer business types', () => {
    // The conditional wraps the SetupField in a single guard shared by company
    // and advisory business types (anything where isFreelancer is false).
    const clientNameBlockMatch = step.match(/\{!isFreelancer && \(\s*<SetupField[\s\S]*?\/>\s*\)\}/);
    assert.ok(clientNameBlockMatch, 'expected a guarded SetupField block for clientName');
    const clientNameBlock = clientNameBlockMatch[0];
    assert.match(clientNameBlock, /id="clientName"/);
    assert.match(clientNameBlock, /required/);
    assert.match(clientNameBlock, /value=\{form\.clientName\}/);
  });

  it('falls back to an empty string when a freelancer has no fullName yet', () => {
    // stepData.fullName ?? null, chained through ?? '' — an empty/undefined
    // fullName must resolve to '' rather than throwing or leaving clientName undefined.
    assert.match(step, /\?\? config\.defaultForm\?\.clientName \?\? ''/);
  });

  it('does not touch isCompanyStepValid — required-ness for non-freelancers still comes from validation', () => {
    assert.match(step, /import \{ isCompanyStepValid \} from '\.\.\/state\.js'/);
    assert.match(step, /const isValid = isCompanyStepValid\(form\)/);
  });
});
