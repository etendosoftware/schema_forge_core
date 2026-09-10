import { normalizeAuthSession, decodeJwtPayload } from './session.js';

const fingerprint = (session) => JSON.stringify(normalizeAuthSession(session));

/** Synchronous authority for async work. React renders observe, never own, its generation. */
export function createSessionController(initialSession, storage, onSessionChange, apiBaseUrl) {
  const listeners = new Set();
  const owner = {};
  let active = true;
  let state = {
    session: normalizeAuthSession(initialSession),
    generation: 0,
    authRevision: 0,
    isSessionReady: !initialSession?.token,
    needsRefresh: !!initialSession?.token,
    isRefreshingSession: false,
    sessionRefreshStatus: 'idle',
    metadataRequired: false,
    windowAccess: {},
    capabilities: {},
  };
  let config = { storage, onSessionChange, apiBaseUrl };
  const publish = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
    return state;
  };
  const readStorage = () => {
    try { return fingerprint(config.storage?.read()); } catch { return null; }
  };
  const capture = () => {
    const claims = decodeJwtPayload(state.session.token);
    return {
      owner, generation: state.generation, storage: readStorage(),
      token: state.session.token,
      userId: claims?.user ?? null,
      clientId: claims?.client ?? null,
      sessionClientId: state.session.clientId,
      apiBaseUrl: config.apiBaseUrl ?? null,
    };
  };
  const isCurrent = (snapshot) => {
    if (!active || snapshot?.owner !== owner || snapshot.generation !== state.generation) return false;
    const current = capture();
    return ['storage', 'token', 'userId', 'clientId', 'sessionClientId', 'apiBaseUrl']
      .every((key) => snapshot[key] === current[key]);
  };

  // [ETP-5195 follow-up] `bump` (default true) lets a caller adopt a new session (e.g. a
  // freshly-rotated token with byte-for-byte unchanged role/org/client/user content) without
  // advancing `generation`/`authRevision` — see AuthContext.jsx's refresh() for why: those are
  // the app-wide "the session changed under me" signal (isCurrent()/every authRevision-gated
  // hook), and a pure rotation must not trip it. `isCurrent()` still independently compares the
  // raw `token` value, so a stale in-flight request captured before this call is still
  // correctly treated as superseded once the token differs — generation is not the only guard.
  function replace(nextSession, { refresh = true, status = 'idle', clear = false, access, ready = true, bump = true } = {}) {
    const session = normalizeAuthSession(nextSession);
    // Update the authority before storage or host callbacks can re-enter us.
    state = {
      ...state, session,
      ...(bump ? { generation: state.generation + 1, authRevision: state.authRevision + 1 } : {}),
      needsRefresh: !!session.token && refresh,
      isSessionReady: !session.token || (!refresh && ready),
      isRefreshingSession: status === 'refreshing', sessionRefreshStatus: status,
      metadataRequired: false,
      windowAccess: access?.windowAccess ?? {}, capabilities: access?.capabilities ?? {},
      accessLoaded: access !== undefined,
    };
    try {
      if (clear) config.storage?.clear();
      else config.storage?.write(session);
    } finally {
      listeners.forEach((listener) => listener());
    }
    config.onSessionChange?.(session);
    return session;
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    configure(next) { config = next; },
    capture,
    isCurrent,
    publish,
    invalidate(patch = {}) {
      return publish({ generation: state.generation + 1, authRevision: state.authRevision + 1, ...patch });
    },
    replace,
    patch: (patch) => replace({ ...state.session, ...patch }),
    logout: () => replace({}, { clear: true }),
    activate() { active = true; },
    dispose() {
      active = false;
      state = { ...state, generation: state.generation + 1 };
    },
  };
}
