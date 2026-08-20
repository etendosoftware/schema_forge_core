import React, { useState } from 'react';
import { MailCheck, Loader2 } from 'lucide-react';
import { Button } from '@etendosoftware/app-shell-core/components/ui/button';
import { useUI } from '@etendosoftware/app-shell-core/i18n';
import { resendVerifyEmail } from '../api.js';
import { AuthShell } from '../components/AuthShell.jsx';
import { OnboardingSessionAction } from '../components/OnboardingSessionAction.jsx';

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
  const [state, setState] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'failed'

  const handleResend = async () => {
    if (state === 'sending') return;
    setState('sending');
    try {
      await resendVerifyEmail(fetch, apiBase, token, config.defaultForm?.language || '');
      setState('sent');
    } catch {
      setState('failed');
    }
  };

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
          {state === 'sent' ? (
            <p
              role="status"
              data-testid="verify-email-resent"
              className="text-sm font-medium text-slate-900">
              {ui('onboardingEmailVerifyResent')}
            </p>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleResend}
              disabled={state === 'sending'}
              data-testid="verify-email-resend"
              className="h-12 rounded-lg px-6 text-base font-medium">
              {state === 'sending' && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {state === 'sending'
                ? ui('onboardingEmailVerifyResending')
                : ui('onboardingEmailVerifyResend')}
            </Button>
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
