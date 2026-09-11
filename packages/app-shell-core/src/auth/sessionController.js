import { normalizeAuthSession, decodeJwtPayload } from './session.js';

const fingerprint = (session) => JSON.stringify(normalizeAuthSession(session));

/**
 * The stored session WITHOUT its bearer.
 *
 * `fingerprint` keeps the token, so comparing `storage` is comparing the token by another name.
 * An identity check that excluded `token` but kept `storage` would therefore be indistinguishable
 * from `isCurrent` in the only configuration the real app runs in (storage configured) — the
 * exclusion would buy nothing. See {@link createSessionController}'s `isSameIdentity`.
 */
const identityFingerprint = (session) => {
  const { token, ...identity } = normalizeAuthSession(session);
  return JSON.stringify(identity);
};

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
  const readStorageIdentity = () => {
    try { return identityFingerprint(config.storage?.read()); } catch { return null; }
  };
  const capture = () => {
    const claims = decodeJwtPayload(state.session.token);
    return {
      owner, generation: state.generation, storage: readStorage(),
      storageIdentity: readStorageIdentity(),
      token: state.session.token,
      userId: claims?.user ?? null,
      clientId: claims?.client ?? null,
      sessionClientId: state.session.clientId,
      apiBaseUrl: config.apiBaseUrl ?? null,
    };
  };
  // Everything that makes this a DIFFERENT session, deliberately WITHOUT the token: a silent
  // rotation (`bump: false`) replaces the bearer while the user, client, role and storage stay
  // exactly as they were.
  const IDENTITY_KEYS = ['storageIdentity', 'userId', 'clientId', 'sessionClientId', 'apiBaseUrl'];

  const matches = (snapshot, keys) => {
    if (!active || snapshot?.owner !== owner || snapshot.generation !== state.generation) return false;
    const current = capture();
    return keys.every((key) => snapshot[key] === current[key]);
  };

  const isCurrent = (snapshot) => matches(snapshot, [...IDENTITY_KEYS, 'storage', 'token']);

  /**
   * Same session, token comparison excluded (ETP-5255 x ETP-5195).
   *
   * `isCurrent` is the right question for work that has already LEFT the client: a request in
   * flight carries the old bearer, so once the token rotates its response is no longer ours and
   * must be abandoned.
   *
   * It is the wrong question for work that has not left yet. `createApiFetch` serialises writes
   * per record, so a queued write can wait an arbitrary time behind the one ahead of it — and a
   * rotation during that wait is routine, not a session change. Failing it as superseded would
   * silently drop a save the user made, in exactly the two-writers-on-one-row flow the
   * serialisation exists to protect. Such a write is re-armed with the fresh bearer instead,
   * and only a real identity change (logout, another user, another client, another base URL)
   * still abandons it.
   */
  const isSameIdentity = (snapshot) => matches(snapshot, IDENTITY_KEYS);

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
    isSameIdentity,
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
