import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createOnboardingDraftPersistence,
  restoreOnboardingDraft,
} from '../src/onboarding/draftPersistence.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const onboardingSrc = join(__dirname, '..', 'src', 'onboarding');

const defaultForm = {
  fullName: '',
  clientName: '',
  fiscalIdValue: '',
  address: '',
};

const steps = [
  { id: 'login' },
  { id: 'profile', persistable: true, draftStep: 1 },
  { id: 'company', persistable: true, draftStep: 2 },
];

describe('onboarding draft persistence', () => {
  it('wires the generic persistence policy into both setup steps and the central logout flow', () => {
    const flow = readFileSync(join(onboardingSrc, 'OnboardingFlow.jsx'), 'utf8');
    const stepDefinitions = readFileSync(join(onboardingSrc, 'steps', 'index.js'), 'utf8');

    assert.match(stepDefinitions, /id: 'profile', component: ProfileStep, persistable: true, draftStep: 1/);
    assert.match(stepDefinitions, /id: 'company', component: CompanyStep, persistable: true, draftStep: 2/);
    assert.match(flow, /draftPersistenceRef\.current\.schedule\(\{ steps, stepId: currentStep\?\.id, form: stepData \}\)/);
    assert.match(flow, /flushDraft: \(\) => draftPersistenceRef\.current\.flush\(draftContextRef\.current\)/);
  });

  it('does not write untouched defaults, but persists profile-only and company edits', async () => {
    const saves = [];
    const persistence = createOnboardingDraftPersistence({
      defaultForm,
      saveDraft: async (draft) => saves.push(draft),
    });

    await persistence.flush({ steps, stepId: 'profile', form: defaultForm });
    await persistence.flush({
      steps,
      stepId: 'profile',
      form: { ...defaultForm, fullName: 'Ada Lovelace' },
    });
    await persistence.flush({
      steps,
      stepId: 'company',
      form: { ...defaultForm, clientName: 'Analytical Engines Ltd.' },
    });

    assert.deepEqual(saves, [
      {
        step: 1,
        form: { ...defaultForm, fullName: 'Ada Lovelace' },
      },
      {
        step: 2,
        form: { ...defaultForm, clientName: 'Analytical Engines Ltd.' },
      },
    ]);
  });

  it('flushes the pending draft before a transition or immediate logout', async () => {
    const saves = [];
    const persistence = createOnboardingDraftPersistence({
      defaultForm,
      saveDraft: async (draft) => saves.push(draft),
    });
    const profile = {
      steps,
      stepId: 'profile',
      form: { ...defaultForm, fullName: 'Grace Hopper' },
    };

    persistence.schedule(profile, 60_000);
    await persistence.flush({ ...profile, stepId: 'company' });

    assert.deepEqual(saves, [{
      step: 2,
      form: { ...defaultForm, fullName: 'Grace Hopper' },
    }]);
  });

  it('waits for an in-flight save and then persists the newest snapshot', async () => {
    const saves = [];
    let releaseFirstSave;
    const firstSave = new Promise((resolve) => {
      releaseFirstSave = resolve;
    });
    const persistence = createOnboardingDraftPersistence({
      defaultForm,
      saveDraft: async (draft) => {
        saves.push(draft);
        if (saves.length === 1) await firstSave;
      },
    });
    const profile = {
      steps,
      stepId: 'profile',
      form: { ...defaultForm, fullName: 'Grace Hopper' },
    };
    const company = {
      steps,
      stepId: 'company',
      form: { ...profile.form, clientName: 'Compiler Co.' },
    };

    const firstFlush = persistence.flush(profile);
    const latestFlush = persistence.flush(company);
    await Promise.resolve();

    assert.deepEqual(saves, [{
      step: 1,
      form: profile.form,
    }]);

    releaseFirstSave();
    await Promise.all([firstFlush, latestFlush]);

    assert.deepEqual(saves, [
      { step: 1, form: profile.form },
      { step: 2, form: company.form },
    ]);
  });

  it('passes a failed logout-save warning through OnboardingFlow and renders it on LoginStep with a UI key', () => {
    const flow = readFileSync(join(onboardingSrc, 'OnboardingFlow.jsx'), 'utf8');
    const loginStep = readFileSync(join(onboardingSrc, 'steps', 'LoginStep.jsx'), 'utf8');

    assert.match(flow, /draftSaveWarning=\{draftSaveWarning\}/);
    assert.match(loginStep, /routeByEnvironments, draftSaveWarning \}/);
    assert.match(loginStep, /draftSaveWarning && \(/);
    assert.match(loginStep, /data-testid="draft-save-warning"/);
    assert.match(loginStep, /ui\('onboardingDraftSaveWarning'\)/);
  });

  it('restores persisted form values and their last persisted step', () => {
    assert.deepEqual(
      restoreOnboardingDraft({
        draft: {
          step: 2,
          form: { clientName: 'Compiler Co.', fiscalIdValue: 'AR-123' },
        },
        defaultForm,
        steps,
      }),
      {
        stepId: 'company',
        form: {
          ...defaultForm,
          clientName: 'Compiler Co.',
          fiscalIdValue: 'AR-123',
        },
      },
    );
  });

  for (const status of [401, 409, 429, 500]) {
    it(`reports a ${status} save failure without preventing a later logout`, async () => {
      const failures = [];
      const persistence = createOnboardingDraftPersistence({
        defaultForm,
        saveDraft: async () => {
          const error = new Error(`HTTP ${status}`);
          error.status = status;
          throw error;
        },
        onSaveFailure: (error) => failures.push(error.status),
      });

      const saved = await persistence.flush({
        steps,
        stepId: 'profile',
        form: { ...defaultForm, fullName: 'Margaret Hamilton' },
      });

      assert.equal(saved, false);
      assert.deepEqual(failures, [status]);
    });
  }
});
