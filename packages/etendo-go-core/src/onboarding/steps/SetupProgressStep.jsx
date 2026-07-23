import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Check, Sparkles, Building2, Settings } from 'lucide-react';
import { useUI } from '@etendosoftware/app-shell-core/i18n';
import { runOnboardingStream, fetchEnvironments, loginEnvironment } from '../api.js';
import { initialSetupSteps, applyProgressMessage, buildEnvironmentSessionStorage } from '../state.js';
import { buildAppReturnToHref, getSafeReturnTo } from '../oauthReturnTo.js';
import { trackOnboarding } from '../tracking.js';
import { SetupProgressShell } from '../components/SetupProgressShell.jsx';
import { SetupProgressCard } from '../components/SetupProgressCard.jsx';
import { OnboardingSessionAction } from '../components/OnboardingSessionAction.jsx';
import { Button } from '@etendosoftware/app-shell-core/components/ui/button';

// Status phrases rotated in the loading screen so a long step never reads as
// frozen (ETP-4446, requested by UX). Only "in-progress" phrases — the
// "finishing" one is left out so it never claims near-completion early.
const ONBOARDING_ROTATING_KEYS = [
  'onboardingPreparingActivatingDescription',
  'onboardingPreparingConfiguringDescription',
  'onboardingPreparingDataDescription',
  'onboardingPreparingSequencesDescription',
];
const ROTATION_INTERVAL_MS = 7500;
// Trickle tuning: how far past the last real milestone the bar may creep, the
// global ceiling it never crosses until real success, and the easing per tick.
// Tuned for the server's slowest step (~100s at 65%): the ease keeps the bar
// visibly moving across the whole window instead of parking early, and the
// lookahead keeps its soft cap just under the next real milestone.
const TRICKLE_LOOKAHEAD = 15;
const TRICKLE_MAX = 95;
const TRICKLE_EASE = 0.005;
const TRICKLE_INTERVAL_MS = 200;

export function SetupProgressStep({ config, stepData, onNext, onBack, goToStep, token, routeByEnvironments, onLogout }) {
  const ui = useUI();
  const [steps, setSteps] = useState(() => initialSetupSteps());
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [displayedProgress, setDisplayedProgress] = useState(0);
  const [rotatingIndex, setRotatingIndex] = useState(0);
  const maxSetupProgressRef = useRef(0);
  const targetProgressRef = useRef(0);
  const terminalRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const hasStartedRef = useRef(false);
  const isMountedRef = useRef(true);

  const apiBase = config.apiBase || '';

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleLogout = () => {
    // Provisioning is server-side and cannot be safely cancelled from this
    // screen. Mark it inactive before the asynchronous draft flush/cleanup so
    // a completed stream cannot create a new environment session after logout.
    isMountedRef.current = false;
    return onLogout();
  };

  const loginToEnvironment = useCallback(async (env, { requireReadiness = false } = {}) => {
    if (!isMountedRef.current) return;
    trackOnboarding(config, 'onboarding_environment_enter_submitted', {
      action: 'enter_environment',
      status: 'started',
    });
    try {
      const data = await loginEnvironment(fetch, apiBase, token, env);
      if (!isMountedRef.current) return;
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

        if (requireReadiness && config.checkReadiness) {
          const readiness = await config.checkReadiness(fetch, apiBase, data.token);
          if (!isMountedRef.current) return;
          if (!readiness.ready) {
            trackOnboarding(config, 'onboarding_environment_enter_failed', {
              action: 'enter_environment',
              status: 'failed',
            });
            setResult({
              status: 'failed',
              readinessFailures: readiness.failures,
              error: null,
            });
            return;
          }
        }
        trackOnboarding(config, 'onboarding_environment_enter_succeeded', {
          action: 'enter_environment',
          status: 'success',
        });
        window.location.href = buildAppReturnToHref(
          getSafeReturnTo(window.location.search),
          window.location.pathname
        );
        return;
      }
      trackOnboarding(config, 'onboarding_environment_enter_failed', {
        action: 'enter_environment',
        status: 'failed',
      });
      setResult({ status: 'failed', error: ui('onboardingEnvironmentLoginFailed') });
    } catch (err) {
      if (!isMountedRef.current) return;
      trackOnboarding(config, 'onboarding_environment_enter_failed', {
        action: 'enter_environment',
        status: 'failed',
      });
      setResult({ status: 'failed', error: err.userMessage || ui(err.code || 'onboardingEnvironmentLoginFailed') });
    }
  }, [apiBase, config, token, ui]);

  const runOnboarding = useCallback(async () => {
    trackOnboarding(config, 'onboarding_run_started', {
      action: 'create_environment',
      status: 'started',
    });
    setRunning(true);
    setResult(null);
    setSteps(initialSetupSteps());
    maxSetupProgressRef.current = 0;

    const formPayload = {
      clientName: stepData.clientName,
      fullName: stepData.fullName,
      address: stepData.address,
      countryCode: stepData.countryCode || config.defaultForm?.countryCode || '',
      language: stepData.language || config.defaultForm?.language || '',
      currency: config.defaultForm?.currency || '',
    };

    let succeeded = false;
    try {
      await runOnboardingStream(fetch, apiBase, token, formPayload, (msg) => {
        if (!isMountedRef.current) return;
        if (msg.type === 'result') {
          const resultObj = {
            status: msg.success ? 'success' : 'failed',
            error: msg.success ? null : msg.message,
          };
          setResult(resultObj);
          if (msg.success) {
            trackOnboarding(config, 'onboarding_run_succeeded', {
              action: 'create_environment',
              status: 'success',
            });
            succeeded = true;
          } else {
            trackOnboarding(config, 'onboarding_run_failed', {
              action: 'create_environment',
              status: 'failed',
            });
          }
        } else if (msg.type === 'progress' && msg.step) {
          setSteps(prev => applyProgressMessage(prev, msg));
        }
      });
    } catch (err) {
      if (!isMountedRef.current) return;
      trackOnboarding(config, 'onboarding_run_failed', {
        action: 'create_environment',
        status: 'failed',
      });
      setResult({ status: 'failed', error: err.userMessage || ui(err.code || 'onboardingGenericError') });
    } finally {
      if (!isMountedRef.current) return;
      setRunning(false);
      if (succeeded && isMountedRef.current) {
        // Fetch environments and auto-login to the newly created one
        const retryLogin = async (attempts = 3, delay = 2000) => {
          for (let i = 0; i < attempts; i++) {
            if (!isMountedRef.current) return;
            await new Promise(r => setTimeout(r, delay));
            if (!isMountedRef.current) return;
            try {
              const envs = await fetchEnvironments(fetch, apiBase, token);
              if (envs.length > 0) {
                loginToEnvironment(envs[0], { requireReadiness: true });
                return;
              }
            } catch (err) {
              // retry
            }
          }
          if (!isMountedRef.current) return;
          if (routeByEnvironments) {
            await routeByEnvironments(token);
          } else if (goToStep) {
            goToStep('env-select');
          }
        };
        retryLogin();
      }
    }
  }, [apiBase, config, stepData, token, ui, loginToEnvironment, goToStep, routeByEnvironments]);

  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      runOnboarding();
    }
  }, [runOnboarding]);

  // Rotate the status line through the "working" phrases (ETP-4446).
  useEffect(() => {
    const id = setInterval(() => {
      setRotatingIndex((i) => (i + 1) % ONBOARDING_ROTATING_KEYS.length);
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Honor prefers-reduced-motion: under it we skip the JS creep and only reflect
  // real milestones (ETP-4446). Kept in a ref so the trickle interval reads the
  // latest value without being re-created.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => { reducedMotionRef.current = mq.matches; };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Trickle the bar forward between backend events so it never looks stuck
  // (ETP-4446). Eases asymptotically toward a soft cap a little beyond the last
  // real milestone, snapping up when a real event raises it, never crossing
  // TRICKLE_MAX until the real success snaps it to 100 (effect below). Freezes
  // on a terminal result so the bar never keeps climbing after success/failure,
  // and only reflects real milestones under reduced motion.
  useEffect(() => {
    const id = setInterval(() => {
      setDisplayedProgress((prev) => {
        if (terminalRef.current) return prev;
        const base = Math.max(prev, targetProgressRef.current);
        if (reducedMotionRef.current) return base;
        const softCap = Math.min(targetProgressRef.current + TRICKLE_LOOKAHEAD, TRICKLE_MAX);
        if (base >= softCap) return base;
        return base + (softCap - base) * TRICKLE_EASE;
      });
    }, TRICKLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (result?.status === 'success') setDisplayedProgress(100);
  }, [result]);

  const activeSetupStep = steps.find((step) => step.status === 'running')?.name;
  const readinessFailures = result?.readinessFailures || [];
  const readinessFailureText = readinessFailures.map((failure) => ui(failure.key)).join(' ');

  let setupProgressState;
  if (result?.status === 'success') {
    setupProgressState = {
      progress: 100,
      title: ui('onboardingSuccessTitle'),
      description: ui('onboardingSuccessDescription'),
      leading: <Check
        className="h-8 w-8 text-[#54b56a]"
        strokeWidth={3}
        data-testid="Check__79cf84" />,
      statusLabel: ui('onboardingCompleted'),
      success: true,
    };
  } else if (result?.status === 'failed') {
    const errorMsg = result.error || (readinessFailures.length > 0 ? ui('onboardingReadinessFailed', { reasons: readinessFailureText }) : ui('onboardingGenericError'));
    setupProgressState = {
      progress: maxSetupProgressRef.current,
      title: ui('onboardingGenericError'),
      description: errorMsg === ui('onboardingGenericError') ? '' : errorMsg,
      leading: <span className="text-2xl">⚠️</span>,
      statusLabel: ui('failed'),
      success: false,
    };
  } else if (activeSetupStep === 'client') {
    setupProgressState = {
      progress: 35,
      title: ui('onboardingPreparingTitle'),
      description: ui('onboardingPreparingActivatingDescription'),
      leading: <Sparkles className="h-8 w-8 text-slate-400" data-testid="Sparkles__79cf84" />,
      statusLabel: ui('loading'),
      success: false,
    };
  } else if (activeSetupStep === 'organization') {
    setupProgressState = {
      progress: 50,
      title: ui('onboardingPreparingTitle'),
      description: ui('onboardingPreparingConfiguringDescription'),
      leading: <Building2 className="h-8 w-8 text-slate-400" data-testid="Building2__79cf84" />,
      statusLabel: ui('loading'),
      success: false,
    };
  } else if (activeSetupStep === 'dataset') {
    setupProgressState = {
      progress: 65,
      title: ui('onboardingPreparingTitle'),
      description: ui('onboardingPreparingDataDescription'),
      leading: <Building2 className="h-8 w-8 text-slate-400" data-testid="Building2__79cf84" />,
      statusLabel: ui('loading'),
      success: false,
    };
  } else if (activeSetupStep === 'sequences') {
    setupProgressState = {
      progress: 85,
      title: ui('onboardingPreparingTitle'),
      description: ui('onboardingPreparingSequencesDescription'),
      leading: <Settings className="h-8 w-8 text-slate-400" data-testid="Settings__79cf84" />,
      statusLabel: ui('loading'),
      success: false,
    };
  } else if (activeSetupStep === 'finalize') {
    setupProgressState = {
      progress: 92,
      title: ui('onboardingPreparingTitle'),
      description: ui('onboardingPreparingFinishingDescription'),
      leading: <Check
        className="h-8 w-8 text-slate-400"
        strokeWidth={3}
        data-testid="Check__79cf84" />,
      statusLabel: ui('loading'),
      success: false,
    };
  } else if (running) {
    setupProgressState = {
      progress: 15,
      title: ui('onboardingPreparingTitle'),
      description: ui('onboardingPreparingConfiguringDescription'),
      leading: <Settings className="h-8 w-8 text-slate-400" data-testid="Settings__79cf84" />,
      statusLabel: ui('loading'),
      success: false,
    };
  } else {
    setupProgressState = {
      progress: 20,
      title: ui('onboardingPreparingTitle'),
      description: ui('onboardingPreparingTaxesDescription'),
      leading: config.countryFlag || '🌍',
      statusLabel: ui('loading'),
      success: false,
    };
  }

  // Keep progress bar monotonic
  if (!setupProgressState.success && result?.status !== 'failed') {
    setupProgressState.progress = Math.max(setupProgressState.progress, maxSetupProgressRef.current);
    maxSetupProgressRef.current = setupProgressState.progress;
  }

  // The step logic above yields the real milestone %; feed it to the trickle
  // engine and show the animated value instead, so the bar creeps forward
  // between backend events (ETP-4446).
  targetProgressRef.current = setupProgressState.progress;
  terminalRef.current = result?.status === 'success' || result?.status === 'failed';
  if (result?.status === 'success') {
    setupProgressState.progress = 100;
  } else {
    // Running OR failed: show the animated value, never below the real
    // milestone. On failure the trickle is already frozen (terminalRef), so the
    // bar holds at what the user saw instead of snapping back to the last
    // milestone — keeps the bar monotonic even in the error path.
    setupProgressState.progress = Math.max(Math.round(displayedProgress), setupProgressState.progress);
  }

  // While actively running, rotate the status line so a long step never reads
  // as frozen — independent of which real step is active (ETP-4446).
  if (running && result?.status !== 'success' && result?.status !== 'failed') {
    setupProgressState.description = ui(ONBOARDING_ROTATING_KEYS[rotatingIndex]);
  }

  return (
    <SetupProgressShell
      background={config.background}
      headerContent={token && <OnboardingSessionAction onLogout={handleLogout} label={ui('logout')} />}
      data-testid="SetupProgressShell__79cf84">
      <div className="w-full flex flex-col items-center gap-6">
        <SetupProgressCard data-testid="SetupProgressCard__79cf84" {...setupProgressState} />
        {result?.status === 'failed' && (
          <div className="flex gap-3">
            {/* Retry re-runs the idempotent onboarding chain (ETP-4428): runOnboarding already
                resets result/steps/progress, and the backend reconciles — repairing whatever a
                partial run left missing and no-op'ing what already exists. */}
            <Button
              onClick={runOnboarding}
              disabled={running}
              className="bg-[#121217] text-white rounded-lg h-12 px-6 hover:bg-accent-highlight hover:text-accent-highlight-foreground"
              data-testid="Button__retry">
              {ui('onboardingRetry')}
            </Button>
            <Button
              onClick={onBack}
              className="bg-transparent text-[#121217] border border-[#121217] rounded-lg h-12 px-6 hover:bg-accent-highlight hover:text-accent-highlight-foreground"
              data-testid="Button__c76d30">
              {ui('back')}
            </Button>
          </div>
        )}
      </div>
    </SetupProgressShell>
  );
}

export default SetupProgressStep;
