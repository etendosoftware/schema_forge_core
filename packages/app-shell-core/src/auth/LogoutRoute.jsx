import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { resolveLogoutDestination } from './logoutRoute.js';

/**
 * Public route element that clears the current session then replaces history
 * with a consumer-configured internal destination.
 *
 * ETP-4576 — by default this now goes through the context's `logout()`, which
 * revokes the session server-side (DELETE /sws/go/session) on top of clearing
 * local state. The previous default only cleared localStorage, so navigating
 * here left the cookie — and therefore the session — alive on the server.
 *
 * A `cleanup` prop still takes priority and fully replaces that default.
 */
export function LogoutRoute({ cleanup, safeDestination = '/' }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  // A parameter default can't call a hook, so the fallback is resolved here.
  const cleanupRef = useRef(cleanup ?? logout);
  const hasRunRef = useRef(false);
  const destination = useMemo(
    () => resolveLogoutDestination(safeDestination),
    [safeDestination],
  );

  // Reassigned every render so the effect never fires a stale closure.
  cleanupRef.current = cleanup ?? logout;

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
