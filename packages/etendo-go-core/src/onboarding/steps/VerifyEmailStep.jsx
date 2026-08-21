import React, { useState, useEffect, useCallback } from 'react';
import { MailCheck, Loader2 } from 'lucide-react';
import { Button } from '@etendosoftware/app-shell-core/components/ui/button';
import { useUI } from '@etendosoftware/app-shell-core/i18n';
import { resendVerifyEmail } from '../api.js';
import { AuthShell } from '../components/AuthShell.jsx';
import { OnboardingSessionAction } from '../components/OnboardingSessionAction.jsx';

/**
 * ETP-4798 — how long the resend button stays disabled after a successful send.
 *
 * This is a courtesy timer, not a limit: the real ceiling is the backend throttle on the
 * verify-email contract (4 sends per 15 minutes per recipient). A modified client can ignore this
 * and still hit that.
 */
const RESEND_COOLDOWN_MS = 60_000;

/**
 * Keyed by address so a different account registering in the same browser is not made to wait out
 * someone else's cooldown. Persisted rather than kept in component state because a plain browser
 * refresh is this screen's documented way forward (it is how confirming on a phone unblocks a
 * desktop), so a state-only timer would be bypassed by the very action users are told to take.
 */
function cooldownStorageKey(email) {
  return `sf_verify_resend_until:${email || 'unknown'}`;
}

function readCooldownDeadline(email) {
  try {
    const raw = window.localStorage.getItem(cooldownStorageKey(email));
    const deadline = raw ? Number(raw) : 0;
    return Number.isFinite(deadline) && deadline > Date.now() ? deadline : 0;
  } catch {
    // Private-mode or blocked storage: degrade to no cooldown rather than breaking the screen.
    return 0;
  }
}

function writeCooldownDeadline(email, deadline) {
  try {
    window.localStorage.setItem(cooldownStorageKey(email), String(deadline));
  } catch {
    // Ignored: the in-memory countdown still runs for this page.
  }
}

function secondsUntil(deadline) {
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

const AUTH_FEATURE_KEYS = ['onboardingAuthFeatureNoCard', 'onboardingAuthFeatureTrial', 'onboardingAuthFeatureInstantAccess'];

/**
 * ETP-4798 — the wall between registering and onboarding.
 *
 * The account exists and holds a session token, but until the holder proves they control the
 * address there is nothing useful to do here, so this replaces the first onboarding step instead of
 * decorating it. Creating the tenant is the irreversible, costly step and the backend refuses it
 * outright (403 EMAIL_NOT_VERIFIED); this screen is the UX half of that same rule.
 *
 * There is deliberately no "I already confirmed" button and no polling. Following the link is what
 * confirms the address, and every mount re-reads /sws/go/me — so a plain browser refresh is the
 * escape hatch, which also covers the case of opening the mail on a phone while the flow is on a
 * desktop. Resending is offered because a mail landing in spam is the common failure, and logging
 * out is offered because a mistyped address otherwise has no way back.
 */
export function VerifyEmailStep({ config, accountName, accountEmail, token, onLogout }) {
  const ui = useUI();
  const apiBase = config.apiBase || '';
  // 'sent' is gone: a successful send no longer parks the button forever, it starts a cooldown.
  const [state, setState] = useState('idle'); // 'idle' | 'sending' | 'failed'
  const [cooldownUntil, setCooldownUntil] = useState(() => readCooldownDeadline(accountEmail));
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(readCooldownDeadline(accountEmail)));

  // One interval, alive only while a cooldown is pending, cleared on unmount or expiry.
  useEffect(() => {
    if (!cooldownUntil) {
      setSecondsLeft(0);
      return undefined;
    }
    const tick = () => {
      const left = secondsUntil(cooldownUntil);
      setSecondsLeft(left);
      if (left === 0) setCooldownUntil(0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  // A different address means a different cooldown; re-read rather than carry the old one over.
  useEffect(() => {
    setCooldownUntil(readCooldownDeadline(accountEmail));
  }, [accountEmail]);

  const cooling = secondsLeft > 0;

  const handleResend = useCallback(async () => {
    if (state === 'sending' || cooling) return;
    setState('sending');
    try {
      await resendVerifyEmail(fetch, apiBase, token, config.defaultForm?.language || '');
      // Only a success starts the cooldown — a failed send must be retryable straight away.
      const deadline = Date.now() + RESEND_COOLDOWN_MS;
      writeCooldownDeadline(accountEmail, deadline);
      setCooldownUntil(deadline);
      setState('idle');
    } catch {
      setState('failed');
    }
  }, [state, cooling, apiBase, token, accountEmail, config.defaultForm]);

  return (
    <AuthShell
      brandLabel={config.brandLabel || 'Etendo GO'}
      headerContent={onLogout && (
        <OnboardingSessionAction onLogout={onLogout} label={ui('logout')} />
      )}
      marketingTitle={ui('onboardingMarketingTitle')}
      marketingDescription={ui('onboardingMarketingDescription')}
      featureLabels={AUTH_FEATURE_KEYS.map((key) => ui(key))}
      data-testid="AuthShell__verify_email">
      <div data-testid="verify-email-step">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
          <MailCheck className="h-6 w-6 text-slate-500" aria-hidden="true" />
        </div>

        <h1 className="text-3xl font-semibold tracking-[-0.06em] text-slate-900 sm:text-[2.7rem] sm:leading-[1.04]">
          {ui('onboardingVerifyEmailTitle')}
        </h1>

        <p className="mt-4 text-base leading-7 text-slate-600">
          {accountEmail
            ? ui('onboardingVerifyEmailSentToAddress', { email: accountEmail })
            : ui('onboardingVerifyEmailSent')}
        </p>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          {ui('onboardingVerifyEmailHint')}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            onClick={handleResend}
            disabled={state === 'sending' || cooling}
            data-testid="verify-email-resend"
            className="h-12 rounded-lg px-6 text-base font-medium">
            {state === 'sending' && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {state === 'sending' && ui('onboardingEmailVerifyResending')}
            {state !== 'sending' && cooling
              && ui('onboardingEmailVerifyResendCooldown', { seconds: secondsLeft })}
            {state !== 'sending' && !cooling && ui('onboardingEmailVerifyResend')}
          </Button>
          {cooling && (
            <p
              role="status"
              data-testid="verify-email-resent"
              className="text-sm font-medium text-slate-900">
              {ui('onboardingEmailVerifyResent')}
            </p>
          )}
        </div>

        {state === 'failed' && (
          <p
            role="alert"
            data-testid="verify-email-resend-failed"
            className="mt-4 text-sm font-medium text-red-700">
            {ui('onboardingEmailVerifyResendFailed')}
          </p>
        )}
      </div>
    </AuthShell>
  );
}

export default VerifyEmailStep;
