import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createLocalAuthStorage } from './session.js';
import { resolveLogoutDestination } from './logoutRoute.js';

function clearLocalSession() {
  createLocalAuthStorage().clear();
}

/**
 * Public route element that clears the current session then replaces history
 * with a consumer-configured internal destination.
 */
export function LogoutRoute({ cleanup = clearLocalSession, safeDestination = '/' }) {
  const navigate = useNavigate();
  const cleanupRef = useRef(cleanup);
  const hasRunRef = useRef(false);
  const destination = useMemo(
    () => resolveLogoutDestination(safeDestination),
    [safeDestination],
  );

  cleanupRef.current = cleanup;

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    Promise.resolve()
      .then(() => cleanupRef.current?.())
      .catch(() => undefined)
      .finally(() => navigate(destination, { replace: true }));
  }, [destination, navigate]);

  return null;
}
