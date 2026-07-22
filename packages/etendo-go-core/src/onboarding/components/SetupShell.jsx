import React, { useEffect, useState } from 'react';
import { Button } from '@etendosoftware/app-shell-core/components/ui/button';
import AuthBrand from './AuthBrand.jsx';

// Bridges the per-step remount: SetupShell unmounts/remounts when moving between
// the Profile and Company steps, so a plain CSS width transition can't animate
// (the fill mounts already at its target width). We persist the last rendered
// progress at module scope, start each mount from it, then transition to the new
// value on the next frame — so the bar animates 50→90 (and 90→50 on Back).
let lastProgressValue = 0;

// Left column of the setup steps (Profile / Company). The right-side dashboard
// preview is intentionally NOT rendered here: it is hoisted to OnboardingFlow so
// a single SetupPreviewMockup instance persists across the profile→company step
// change, which is what lets its CSS transitions (the scroll animation) fire.
// This component renders only the form section; OnboardingFlow provides the
// two-column grid and the persistent preview aside.
export function SetupShell({ brandLabel, progressLabel, progressValue, headerContent, onLogout, logoutLabel, children }) {
  // Start from the previously rendered value so the fill grows into the new one.
  const [fillWidth, setFillWidth] = useState(lastProgressValue);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setFillWidth(progressValue);
      lastProgressValue = progressValue;
    });
    return () => cancelAnimationFrame(raf);
  }, [progressValue]);

  // Enter animation: the form body swaps on every step change (this component
  // remounts). Fade + slide it up on mount so the step change feels smooth
  // instead of an abrupt swap.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section className="flex min-h-screen flex-col bg-white px-6 py-6 sm:px-8 lg:px-10 xl:px-12">
      <div className="flex items-start justify-between gap-6">
        <AuthBrand label={brandLabel} data-testid="AuthBrand__79cf84" />
        <div className="flex w-full max-w-[22rem] flex-col items-end gap-3 pt-1">
          {onLogout && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="text-slate-500 hover:text-slate-700"
              data-testid="onboarding-setup-logout">
              {logoutLabel}
            </Button>
          )}
          {headerContent}
          <div className="w-full">
            <p className="text-right text-xs font-medium text-slate-500 sm:text-sm">
              {progressLabel}
            </p>
            <div className="mt-3 h-2.5 rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-900 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${fillWidth}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center py-10 lg:py-16">
        <div
          className={`w-full max-w-[34.75rem] transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none ${entered ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}>
          {children}
        </div>
      </div>
    </section>
  );
}

export default SetupShell;
