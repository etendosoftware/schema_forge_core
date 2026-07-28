/**
 * Creates the single logout operation used by authenticated onboarding steps.
 *
 * The guard intentionally lives outside React state: two clicks in the same
 * render must share one cleanup operation before a re-render can occur.
 */
export function createOnboardingLogout({ flushDraft, cleanupSession, resetState, navigateToLogin, track }) {
  let inFlight = null;

  const safelyTrack = (eventDefinition, properties) => {
    try {
      track(eventDefinition, properties);
    } catch {
      // Telemetry is best-effort and cannot retry an already-completed logout.
    }
  };

  return function onLogout() {
    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        // A draft save is best-effort: failure must never trap an authenticated
        // user in onboarding or prevent local credentials from being cleared.
        if (flushDraft) {
          try {
            await flushDraft();
          } catch {
            // The draft persistence layer owns the warning and observability.
          }
        }
        await cleanupSession();
        resetState();
        navigateToLogin();
        safelyTrack('onboarding_auth_logout', {
          action: 'logout',
          status: 'success',
        });
      } catch (error) {
        resetState();
        navigateToLogin();
        safelyTrack('onboarding_auth_logout', {
          action: 'logout',
          status: 'failed',
        });
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  };
}
