import React from 'react';
import { LogIn } from 'lucide-react';
import { Button } from '@etendosoftware/app-shell-core/components/ui/button';
import { useUI } from '@etendosoftware/app-shell-core/i18n';
import { AuthShell } from './AuthShell.jsx';

const AUTH_FEATURE_KEYS = ['onboardingAuthFeatureNoCard', 'onboardingAuthFeatureTrial', 'onboardingAuthFeatureInstantAccess'];

/**
 * ETP-5675 — shown when the onboarding page no longer holds its session: it expired, it was closed,
 * or another tab of this browser signed in as a different account (the session cookie belongs to
 * the browser profile, not to the tab). The flow used to carry on with only a draft-save warning
 * and then fail at provisioning with the backend's raw "Missing or invalid Authorization header".
 *
 * Signing back in resumes where the account left off: the draft lives server-side
 * (ETGO_ACCOUNT.ONBOARDING_DRAFT), so nothing that was saved is lost. This screen revokes nothing:
 * the session is either gone or someone else's.
 */
export function OnboardingSessionLost({ config = {}, accountEmail, onSignInAgain }) {
  const ui = useUI();
  return (
    <AuthShell
      brandLabel={config.brandLabel || 'Etendo'}
      marketingTitle={ui('onboardingMarketingTitle')}
      marketingDescription={ui('onboardingMarketingDescription')}
      featureLabels={AUTH_FEATURE_KEYS.map((key) => ui(key))}
      data-testid="AuthShell__session_lost">
      <div className="text-center" data-testid="onboarding-session-lost">
        <div className="mx-auto mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <LogIn className="h-7 w-7" data-testid="onboarding-session-lost-icon" />
        </div>
        <h1 className="text-3xl font-semibold tracking-[-0.06em] text-slate-900 sm:text-[2.4rem] sm:leading-[1.04]">
          {ui('onboardingSessionLostTitle')}
        </h1>
        <p className="mt-3 text-base text-slate-600 sm:text-lg">
          {ui('onboardingSessionLostDescription')}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {accountEmail
            ? ui('onboardingSessionLostResume').replace('{email}', accountEmail)
            : ui('onboardingSessionLostResumeUnknown')}
        </p>
        <Button
          type="button"
          className="mt-6 h-12 w-full rounded-lg text-base font-medium"
          onClick={onSignInAgain}
          data-testid="onboarding-session-lost-signin">
          {ui('onboardingSessionLostSignIn')}
        </Button>
      </div>
    </AuthShell>
  );
}

export default OnboardingSessionLost;
