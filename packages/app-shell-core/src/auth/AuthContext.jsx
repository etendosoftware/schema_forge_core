import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import { createLocalAuthStorage, normalizeAuthSession, decodeJwtPayload } from './session.js';
import { registerApiSession, createApiFetch } from './api.js';
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

export function AuthProvider({ children, storage, initialSession, onSessionChange, fetchWindowAccess, apiBaseUrl }) {
  const authStorage = useMemo(() => storage || createLocalAuthStorage(), [storage]);
  const [controller] = useState(() => createSessionController(normalizeAuthSession({
    ...authStorage.read(), ...initialSession,
  }), authStorage, onSessionChange, apiBaseUrl));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const options = useRef({ fetchWindowAccess, apiBaseUrl });
  const operation = useRef(null);

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
          const before = decodeJwtPayload(session.token);
          const after = decodeJwtPayload(outcome.session.token);
          const contextChanged = ['role', 'organization', 'client', 'user'].some((key) => before?.[key] !== after?.[key]);
          const previous = controller.getSnapshot();
          // Accept the coherent tuple before invoking host permission transport: both
          // ambient apiFetch and a session-bound client must see the renewed JWT.
          // Keep settled same-context grants until replacement, without a temporary
          // denial/remount. A real context change withdraws those grants immediately.
          const replaced = controller.replace(outcome.session, {
            refresh: false, status: 'refreshing', ready: previous.isSessionReady,
            access: contextChanged ? {} : {
              windowAccess: previous.windowAccess, capabilities: previous.capabilities,
            },
          });
          if (controller.getSnapshot().session !== replaced) return { status: 'superseded' };
          work.snapshot = controller.capture();
          const access = await loadAccess(outcome.session, work.snapshot);
          if (!controller.isCurrent(work.snapshot)) return { status: 'superseded' };
          if (work.trailing) continue;
          controller.publish({ windowAccess: access.windowAccess ?? {},
            capabilities: access.capabilities ?? {}, sessionRefreshStatus: 'ready', isSessionReady: true });
        } else {
          const blocked = outcome.status === 'metadata-required' || current.metadataRequired;
          // A same-role legacy refresh still revalidates permissions, atomically, so
          // an unchanged focus does not temporarily unmount permission-gated forms.
          const access = outcome.status === 'legacy' && !blocked ? await loadAccess(session, work.snapshot) : null;
          if (!controller.isCurrent(work.snapshot)) return { status: 'superseded' };
          if (work.trailing) continue;
          const update = {
            needsRefresh: false, isSessionReady: !blocked,
            metadataRequired: blocked,
            sessionRefreshStatus: blocked ? 'metadata-required' : outcome.status,
            ...(blocked ? { windowAccess: {}, capabilities: {} } : {}),
            ...(access ? { windowAccess: access.windowAccess ?? {}, capabilities: access.capabilities ?? {},
              accessLoaded: true, authRevision: controller.getSnapshot().authRevision + 1 } : {}),
          };
          if (blocked || access) controller.invalidate(update);
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
      onUnauthorized: controller.logout,
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
    logout: controller.logout,
    captureSession: controller.capture,
    isCurrentSession: controller.isCurrent,
    apiSessionScope: controller,
    refreshToken: () => refresh(true),
  }), [controller, refresh]);

  const value = useMemo(() => ({
    ...state.session,
    isAuthenticated: !!state.session.token,
    isSessionReady: state.isSessionReady,
    isRefreshingSession: state.isRefreshingSession,
    sessionRefreshStatus: state.sessionRefreshStatus,
    authRevision: state.authRevision,
    windowAccess: state.windowAccess,
    capabilities: state.capabilities,
    ...actions,
  }), [state, actions]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthOptional() { return useContext(AuthContext); }

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
