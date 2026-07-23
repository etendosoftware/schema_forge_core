import React from 'react';
import { Button } from '@etendosoftware/app-shell-core/components/ui/button';

// Shared escape action for every onboarding screen with a platform-account
// session. The visible label is also the accessible button name.
export function OnboardingSessionAction({ onLogout, label }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onLogout}
      className="shrink-0 text-slate-600 hover:text-slate-900"
      data-testid="onboarding-logout">
      {label}
    </Button>
  );
}

export default OnboardingSessionAction;
