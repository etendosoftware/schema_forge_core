import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useUI } from '@etendosoftware/app-shell-core/i18n';
import {
  SESSION_RECHECK_INTERVAL_MS, announceSessionAccount, compareLiveSessionAccount, deleteCookieSession,
  isSessionUnavailable, listenSessionAccount, purgeLegacyAuthStorage,
} from '@etendosoftware/app-shell-core/auth';
import {
  bindOnboardingAccount, fetchSession, fetchAccount, fetchEnvironments, isSessionLostError, loginEnvironment,
  fetchOnboardingDraft, saveOnboardingDraft, verifyEmail,
} from './api.js';
import { rememberEnvironment } from './state.js';
import { buildAppReturnToHref, getSafeReturnTo } from './oauthReturnTo.js';
import { trackOnboarding } from './tracking.js';
import { createOnboardingLogout } from './logout.js';
import { createOnboardingDraftPersistence, restoreOnboardingDraft as restorePersistedOnboardingDraft } from './draftPersistence.js';
import { SetupPreviewMockup } from './components/SetupPreviewMockup.jsx';
import { OnboardingSessionLost } from './components/OnboardingSessionLost.jsx';

export function OnboardingFlow({ steps = [], config = {} }) {
  const ui = useUI();
  const [stepIndex, setStepIndex] = useState(-1); // -1 means verifying/loading initial state
  const [stepData, setStepData] = useState(() => config.defaultForm || {});
  // ETP-4576: the session lives in the __Host- cookie now; there is no more
  // client-readable token, only the CSRF proof issued alongside it.
  const [csrfToken, setCsrfToken] = useState(null);
  const [accountName, setAccountName] = useState(null);
  const [accountEmail, setAccountEmail] = useState(null);
  const [draftNotice, setDraftNotice] = useState(false);
  const [draftSaveWarning, setDraftSaveWarning] = useState(false);
  const [environments, setEnvironments] = useState([]);
  const [loadingEnvs, setLoadingEnvs] = useState(false);
  // ETP-5675 — this page lost its session: it expired or was closed, or another tab of this
  // browser signed in as a different account. Replaces the step with OnboardingSessionLost.
  const [sessionLost, setSessionLost] = useState(false);
  // ETP-5675 — the account this page is signed in as. The cookie is the browser profile's, so
  // this id is what tells "my session" apart from "the session another tab opened".
  const accountIdRef = useRef(null);
  const lastRecheckRef = useRef(0);

  const draftReadyRef = useRef(false);
  const logoutContextRef = useRef(null);
  const onLogoutRef = useRef(null);
  const draftPersistenceRef = useRef(null);
  const draftContextRef = useRef(null);
  const apiBase = config.apiBase || '';

  const currentStep = steps[stepIndex];

  draftContextRef.current = {
    apiBase,
    csrfToken,
    steps,
    stepId: currentStep?.id,
    form: stepData,
  };

  if (!draftPersistenceRef.current) {
    draftPersistenceRef.current = createOnboardingDraftPersistence({
      defaultForm: config.defaultForm || {},
      saveDraft: (draft) => {
        const context = draftContextRef.current;
        return saveOnboardingDraft(fetch, context.apiBase, context.csrfToken, draft);
      },
      onSaveFailure: (error) => {
        console.warn('Failed to save onboarding draft', error);
        // ETP-5675 — a lost session is not a transient save failure: warning and carrying on
        // only postponed the failure to the provisioning step.
        if (isSessionLostError(error)) setSessionLost(true);
        setDraftSaveWarning(true);
        trackOnboarding(config, 'onboarding_draft_save_failed', {
          action: 'save_draft',
          status: 'failed',
          httpStatus: error?.status,
        });
      },
    });
  }

  /**
   * ETP-4798 — true when this account still owes an email confirmation, i.e. a token was issued for
   * it and never consumed.
   *
   * Deliberately NOT `!emailVerified`: an account that predates this feature — or one whose
   * confirmation mail could not be sent, which is the fail-open case the backend leaves ungated —
   * is neither verified nor pending. Walling those off would lock out a user over a link that does
   * not exist and never will.
   */
  const owesEmailConfirmation = (account) => Boolean(account?.emailVerificationPending);

  // Helper to jump to a specific step by id
  const goToStep = useCallback((stepId) => {
    const idx = steps.findIndex(s => s.id === stepId);
    if (idx !== -1) {
      setStepIndex(idx);
    }
  }, [steps]);

  // ETP-5675 — binds the page to an account: requests then carry it as `X-Go-Account` (the
  // backend refuses them once the cookie is another account's), and every other tab hears that
  // the browser session now belongs to it.
  const bindAccount = useCallback((account) => {
    const id = account?.id || null;
    if (!id) return;
    if (account?.email) setAccountEmail(account.email);
    if (accountIdRef.current === id) return;
    accountIdRef.current = id;
    bindOnboardingAccount(id);
    announceSessionAccount(id);
  }, []);

  const unbindAccount = useCallback(() => {
    accountIdRef.current = null;
    bindOnboardingAccount(null);
  }, []);

  const markSessionLost = useCallback(() => setSessionLost(true), []);

  logoutContextRef.current = {
    resetState: () => {
      setCsrfToken(null);
      setAccountName(null);
      setSessionLost(false);
      unbindAccount();
      setEnvironments([]);
      setLoadingEnvs(false);
    },
    navigateToLogin: () => goToStep('login'),
    track: (eventDefinition, properties) => trackOnboarding(config, eventDefinition, properties),
  };

  if (!onLogoutRef.current) {
    onLogoutRef.current = createOnboardingLogout({
      flushDraft: () => draftPersistenceRef.current.flush(draftContextRef.current),
      cleanupSession: async () => {
        // ETP-5675 — revoke the session server-side. This used to only purge the legacy keys,
        // so "Cerrar sesión" left the session alive on the server: the cookie stayed valid for
        // whoever opened the next tab. The revoke names this page's account, so it can never
        // take down a session another tab opened as someone else, and only a confirmed revoke
        // tells the other tabs the browser is signed out. deleteCookieSession never throws.
        // Unbound first: this page's own listener hears the announcement too, and must not
        // mistake its own logout for a session lost to another tab.
        const { apiBase: base, csrfToken: proof } = draftContextRef.current;
        const accountId = accountIdRef.current;
        unbindAccount();
        const revoked = await deleteCookieSession(proof, base, { accountId });
        if (revoked) announceSessionAccount(null);
        // ETP-4576 — and purge the keys a pre-cookie session may have left behind;
        // app-shell-core owns that canonical list.
        purgeLegacyAuthStorage();
      },
      resetState: () => logoutContextRef.current.resetState(),
      navigateToLogin: () => logoutContextRef.current.navigateToLogin(),
      track: (eventDefinition, properties) => logoutContextRef.current.track(eventDefinition, properties),
    });
  }

  const onLogout = onLogoutRef.current;

  // Restore draft and set appropriate step index
  const restoreOnboardingDraft = useCallback(async () => {
    try {
      const draft = await fetchOnboardingDraft(fetch, apiBase);
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

  // Route by environments list: 0 -> profile (restore draft), 1+ -> auto-login and
  // redirect. Accounts with several environments return to the last one used;
  // a stale preference falls back to the first environment.
  const routeByEnvironments = useCallback(async (csrfToken, knownAccount) => {
    // ETP-4798 — the wall lives here because this is the one funnel every authenticated entry
    // passes through: the mount bootstrap, a fresh login (LoginStep calls this directly) and the
    // post-provisioning re-entry. Guarding only the mount path would let a plain login walk past
    // the wall and straight into onboarding.
    //
    // `knownAccount` lets a caller that already holds the /me payload hand it over instead of
    // asking twice; callers that do not have it pass nothing and it is fetched here. Under the
    // cookie session (ETP-4576) the mount reads /session — for the CSRF proof — rather than /me,
    // so it has nothing to hand over and this is the only /me read per load. A failed read
    // proceeds rather than walling — the backend's 403 is the real gate.
    let account = knownAccount;
    if (account === undefined) {
      try {
        account = await fetchAccount(fetch, apiBase);
        setAccountEmail(account?.email || null);
      } catch (err) {
        console.warn('Could not read the email verification state before entering', err);
        // ETP-5675 — no session (or another account's) is not "could not read the state".
        if (isSessionLostError(err)) {
          markSessionLost();
          return;
        }
        account = null;
      }
    }
    bindAccount(account);
    if (owesEmailConfirmation(account)) {
      goToStep('verify-email');
      return;
    }
    setLoadingEnvs(true);
    try {
      const envs = await fetchEnvironments(fetch, apiBase);
      setEnvironments(envs);
      if (envs.length === 0) {
        await restoreOnboardingDraft();
      } else {
        try {
          const lastUsedId = localStorage.getItem('sf_last_environment');
          const env = envs.find((candidate) => candidate.clientId === lastUsedId) || envs[0];
          trackOnboarding(config, 'onboarding_environment_enter_submitted', {
            action: 'enter_environment',
            status: 'started',
          });
          const data = await loginEnvironment(fetch, apiBase, csrfToken, env);
          // ETP-4576 — POST /sws/go/session/environment rotates the session cookie and
          // answers { status, environment, roleList, csrfToken }, carrying NO token
          // (verified in EtendoGoJwtServlet.handleSessionEnvironment). Gating on
          // `data.token`, as develop does, makes the environment switch a silent no-op:
          // the user clicks and nothing happens. The status is the only signal there is.
          if (data.status === 'success') {
            rememberEnvironment(env.clientId);
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
      // ETP-5675 — sending a 401 to the profile step started an onboarding that could only fail.
      if (isSessionLostError(err)) markSessionLost();
      else goToStep('profile');
    } finally {
      setLoadingEnvs(false);
    }
  }, [apiBase, restoreOnboardingDraft, goToStep, bindAccount, markSessionLost]);

  // Initial token verification on mount
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const resetToken = search.get('resetToken');
    if (resetToken) {
      goToStep('login');
      return;
    }

    // ETP-4798 — the confirmation link lands here with ?verifyToken=. Confirm it, strip the token
    // from the address bar so it is not left in history or a shared URL, then fall through to the
    // ordinary bootstrap: the link is usually opened while already signed in mid-onboarding, and it
    // must not restart the flow. The URL is rewritten before the request is issued, so a reload
    // mid-flight does not replay the token.
    const verifyToken = search.get('verifyToken');
    if (verifyToken) {
      search.delete('verifyToken');
      const query = search.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    }

    const initialView = localStorage.getItem('sf_onboarding_initial_view');
    if (initialView) {
      localStorage.removeItem('sf_onboarding_initial_view');
    }

    // ETP-4798: the confirmation MUST settle before the session is read. Both requests used to be
    // fired concurrently, and whenever the session read answered first it reported the still-pending
    // state and overwrote the just-confirmed one — leaving the banner up and the Start button gated
    // on a freshly confirmed address.
    const confirmEmailFirst = verifyToken
      ? verifyEmail(fetch, apiBase, verifyToken).catch((err) => {
          // An expired or already-superseded link is not a dead end: the banner stays up and
          // offers a re-send, so there is nothing to interrupt the flow with here.
          console.warn('Email confirmation link could not be used', err);
        })
      : null;

    // ETP-4576: the session lives in the __Host- cookie now, so there is no
    // client-visible token to check for presence — ask the server instead.
    // A 401 covers both "never had a session" and "had one, now expired or
    // invalid" alike (the cookie is httpOnly, so JS can't tell them apart),
    // so both now share the same initialView-respecting fallback below.
    //
    // ETP-4798: every mount re-asks the server, which is what makes a plain browser refresh the
    // way out of the wall — including when the mail was opened on another device. The decision
    // itself lives in routeByEnvironments, which reads /me for it.
    //
    // ETP-5550: a backend that is not answering (a deploy) is not "no session". The bootstrap
    // stays on the loading view and asks again with backoff (1s, 2s, 4s… capped at 30s).
    let retryTimer;
    let unmounted = false;
    const bootstrap = (retry = 0) => {
      fetchSession(fetch, apiBase)
        .then(data => {
          setCsrfToken(data.csrfToken ?? null);
          setAccountName(data.account?.name || data.account?.email || null);
          bindAccount(data.account);
          routeByEnvironments(data.csrfToken);
        })
        .catch((err) => {
          if (isSessionUnavailable(err)) return retryBootstrap(retry);
          unbindAccount();
          purgeLegacyAuthStorage();
          // Login is the default entry view; register is only shown when explicitly requested.
          goToStep(initialView === 'register' ? 'register' : 'login');
        });
    };

    const retryBootstrap = (retry) => {
      if (unmounted) return;
      retryTimer = setTimeout(() => bootstrap(retry + 1), Math.min(1000 * 2 ** retry, 30000));
    };

    if (confirmEmailFirst) {
      confirmEmailFirst.then(() => bootstrap());
    } else {
      bootstrap();
    }
    return () => {
      unmounted = true;
      clearTimeout(retryTimer);
    };
  }, []);

  // Every persistable step follows the same debounce policy; no field names
  // are special-cased, so future steps opt in through their definition.
  useEffect(() => {
    if (!csrfToken || !draftReadyRef.current) return undefined;
    draftPersistenceRef.current.schedule({ steps, stepId: currentStep?.id, form: stepData });
    return () => draftPersistenceRef.current.cancel();
  }, [stepData, currentStep, csrfToken, steps]);

  // ETP-5675 — another tab signed the browser in as a different account, or signed it out: this
  // page's session is gone, so stop here instead of failing at provisioning.
  useEffect(() => listenSessionAccount((liveAccountId) => {
    const mine = accountIdRef.current;
    if (mine && liveAccountId !== mine) markSessionLost();
  }), [markSessionLost]);

  // ETP-5675 — a page that was in the background may have missed the broadcast: on its way back
  // it compares its account with the live session (throttled). An unreadable session (a deploy)
  // changes nothing.
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;
    const recheck = async () => {
      const mine = accountIdRef.current;
      if (!mine || document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRecheckRef.current < SESSION_RECHECK_INTERVAL_MS) return;
      lastRecheckRef.current = now;
      const outcome = await compareLiveSessionAccount(mine, () => fetchSession(fetch, apiBase)
        .catch((err) => { if (isSessionUnavailable(err)) throw err; return null; }));
      if (accountIdRef.current !== mine) return;
      if (outcome.status === 'none' || outcome.status === 'other') markSessionLost();
    };
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);
    return () => {
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
    };
  }, [apiBase, markSessionLost]);

  // Handle register success: set up new state, then either wall on the email confirmation or
  // start onboarding.
  const handleRegisterSuccess = async (csrfToken, account) => {
    setCsrfToken(csrfToken);
    bindAccount(account);
    setAccountName(account?.name || account?.email || null);
    setAccountEmail(account?.email || null);
    setStepData({
      ...config.defaultForm,
      fullName: account?.name || account?.email || '',
    });
    setDraftNotice(false);
    draftPersistenceRef.current.restoreLastSaved(null);
    draftReadyRef.current = true;

    // ETP-4798: ask the server before choosing the destination. Registration only leaves a
    // confirmation pending when the mail was actually accepted for delivery — when it was not
    // (no configured app base URL, provider down) the backend deliberately leaves the account
    // ungated, and walling the user off would strand them waiting for a mail that never went out.
    // A failed read falls through to onboarding for the same reason; the backend's 403 still holds
    // the line if a confirmation really is owed.
    let freshAccount = null;
    try {
      freshAccount = await fetchAccount(fetch, apiBase);
    } catch (err) {
      console.warn('Could not read the email verification state after registering', err);
    }
    goToStep(owesEmailConfirmation(freshAccount) ? 'verify-email' : 'profile');
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

  // ETP-5675 — signing back in drops this page's state but nothing that was saved: the draft is
  // server-side and the next login resumes it. Nothing is revoked from here; the session is
  // either gone or another account's.
  if (sessionLost) {
    return (
      <OnboardingSessionLost
        config={config}
        accountEmail={accountEmail}
        onSignInAgain={() => {
          draftPersistenceRef.current.cancel();
          logoutContextRef.current.resetState();
          // A save warning belongs to the session that failed to save; left up, it told the login
          // screen to "try again" about a draft it cannot see. A plain logout keeps it (ETP-4584):
          // there it reports the user's own last edit, which did not reach the server.
          setDraftSaveWarning(false);
          purgeLegacyAuthStorage();
          goToStep('login');
        }}
        data-testid="OnboardingSessionLost__79cf84" />
    );
  }

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
      // ETP-4576: `token`/`setToken` are kept as the prop names for step
      // components (LoginStep/RegisterStep/EnvSelectStep/SetupProgressStep)
      // so this cycle doesn't have to migrate all of them at once — they now
      // carry the csrfToken value, not a bearer token. Renamed properly as
      // each step component gets migrated in its own cycle.
      token={csrfToken}
      setToken={setCsrfToken}
      accountName={accountName}
      setAccountName={setAccountName}
      accountEmail={accountEmail}
      draftNotice={draftNotice}
      setDraftNotice={setDraftNotice}
      draftSaveWarning={draftSaveWarning}
      environments={environments}
      loadingEnvs={loadingEnvs}
      routeByEnvironments={routeByEnvironments}
      handleRegisterSuccess={handleRegisterSuccess}
      onAccountChange={bindAccount}
      onSessionLost={markSessionLost}
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
