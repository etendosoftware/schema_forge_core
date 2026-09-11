import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import {
  createLocalAuthStorage, createMemoryAuthStorage, mapRestoredSession, normalizeAuthSession,
  purgeLegacyAuthStorage,
} from './session.js';
import {
  createApiFetch, deleteCookieSession, fetchCookieSession, registerApiSession,
} from './api.js';
import { CREDENTIAL_MODES, setSessionCredentials } from './sessionCredentials.js';
import { createSessionController } from './sessionController.js';
import { reconcileSessionRefresh } from './sessionRefresh.js';

const AuthContext = createContext(null);
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
// [ETP-5195] Fallback cadence for the periodic-poll refresh trigger below.
const SILENT_REFRESH_POLL_INTERVAL_MS = 5 * 60 * 1000;

// [ETP-5195] `/sws/neo/refreshtoken` goes through the NEO webhook bridge, which wraps every
// response in `{"result": "<json-string>"}` (see com.etendoerp.go's docs/neo-headless.md
// "envelope" section) — the real `{token, session}` payload is nested and JSON-encoded, not
// top-level. Unwrap it here so `reconcileSessionRefresh` always receives the real payload
// shape it expects. A body that is already a plain object without a `result` string (e.g. an
// already-unwrapped shape passed in by a test or another caller) is returned unchanged.
function unwrapBridgeEnvelope(body) {
  if (body && typeof body.result === 'string') {
    try { return JSON.parse(body.result); } catch { return null; }
  }
  return body;
}

// [ETP-5195 follow-up] `windowAccess`/`capabilities` are flat maps of primitive values
// (tier strings / booleans) — a plain key-by-key comparison is enough to tell a genuinely
// changed permission set apart from the SAME set re-fetched as a new object. Used by the
// tab-focus/visibility/poll-triggered "legacy" (no role change) refresh path below to avoid
// bumping `generation`/`authRevision` — and therefore every `isCurrentSession()`/`authRevision`
// consumer app-wide (menu, viewer-role, any in-flight fetch) — when nothing actually changed.
function sameFlatMap(a, b) {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => a[key] === b[key]);
}

export function AuthProvider({
  children, storage, initialSession, onSessionChange, fetchWindowAccess, apiBaseUrl,
  // ETP-4576 — which credential scheme requests use: 'bearer', 'cookie' or 'auto'.
  // `auto` resolves to whichever scheme the backend actually issued, by reading whether
  // a CSRF token came back with the session. Declaring `cookie` by hand is a claim about
  // the BACKEND the frontend cannot verify, and getting it wrong fails in the worst
  // direction: reads keep working off the browser's own cookie while every unsafe request
  // answers 403 for a missing proof.
  credentialMode = CREDENTIAL_MODES.auto,
  // ETP-4576 — DERIVED from `credentialMode`, so one switch governs the whole thing.
  // An explicit `null` opts out; passing `undefined` re-arms this default.
  restoreSession = credentialMode === CREDENTIAL_MODES.cookie
    || credentialMode === CREDENTIAL_MODES.auto ? fetchCookieSession : null,
}) {
  // ETP-4576 — under the cookie scheme the default storage is MEMORY, not localStorage:
  // the server response is authoritative and `purgeLegacyAuthStorage` deletes the sf_auth_*
  // keys on mount, so persisting the session there would rewrite the very keys just purged.
  // A legacy bearer host (restoreSession opted out) keeps localStorage verbatim, and an
  // explicit `storage` prop always wins. Keyed on the BOOLEAN so a host passing an inline
  // arrow as `restoreSession` does not rebuild the adapter on every render.
  const usesRestore = typeof restoreSession === 'function';
  const authStorage = useMemo(
    () => storage || (usesRestore ? createMemoryAuthStorage() : createLocalAuthStorage()),
    [storage, usesRestore],
  );
  const [controller] = useState(() => createSessionController(normalizeAuthSession({
    ...authStorage.read(), ...initialSession,
  }), authStorage, onSessionChange, apiBaseUrl));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const options = useRef({ fetchWindowAccess, apiBaseUrl });
  const operation = useRef(null);
  // ETP-4576 — the X-Go-CSRF proof issued by the backend in session responses. In memory
  // only, never persisted: it is bound to the httpOnly session cookie, not a value the
  // client should carry across reloads on its own.
  const [csrfToken, setCsrfToken] = useState(null);
  // ETP-4576 — tri-state auth status. Hosts that opt out of the restore (`restoreSession:
  // null`) resolve synchronously from whatever session was read, exactly as before, and
  // never see 'booting'. Hosts that opt in start 'booting' until GET /sws/go/session settles,
  // so a reload does not flash the login screen before the restore resolves.
  const [status, setStatus] = useState(() => (
    typeof restoreSession === 'function'
      ? 'booting'
      : (controller.getSnapshot().session.token ? 'authenticated' : 'anonymous')
  ));
  // Guards the mount-only restore against a host passing an inline arrow as `restoreSession`,
  // which would otherwise change identity every render.
  const hasRestoredRef = useRef(false);

  useBrowserLayoutEffect(() => {
    controller.configure({ storage: authStorage, onSessionChange, apiBaseUrl });
    options.current = { fetchWindowAccess, apiBaseUrl };
  }, [controller, authStorage, onSessionChange, fetchWindowAccess, apiBaseUrl]);

  // A changed storage adapter or server is a session boundary, even with the same JWT.
  const environment = useRef({ storage: authStorage, apiBaseUrl });
  useBrowserLayoutEffect(() => {
    const previous = environment.current;
    environment.current = { storage: authStorage, apiBaseUrl };
    if (previous.storage !== authStorage || previous.apiBaseUrl !== apiBaseUrl) {
      controller.replace(previous.storage !== authStorage ? authStorage.read() : controller.getSnapshot().session);
    }
  }, [controller, authStorage, apiBaseUrl]);

  // ETP-4576 — session restore on mount. Purges the legacy sf_auth_*/sf_platform_*
  // localStorage keys once, then consumes GET /sws/go/session through the host-supplied
  // fetcher. Success moves the status to 'authenticated' and stores the CSRF proof; any
  // failure (no active session, network error) clears locally — deliberately NOT the
  // exposed logout(), which revokes server-side: the server just told us there is no
  // session, so there is nothing to revoke.
  useEffect(() => {
    if (typeof restoreSession !== 'function') return;
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    purgeLegacyAuthStorage();

    Promise.resolve()
      .then(() => restoreSession())
      .then((result) => {
        if (!result) throw new Error('No active session');
        setCsrfToken(result.csrfToken ?? null);
        controller.replace(normalizeAuthSession(mapRestoredSession(result)), { refresh: false, persist: false });
        setStatus('authenticated');
      })
      .catch(() => {
        setCsrfToken(null);
        controller.logout();
        setStatus('anonymous');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ETP-4576 — hands the active scheme and both credentials to ./sessionCredentials.js,
  // which every request builder in the core and the host reads. This is the ONLY writer.
  useEffect(() => {
    setSessionCredentials({ mode: credentialMode, token: state.session.token, csrfToken });
  }, [credentialMode, state.session.token, csrfToken]);

  const loadAccess = useCallback(async (session, snapshot) => {
    try {
      if (!session.selectedRole || typeof options.current.fetchWindowAccess !== 'function') return {};
      return (await options.current.fetchWindowAccess(session, {
        isCurrent: () => controller.isCurrent(snapshot),
      })) || {};
    } catch { return {}; }
  }, [controller]);

  const refresh = useCallback((imperative = false) => {
    const current = controller.getSnapshot();
    if (!current.session.token) return Promise.resolve({ status: 'idle' });
    const pending = operation.current;
    if (pending && controller.isCurrent(pending.snapshot)) {
      if (imperative) pending.trailing = true;
      return pending.promise;
    }
    const work = { snapshot: controller.capture(), trailing: false };
    operation.current = work;
    controller.publish({ isRefreshingSession: true, sessionRefreshStatus: 'refreshing' });
    work.promise = (async () => {
      let outcome;
      do {
        work.trailing = false;
        const session = controller.getSnapshot().session;
        try {
          // Independent scope: refresh is what releases bootstrap, and owns its own guard.
          const request = createApiFetch(options.current.apiBaseUrl, () => session.token, null, null);
          const response = await request('/sws/neo/refreshtoken', { on401: 'ignore' });
          const body = response.ok ? await response.json() : null;
          if (!controller.isCurrent(work.snapshot)) return { status: 'superseded' };
          const payload = body ? unwrapBridgeEnvelope(body) : null;
          outcome = payload ? reconcileSessionRefresh(session, payload) : { status: 'failed' };
        } catch {
          console.warn('[ETP-5195] Silent session refresh failed; keeping existing session.');
          outcome = { status: 'failed' };
        }
        if (!controller.isCurrent(work.snapshot)) return { status: 'superseded' };
        // An imperative mutation during this request requires a post-mutation request.
        if (work.trailing) continue;
        if (outcome.session) {
          const previous = controller.getSnapshot();
          // Compare the RESOLVED metadata (role/org list content, not just the raw JWT claim
          // ids the tokens carry) — a role can be renamed or gain/lose an available
          // organization while `selectedRole`/`selectedOrg` stay the same id, and that content
          // change must still be treated as real. Only a response whose full metadata is
          // byte-for-byte identical to what is already in state is a pure token rotation.
          const metadataUnchanged = JSON.stringify({
            clientId: session.clientId, roleList: session.roleList,
            selectedRole: session.selectedRole, selectedOrg: session.selectedOrg,
          }) === JSON.stringify({
            clientId: outcome.session.clientId, roleList: outcome.session.roleList,
            selectedRole: outcome.session.selectedRole, selectedOrg: outcome.session.selectedOrg,
          });
          // Accept the coherent tuple before invoking host permission transport: both
          // ambient apiFetch and a session-bound client must see the renewed JWT — this
          // still happens unconditionally below (see the "same-role authoritative
          // permission transport" tests: the backend mints a fresh token, new iat/exp, on
          // EVERY call even with zero role/org content change, and that freshly-issued
          // token must still be used for this refresh's own access check and every future
          // request). [ETP-5195 follow-up] `bump: false` when metadata is unchanged, though:
          // bumping `generation`/`authRevision` for a pure rotation made every
          // generation/authRevision-gated consumer app-wide (sidebar menu, useViewerRole)
          // treat a no-op refresh as a real session change and reset — confirmed live via
          // Network tab (menu, an unrelated open window's record/logo/related lookups all
          // refetching together on a plain alt-tab with zero role change). Settled
          // same-content grants are kept as-is (same object reference) until proven
          // different by the loadAccess() call below, rather than cleared up front.
          const replaced = controller.replace(outcome.session, {
            refresh: false, status: 'refreshing', ready: previous.isSessionReady,
            bump: !metadataUnchanged,
            access: metadataUnchanged
              ? { windowAccess: previous.windowAccess, capabilities: previous.capabilities }
              : {},
          });
          if (controller.getSnapshot().session !== replaced) return { status: 'superseded' };
          work.snapshot = controller.capture();
          const access = await loadAccess(outcome.session, work.snapshot);
          if (!controller.isCurrent(work.snapshot)) return { status: 'superseded' };
          if (work.trailing) continue;
          const latest = controller.getSnapshot();
          const nextWindowAccess = access.windowAccess ?? {};
          const nextCapabilities = access.capabilities ?? {};
          const accessChanged = !sameFlatMap(nextWindowAccess, latest.windowAccess)
            || !sameFlatMap(nextCapabilities, latest.capabilities);
          const finalUpdate = {
            sessionRefreshStatus: 'ready', isSessionReady: true,
            windowAccess: accessChanged ? nextWindowAccess : latest.windowAccess,
            capabilities: accessChanged ? nextCapabilities : latest.capabilities,
          };
          if (accessChanged) controller.invalidate(finalUpdate);
          else controller.publish(finalUpdate);
          work.snapshot = controller.capture();
        } else {
          const blocked = outcome.status === 'metadata-required' || current.metadataRequired;
          // A same-role legacy refresh still revalidates permissions, atomically, so
          // an unchanged focus does not temporarily unmount permission-gated forms.
          const access = outcome.status === 'legacy' && !blocked ? await loadAccess(session, work.snapshot) : null;
          if (!controller.isCurrent(work.snapshot)) return { status: 'superseded' };
          if (work.trailing) continue;
          const previous = controller.getSnapshot();
          const nextWindowAccess = access?.windowAccess ?? {};
          const nextCapabilities = access?.capabilities ?? {};
          // [ETP-5195 follow-up] A tab-focus/visibility-regain/poll refresh fires on every
          // reactivation even when the role never changed (see the visibilitychange/focus
          // effect and the poll interval below) — most of the time it resolves the SAME
          // permissions, just as a freshly-fetched object. Bumping `generation`/`authRevision`
          // unconditionally here made every `isCurrentSession()`/`authRevision` consumer
          // app-wide (the sidebar menu, `useViewerRole`, any in-flight generation-gated fetch)
          // treat a no-op refresh as a real session change: the sidebar visibly reset to its
          // loading state and back, and any record view re-running its own generation-gated
          // fetch reloaded and lost UI state (e.g. scroll position) — confirmed root cause,
          // reported live as "alt-tab causes a menu flicker and window refresh with no role
          // change". Only actually invalidate when the resolved access differs from what is
          // already in state; otherwise a plain `publish` updates status flags without
          // touching `generation`/`authRevision`/the `windowAccess`/`capabilities` references.
          const accessChanged = !!access
            && (!sameFlatMap(nextWindowAccess, previous.windowAccess) || !sameFlatMap(nextCapabilities, previous.capabilities));
          const update = {
            needsRefresh: false, isSessionReady: !blocked,
            metadataRequired: blocked,
            sessionRefreshStatus: blocked ? 'metadata-required' : outcome.status,
            ...(blocked ? { windowAccess: {}, capabilities: {} } : {}),
            ...(access ? {
              accessLoaded: true,
              windowAccess: accessChanged ? nextWindowAccess : previous.windowAccess,
              capabilities: accessChanged ? nextCapabilities : previous.capabilities,
              ...(accessChanged ? { authRevision: previous.authRevision + 1 } : {}),
            } : {}),
          };
          if (blocked || accessChanged) controller.invalidate(update);
          else controller.publish(update);
          work.snapshot = controller.capture();
        }
      } while (work.trailing);
      return { status: controller.getSnapshot().sessionRefreshStatus };
    })().finally(() => {
      if (operation.current !== work) return;
      operation.current = null;
      if (controller.isCurrent(work.snapshot)) controller.publish({ isRefreshingSession: false });
    });
    return work.promise;
  }, [controller, loadAccess]);

  useBrowserLayoutEffect(() => {
    controller.activate();
    const unregister = registerApiSession({
      getToken: () => controller.getSnapshot().session.token,
      // ETP-4576 — a 401 has to move the tri-state status too, or `isAuthenticated` stays
      // true off a stale 'authenticated' and the app never redirects to login. No server
      // revocation here: a 401 means the session is already gone on the backend.
      onUnauthorized: () => {
        setCsrfToken(null);
        setStatus('anonymous');
        controller.logout();
      },
      baseUrl: apiBaseUrl,
      scope: controller,
      replaceSession: controller.replace,
    });
    return () => { controller.dispose(); unregister(); };
  }, [controller, apiBaseUrl]);

  useEffect(() => {
    let cancelled = false;
    // StrictMode replays setup/cleanup before this microtask; only the live setup starts I/O.
    if (state.needsRefresh) Promise.resolve().then(() => { if (!cancelled) refresh(); });
    return () => { cancelled = true; };
  }, [state.generation, state.needsRefresh, refresh]);

  useEffect(() => {
    if (!state.isSessionReady || state.needsRefresh || state.accessLoaded || !state.session.selectedRole) return;
    const snapshot = controller.capture();
    let cancelled = false;
    loadAccess(state.session, snapshot).then((access) => {
      if (!cancelled && controller.isCurrent(snapshot)) controller.publish({
        windowAccess: access.windowAccess ?? {}, capabilities: access.capabilities ?? {}, accessLoaded: true,
      });
    });
    return () => { cancelled = true; };
  }, [controller, state.generation, state.isSessionReady, state.needsRefresh, state.accessLoaded, state.session, loadAccess]);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;
    let timer;
    const schedule = () => {
      if (document.visibilityState !== 'visible' || timer !== undefined) return;
      timer = setTimeout(() => { timer = undefined; refresh(); }, 50);
    };
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('focus', schedule);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', schedule);
      window.removeEventListener('focus', schedule);
    };
  }, [refresh]);

  // [ETP-5195] Interim mitigation, not the full fix: a user demoted/promoted elsewhere
  // who never blurs/refocuses the tab (and never reloads) hits none of the triggers
  // above, so a stale role claim can otherwise ride out the full JWT lifetime. Poll
  // on a fixed interval to bound that window; the real fix is server-side revocation,
  // tracked separately.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const interval = setInterval(() => { refresh(); }, SILENT_REFRESH_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const actions = useMemo(() => ({
    setWindowAccess: (value) => controller.publish({ windowAccess: typeof value === 'function' ? value(controller.getSnapshot().windowAccess) : value }),
    setCapabilities: (value) => controller.publish({ capabilities: typeof value === 'function' ? value(controller.getSnapshot().capabilities) : value }),
    setSession: controller.patch,
    login: controller.patch,
    replaceSession: controller.replace,
    selectRole: (role) => controller.replace({ ...controller.getSnapshot().session, selectedRole: role || null }, { refresh: false }),
    selectOrg: (org) => controller.replace({ ...controller.getSnapshot().session, selectedOrg: org || null }, { refresh: false }),
    // ETP-4576 — controller.logout only clears local state. Under the cookie scheme the
    // session lives server-side, so it has to be revoked there too.
    //
    // The revoke is FIRED, never awaited, and the local clear is synchronous: a user who
    // asked to leave is out of this tab the moment they ask, whatever the network does.
    // Awaiting it made logout() return a promise and deferred the clear behind a round
    // trip, so a request issued in between still carried the session. deleteCookieSession
    // never throws, so nothing here can trap the user in a session they asked to leave.
    // The proof is passed explicitly because the next line discards it.
    logout: () => {
      if (typeof restoreSession === 'function') deleteCookieSession(csrfToken);
      // ETP-4576 — purge the legacy sf_auth_*/sf_platform_* keys too, in BOTH schemes.
      // controller.logout() clears only the storage adapter the host injected, which under
      // the default (memory) is not where those keys live, so a credential left by an
      // earlier version or by the onboarding app survived a logout untouched. The mount
      // purge does not cover it either: it runs inside the restore effect, which the bearer
      // scheme never schedules. Logout is exactly the moment when nothing may survive.
      purgeLegacyAuthStorage();
      setCsrfToken(null);
      setStatus('anonymous');
      controller.logout();
    },
    captureSession: controller.capture,
    isCurrentSession: controller.isCurrent,
    apiSessionScope: controller,
    refreshToken: () => refresh(true),
  }), [controller, refresh, restoreSession, csrfToken]);

  const value = useMemo(() => ({
    ...state.session,
    // ETP-4576 — a cookie-session host NEVER populates session.token, so `!!token` alone
    // would report every signed-in user as anonymous and send the whole app to /login.
    // `status` is their authentication signal; the token check stays for legacy hosts,
    // whose status is resolved once on mount and would otherwise strand a post-mount
    // login() at false.
    isAuthenticated: !!state.session.token || status === 'authenticated',
    csrfToken,
    status,
    setCsrfToken,
    isSessionReady: state.isSessionReady,
    isRefreshingSession: state.isRefreshingSession,
    sessionRefreshStatus: state.sessionRefreshStatus,
    authRevision: state.authRevision,
    windowAccess: state.windowAccess,
    capabilities: state.capabilities,
    ...actions,
  }), [state, actions, csrfToken, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthOptional() { return useContext(AuthContext); }

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
