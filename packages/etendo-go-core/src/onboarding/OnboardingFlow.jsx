import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useUI } from '@etendosoftware/app-shell-core/i18n';
import { createLocalAuthStorage } from '@etendosoftware/app-shell-core/auth';
import { fetchAccount, fetchEnvironments, loginEnvironment, fetchOnboardingDraft, saveOnboardingDraft } from './api.js';
import { buildEnvironmentSessionStorage } from './state.js';
import { buildAppReturnToHref, getSafeReturnTo } from './oauthReturnTo.js';
import { trackOnboarding } from './tracking.js';
import { createOnboardingLogout } from './logout.js';
import { createOnboardingDraftPersistence, restoreOnboardingDraft as restorePersistedOnboardingDraft } from './draftPersistence.js';
import { SetupPreviewMockup } from './components/SetupPreviewMockup.jsx';

export function OnboardingFlow({ steps = [], config = {} }) {
  const ui = useUI();
  const [stepIndex, setStepIndex] = useState(-1); // -1 means verifying/loading initial state
  const [stepData, setStepData] = useState(() => config.defaultForm || {});
  const [token, setToken] = useState(() => localStorage.getItem('sf_platform_token'));
  const [accountName, setAccountName] = useState(null);
  const [draftNotice, setDraftNotice] = useState(false);
  const [draftSaveWarning, setDraftSaveWarning] = useState(false);
  const [environments, setEnvironments] = useState([]);
  const [loadingEnvs, setLoadingEnvs] = useState(false);

  const draftReadyRef = useRef(false);
  const authStorageRef = useRef(null);
  const logoutContextRef = useRef(null);
  const onLogoutRef = useRef(null);
  const draftPersistenceRef = useRef(null);
  const draftContextRef = useRef(null);
  const apiBase = config.apiBase || '';

  if (!authStorageRef.current) {
    authStorageRef.current = createLocalAuthStorage();
  }

  const currentStep = steps[stepIndex];

  draftContextRef.current = {
    apiBase,
    token,
    steps,
    stepId: currentStep?.id,
    form: stepData,
  };

  if (!draftPersistenceRef.current) {
    draftPersistenceRef.current = createOnboardingDraftPersistence({
      defaultForm: config.defaultForm || {},
      saveDraft: (draft) => {
        const context = draftContextRef.current;
        return saveOnboardingDraft(fetch, context.apiBase, context.token, draft);
      },
      onSaveFailure: (error) => {
        console.warn('Failed to save onboarding draft', error);
        setDraftSaveWarning(true);
        trackOnboarding(config, 'onboarding_draft_save_failed', {
          action: 'save_draft',
          status: 'failed',
          httpStatus: error?.status,
        });
      },
    });
  }

  // Helper to jump to a specific step by id
  const goToStep = useCallback((stepId) => {
    const idx = steps.findIndex(s => s.id === stepId);
    if (idx !== -1) {
      setStepIndex(idx);
    }
  }, [steps]);

  logoutContextRef.current = {
    resetState: () => {
      setToken(null);
      setAccountName(null);
      setEnvironments([]);
      setLoadingEnvs(false);
    },
    navigateToLogin: () => goToStep('login'),
    track: (eventDefinition, properties) => trackOnboarding(config, eventDefinition, properties),
  };

  if (!onLogoutRef.current) {
    onLogoutRef.current = createOnboardingLogout({
      flushDraft: () => draftPersistenceRef.current.flush(draftContextRef.current),
      cleanupSession: () => authStorageRef.current.clear(),
      resetState: () => logoutContextRef.current.resetState(),
      navigateToLogin: () => logoutContextRef.current.navigateToLogin(),
      track: (eventDefinition, properties) => logoutContextRef.current.track(eventDefinition, properties),
    });
  }

  const onLogout = onLogoutRef.current;

  // Restore draft and set appropriate step index
  const restoreOnboardingDraft = useCallback(async (authToken) => {
    try {
      const draft = await fetchOnboardingDraft(fetch, apiBase, authToken);
      const restored = restorePersistedOnboardingDraft({
        draft,
        defaultForm: config.defaultForm,
        steps,
      });
      if (restored) {
        setStepData(restored.form);
        setDraftNotice(true);
        setDraftSaveWarning(false);
        goToStep(restored.stepId);
        draftPersistenceRef.current.restoreLastSaved({ step: draft.step, form: restored.form });
      } else {
        goToStep('profile');
      }
    } catch (err) {
      console.warn('Failed to load onboarding draft', err);
      goToStep('profile');
    } finally {
      draftReadyRef.current = true;
    }
  }, [apiBase, goToStep, config.defaultForm, steps]);

  // Route by environments list: 0 -> profile (restore draft), 1+ -> loginEnvironment and redirect
  const routeByEnvironments = useCallback(async (authToken) => {
    setLoadingEnvs(true);
    try {
      const envs = await fetchEnvironments(fetch, apiBase, authToken);
      setEnvironments(envs);
      if (envs.length === 0) {
        await restoreOnboardingDraft(authToken);
      } else {
        // Auto-login to first environment
        try {
          const env = envs[0];
          trackOnboarding(config, 'onboarding_environment_enter_submitted', {
            action: 'enter_environment',
            status: 'started',
          });
          const data = await loginEnvironment(fetch, apiBase, authToken, env);
          if (data.token) {
            const storageValues = buildEnvironmentSessionStorage(env, data);
            Object.entries(storageValues).forEach(([key, value]) => localStorage.setItem(key, value));

            // Clear all SW caches on login to guarantee fresh resources
            if ('caches' in window) {
              try {
                const names = await caches.keys();
                await Promise.all(names.map((n) => caches.delete(n)));
              } catch (err) {
                console.warn('Failed to clear SW caches during login', err);
              }
            }

            trackOnboarding(config, 'onboarding_environment_enter_succeeded', {
              action: 'enter_environment',
              status: 'success',
            });

            // Tell useServiceWorker (schema-forge-ar) a full-page navigation is
            // about to happen, so a concurrent controllerchange doesn't call
            // location.reload() and race/cancel this redirect (ETP-4425/ETP-4426).
            window.dispatchEvent(new Event('etendo-go:navigating'));
            window.location.href = buildAppReturnToHref(
              getSafeReturnTo(window.location.search),
              window.location.pathname
            );
            return;
          } else {
            trackOnboarding(config, 'onboarding_environment_enter_failed', {
              action: 'enter_environment',
              status: 'failed',
            });
            alert(ui('onboardingEnvironmentLoginFailed'));
          }
        } catch (loginErr) {
          console.warn('Auto-login to environment failed', loginErr);
          trackOnboarding(config, 'onboarding_environment_enter_failed', {
            action: 'enter_environment',
            status: 'failed',
          });
          alert(loginErr.userMessage || ui(loginErr.code || 'onboardingEnvironmentLoginFailed'));
        }
        goToStep('env-select');
      }
    } catch (err) {
      console.error('Failed to load environments', err);
      goToStep('profile');
    } finally {
      setLoadingEnvs(false);
    }
  }, [apiBase, restoreOnboardingDraft, goToStep]);

  // Initial token verification on mount
  useEffect(() => {
    const resetToken = new URLSearchParams(window.location.search).get('resetToken');
    if (resetToken) {
      goToStep('login');
      return;
    }

    const initialView = localStorage.getItem('sf_onboarding_initial_view');
    if (initialView) {
      localStorage.removeItem('sf_onboarding_initial_view');
    }

    const currentToken = localStorage.getItem('sf_platform_token');
    if (!currentToken) {
      // Login is the default entry view; register is only shown when explicitly requested.
      goToStep(initialView === 'register' ? 'register' : 'login');
      return;
    }

    const promise = fetchAccount(fetch, apiBase, currentToken);
    if (promise && typeof promise.then === 'function') {
      promise
        .then(data => {
          setAccountName(data.name || data.email || null);
          routeByEnvironments(currentToken);
        })
        .catch(() => {
          authStorageRef.current.clear();
          setToken(null);
          goToStep('login');
        });
    } else {
      // If mocked fetchAccount doesn't return a promise, default to the login view
      goToStep('login');
    }
  }, []);

  // Every persistable step follows the same debounce policy; no field names
  // are special-cased, so future steps opt in through their definition.
  useEffect(() => {
    if (!token || !draftReadyRef.current) return undefined;
    draftPersistenceRef.current.schedule({ steps, stepId: currentStep?.id, form: stepData });
    return () => draftPersistenceRef.current.cancel();
  }, [stepData, currentStep, token, steps]);

  // Handle register success: setup new state, redirect to profile
  const handleRegisterSuccess = (authToken, account) => {
    setToken(authToken);
    setAccountName(account?.name || account?.email || null);
    setStepData({
      ...config.defaultForm,
      fullName: account?.name || account?.email || '',
    });
    setDraftNotice(false);
    draftPersistenceRef.current.restoreLastSaved(null);
    draftReadyRef.current = true;
    goToStep('profile');
  };

  const handleStepDataChange = useCallback((newData) => {
    setStepData(prev => ({ ...prev, ...newData }));
  }, []);

  const handleNext = async (data) => {
    const nextData = data ? { ...stepData, ...data } : stepData;
    const nextIndex = Math.min(stepIndex + 1, steps.length - 1);
    const saveStepId = steps[nextIndex]?.persistable ? steps[nextIndex].id : currentStep?.id;
    await draftPersistenceRef.current.flush({ steps, stepId: saveStepId, form: nextData });
    setStepData(nextData);
    setStepIndex(nextIndex);
  };

  const handleBack = async () => {
    await draftPersistenceRef.current.flush({ steps, stepId: currentStep?.id, form: stepData });
    setStepIndex(i => Math.max(i - 1, 0));
  };

  if (stepIndex === -1 || !currentStep) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2
          className="h-6 w-6 animate-spin text-gray-400"
          data-testid="Loader2__79cf84" />
      </div>
    );
  }

  const StepComponent = currentStep.component;

  const stepElement = (
    <StepComponent
      config={config}
      stepData={stepData}
      onNext={handleNext}
      onBack={handleBack}
      onChange={handleStepDataChange}
      goToStep={goToStep}
      token={token}
      setToken={setToken}
      accountName={accountName}
      setAccountName={setAccountName}
      draftNotice={draftNotice}
      setDraftNotice={setDraftNotice}
      draftSaveWarning={draftSaveWarning}
      environments={environments}
      loadingEnvs={loadingEnvs}
      routeByEnvironments={routeByEnvironments}
      handleRegisterSuccess={handleRegisterSuccess}
      onLogout={onLogout}
      data-testid="StepComponent__5852c2" />
  );

  // Setup steps (Profile / Company) share a persistent right-side preview.
  // Rendering the preview HERE (outside the swapped StepComponent) keeps a single
  // SetupPreviewMockup instance mounted across the profile→company change, so its
  // variant/orgName/userName props change on the SAME DOM node — which is what
  // makes the CSS scroll transition fire instead of a hard remount.
  const isSetupStep = currentStep.id === 'profile' || currentStep.id === 'company';
  if (isSetupStep) {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex min-h-screen w-full bg-white lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(420px,0.88fr)]">
          {stepElement}
          <aside className="relative hidden overflow-hidden bg-[#f4f6fa] lg:flex lg:flex-col">
            <SetupPreviewMockup
              variant={currentStep.id === 'company' ? 'company' : 'profile'}
              orgName={stepData.clientName}
              userName={stepData.fullName || accountName || ''}
              data-testid="SetupPreviewMockup__79cf84" />
          </aside>
        </div>
      </div>
    );
  }

  return stepElement;
}

export default OnboardingFlow;
