import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOnboardingStream } from '../src/onboarding/api.js';
import {
  applyProgressMessage,
  initialSetupSteps,
  isSampleDataOffered,
  mapBackendStepStatus,
} from '../src/onboarding/state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(__dirname, '..', 'src', 'onboarding', ...parts), 'utf8');
const companyStep = read('steps', 'CompanyStep.jsx');
const setupProgressStep = read('steps', 'SetupProgressStep.jsx');

function streamResponse(messages) {
  const payload = new TextEncoder().encode(`${messages.map(JSON.stringify).join('\n')}\n`);
  let done = false;
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => {
          if (done) return { done: true };
          done = true;
          return { done: false, value: payload };
        },
      }),
    },
  };
}

// ETP-5426 — the signup can optionally provision the tenant with GOClient's sample data.
describe('sample-data opt-in (ETP-5426)', () => {
  it('is offered only to Spanish tenants invoicing in euros', () => {
    const esEur = { defaultForm: { countryCode: 'ES', currency: 'EUR' } };
    assert.equal(isSampleDataOffered({}, esEur), true);
    assert.equal(isSampleDataOffered({ countryCode: 'es' }, { defaultForm: { currency: 'eur' } }), true);
    assert.equal(isSampleDataOffered({ countryCode: 'AR' }, esEur), false, 'the chosen country wins over the default');
    assert.equal(isSampleDataOffered({}, { defaultForm: { countryCode: 'ES', currency: 'USD' } }), false);
    assert.equal(isSampleDataOffered(undefined, undefined), false);
  });

  it('sends includeSampleData only when it is literally true', async () => {
    const bodies = [];
    const fetchImpl = async (url, options = {}) => {
      bodies.push(JSON.parse(options.body));
      return streamResponse([{ type: 'result', success: true }]);
    };
    const form = { clientName: 'Core', currency: 'EUR', language: 'es_ES', countryCode: 'ES' };

    await runOnboardingStream(fetchImpl, '', 'csrf', { ...form, includeSampleData: true }, () => {});
    await runOnboardingStream(fetchImpl, '', 'csrf', { ...form, includeSampleData: false }, () => {});
    await runOnboardingStream(fetchImpl, '', 'csrf', { ...form, includeSampleData: 'true' }, () => {});

    assert.equal(bodies[0].includeSampleData, true);
    assert.equal('includeSampleData' in bodies[1], false);
    assert.equal('includeSampleData' in bodies[2], false);
  });

  it('keeps a sample-data warning as a warning, never as a failed step', () => {
    assert.equal(mapBackendStepStatus('warning'), 'warning');
    const steps = applyProgressMessage(initialSetupSteps(), {
      type: 'progress', step: 'sampleData', status: 'warning', message: 'Sample data could not be loaded',
    });
    const sampleData = steps.find((step) => step.name === 'sampleData');
    assert.equal(sampleData.status, 'warning');
    assert.equal(sampleData.error, null, 'a warning carries no step error');
  });

  it('renders the checkbox unticked by default, and only when offered', () => {
    assert.match(companyStep, /const sampleDataOffered = isSampleDataOffered\(stepData, config\);/);
    assert.match(
      companyStep,
      /includeSampleData: sampleDataOffered\s*&& \(stepData\.includeSampleData \?\? config\.defaultForm\?\.includeSampleData\) === true,/,
    );
    assert.match(companyStep, /\{sampleDataOffered && \(\s*<div/);
    assert.match(companyStep, /id="includeSampleData"\s*\n\s*type="checkbox"/);
    assert.match(companyStep, /onChange=\{e => updateField\('includeSampleData', e\.target\.checked\)\}/);
  });

  it('labels the checkbox with a sibling label, never a wrapping one', () => {
    // A wrapping <label> re-dispatches the click to the input and toggles the value twice.
    assert.match(companyStep, /<label\s*\n\s*htmlFor="includeSampleData"/);
    assert.doesNotMatch(companyStep, /<label[^>]*>\s*<input\s*\n?\s*id="includeSampleData"/);
  });

  it('forwards the opt-in to provisioning and reports a failed load on the success card', () => {
    assert.match(setupProgressStep, /includeSampleData: stepData\.includeSampleData === true,/);
    assert.match(setupProgressStep, /msg\.step === SAMPLE_DATA_STEP && msg\.status === 'warning'/);
    assert.match(setupProgressStep, /description: sampleDataWarned\s*\? ui\('onboardingSampleDataWarning'\)/);
    assert.match(setupProgressStep, /retryLogin\(3, sampleDataWarnedRef\.current\s*\? SAMPLE_DATA_WARNING_LOGIN_DELAY_MS/);
  });
});
