/**
 * Creates the single logout operation used by authenticated onboarding steps.
 *
 * The guard intentionally lives outside React state: two clicks in the same
 * render must share one cleanup operation before a re-render can occur.
 */
export function createOnboardingLogout({ cleanupSession, resetState, navigateToLogin, track }) {
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
