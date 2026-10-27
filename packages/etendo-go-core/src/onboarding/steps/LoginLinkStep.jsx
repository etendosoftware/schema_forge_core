import React, { useState, useCallback } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
import { Button } from '@etendosoftware/app-shell-core/components/ui/button';
import { useUI } from '@etendosoftware/app-shell-core/i18n';
import { consumeLoginLink, resolveAuthErrorMessage } from '../api.js';
import { AuthShell } from '../components/AuthShell.jsx';

const AUTH_FEATURE_KEYS = ['onboardingAuthFeatureNoCard', 'onboardingAuthFeatureTrial', 'onboardingAuthFeatureInstantAccess'];

/**
 * ETP-5847 — where the one-time login link lands (`/onboarding?loginToken=…`). An account created
 * through the signup API has no password: this link, mailed when its environment is ready, is how
 * it gets in.
 *
 * The link is spent on the click, never on load. Mail scanners open the URLs in a message to check
 * them; spending the link on load would hand the session to the scanner and leave the owner with a
 * dead link. Once signed in, the session goes through `routeByEnvironments` like a password login,
 * which enters the account's only environment and leaves the onboarding.
 *
 * A spent or expired link offers the login screen, where "forgot password" lets a passwordless
 * account set one.
 */
export function LoginLinkStep({ config, loginToken, goToStep, setToken, setAccountName, onAccountChange, routeByEnvironments }) {
  const ui = useUI();
  const apiBase = config.apiBase || '';
  const [state, setState] = useState('idle'); // 'idle' | 'entering' | 'failed'
  const [error, setError] = useState(null);

  const handleEnter = useCallback(async () => {
    setState('entering');
    setError(null);
    try {
      const data = await consumeLoginLink(fetch, apiBase, loginToken);
      if (setToken) setToken(data.csrfToken ?? null);
      if (setAccountName) setAccountName(data.account?.name || data.account?.email || null);
      if (onAccountChange) onAccountChange(data.account);
      // Keeps the spinner on: routeByEnvironments ends in a navigation to the app, or on another step.
      await routeByEnvironments(data.csrfToken);
    } catch (err) {
      setError(resolveAuthErrorMessage(ui, err, 'onboardingLoginLinkInvalid'));
      setState('failed');
    }
  }, [apiBase, loginToken, setToken, setAccountName, onAccountChange, routeByEnvironments, ui]);

  return (
    <AuthShell
      brandLabel={config.brandLabel || 'Etendo'}
      brandHref={config.brandHref}
      marketingTitle={ui('onboardingMarketingTitle')}
      marketingDescription={ui('onboardingMarketingDescription')}
      featureLabels={AUTH_FEATURE_KEYS.map((key) => ui(key))}
      data-testid="AuthShell__login_link">
      <div data-testid="login-link-step">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
          <LogIn
            className="h-6 w-6 text-slate-500"
            aria-hidden="true"
            data-testid="LogIn__ef2b07" />
        </div>

        <h1 className="text-3xl font-semibold tracking-[-0.06em] text-slate-900 sm:text-[2.7rem] sm:leading-[1.04]">
          {ui('onboardingLoginLinkTitle')}
        </h1>

        <p className="mt-4 text-base leading-7 text-slate-600">
          {ui('onboardingLoginLinkDescription')}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            onClick={handleEnter}
            disabled={state === 'entering' || !loginToken}
            data-testid="login-link-enter"
            className="h-12 rounded-lg px-6 text-base font-medium">
            {state === 'entering' && (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
                data-testid="Loader2__ef2b07" />
            )}
            {ui('onboardingLoginLinkEnter')}
          </Button>
          {state === 'failed' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => goToStep('login')}
              data-testid="login-link-go-to-login"
              className="h-12 rounded-lg px-6 text-base font-medium">
              {ui('onboardingLoginLinkGoToLogin')}
            </Button>
          )}
        </div>

        {state === 'failed' && (
          <p
            role="alert"
            data-testid="login-link-failed"
            className="mt-4 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </div>
    </AuthShell>
  );
}

export default LoginLinkStep;
