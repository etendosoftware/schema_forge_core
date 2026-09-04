/**
 * Per-user record of which guided tutorials have been taken (ETP-5144).
 *
 * Window-agnostic like the rest of this directory: it stores and classifies
 * whatever flow ids it is handed and never learns what a flow teaches. It
 * knows nothing about analytics either -- reporting is the host's job, and
 * `recordFlowFinish` hands it a plain descriptor to report.
 *
 * One key, defaults frozen, every storage access wrapped so a browser with
 * storage disabled (or a full quota) degrades to "nothing was ever taken"
 * instead of breaking the topbar.
 *
 * KNOWN LIMIT: `localStorage` is per-browser-origin, NOT per-account. Moving to
 * another machine makes every tutorial look new again. Namespacing by username
 * (below) only stops two users of the SAME browser from inheriting each other's
 * progress; carrying it across devices needs a backend-held user preference,
 * with this module demoted to a cache.
 */
import { createLocalAuthStorage } from '../auth/session.js';

const STORAGE_KEY = 'sf_walkthrough_v1';

/** Bucket for progress recorded before anyone logged in. */
const ANONYMOUS_USER = '__anonymous__';

/** What a launcher may show next to a flow. */
export const FLOW_STATUS = Object.freeze({
  /** Never started. */
  UNSEEN: 'unseen',
  /** Started at least once, never finished. */
  IN_PROGRESS: 'in-progress',
  /** Finished, but the flow has been revised since. */
  UPDATED: 'updated',
  /** Finished at the flow's current revision. */
  COMPLETED: 'completed',
});

const DEFAULT_FLOW_RECORD = Object.freeze({
  starts: 0,
  completions: 0,
  firstStartedAt: null,
  lastStartedAt: null,
  completedAt: null,
  /** Revision that was completed, so a later bump can surface as `updated`. */
  completedRevision: 0,
  /** Step the last abandoned run was sitting on, for the drop-off report. */
  lastAbandonedStep: null,
});

function getStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Progress is filed per user so two people sharing a browser do not inherit
 * each other's badges.
 *
 * `auth/session.js` owns the storage key the username lives under, so this
 * never spells it out. The factory is called per read on purpose: it resolves
 * `window.localStorage` at call time, so a host (or a test) that swaps storage
 * is picked up instead of being captured once at module load.
 */
function currentUsername() {
  try {
    return createLocalAuthStorage().read()?.username || ANONYMOUS_USER;
  } catch {
    return ANONYMOUS_USER;
  }
}

function readAll() {
  try {
    const raw = getStorage()?.getItem(STORAGE_KEY);
    if (!raw) return { users: {} };
    const parsed = JSON.parse(raw);
    return { users: {}, ...parsed };
  } catch {
    // Unparseable payload (hand-edited, or written by an older shape): start
    // over rather than throwing on every render.
    return { users: {} };
  }
}

function writeAll(next) {
  try {
    getStorage()?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable or full -- progress is a nicety, never a blocker.
  }
}

/** This user's flow records, defaults filled in. Never returns null. */
export function readProgress(username = currentUsername()) {
  const stored = readAll().users?.[username]?.flows;
  return { flows: stored && typeof stored === 'object' ? stored : {} };
}

/** One flow's record with every default present. */
export function readFlowRecord(flowId, username = currentUsername()) {
  return { ...DEFAULT_FLOW_RECORD, ...(readProgress(username).flows[flowId] ?? {}) };
}

/**
 * Applies `mutate` to one flow's record and persists it.
 * @returns {object} the record as written.
 */
function updateFlow(flowId, mutate, username = currentUsername()) {
  if (!flowId) return { ...DEFAULT_FLOW_RECORD };
  const all = readAll();
  const users = all.users ?? {};
  const flows = users[username]?.flows ?? {};
  const record = { ...DEFAULT_FLOW_RECORD, ...(flows[flowId] ?? {}) };
  const next = { ...record, ...mutate(record) };

  writeAll({
    ...all,
    users: { ...users, [username]: { ...users[username], flows: { ...flows, [flowId]: next } } },
  });
  return next;
}

/**
 * Which badge a flow deserves.
 *
 * Precedence note: an unfinished run outranks a revision bump. Someone who
 * walked away at step 6 gets `in-progress` even if the flow has been revised
 * since -- they never finished it, and "half done" is the more useful of the
 * two truths.
 *
 * @param {string} flowId
 * @param {number} revision the flow's CURRENT revision (from the flow data)
 */
export function getFlowStatus(flowId, revision = 1, username = currentUsername()) {
  const record = readFlowRecord(flowId, username);
  if (!record.completedAt) {
    return record.starts > 0 ? FLOW_STATUS.IN_PROGRESS : FLOW_STATUS.UNSEEN;
  }
  return record.completedRevision >= revision ? FLOW_STATUS.COMPLETED : FLOW_STATUS.UPDATED;
}

/**
 * True for a tutorial the user has not finished at its current revision --
 * `unseen`, `in-progress` and `updated` alike. Only `completed` is done.
 */
export function isPendingStatus(status) {
  return status !== FLOW_STATUS.COMPLETED;
}

/**
 * How many of `flows` are still unfinished -- i.e. what the dot on the
 * tutorials button counts.
 *
 * Opening the launcher does NOT clear this. An earlier design dismissed the dot
 * once the list had been seen; it was dropped because "you still have unfinished
 * tutorials" does not stop being true just because the user glanced at the menu,
 * and a dot that vanishes on the first open is a reminder that reminds once.
 * A tour left half-way therefore keeps the dot lit, same as one never started.
 *
 * @param {{id: string, revision?: number}[]} flows
 */
export function countPendingFlows(flows, username = currentUsername()) {
  return (flows ?? []).filter(
    (flow) => isPendingStatus(getFlowStatus(flow?.id, flow?.revision ?? 1, username)),
  ).length;
}

/** Records a run starting. Returns the updated record. */
export function markFlowStarted(flowId, now = Date.now(), username = currentUsername()) {
  const startedAt = new Date(now).toISOString();
  return updateFlow(flowId, (record) => ({
    starts: record.starts + 1,
    firstStartedAt: record.firstStartedAt ?? startedAt,
    lastStartedAt: startedAt,
  }), username);
}

/**
 * Records a run reaching the end.
 * @param {number} revision the revision that was completed
 */
export function markFlowCompleted(flowId, revision = 1, now = Date.now(), username = currentUsername()) {
  return updateFlow(flowId, (record) => ({
    completions: record.completions + 1,
    completedAt: new Date(now).toISOString(),
    // `max` so replaying an OLD revision cannot demote a user who already
    // completed a newer one back to `updated`.
    completedRevision: Math.max(record.completedRevision, revision),
    lastAbandonedStep: null,
  }), username);
}

/** Records a run ending early, keeping the step it died on. */
export function markFlowAbandoned(flowId, stepId = null, username = currentUsername()) {
  return updateFlow(flowId, () => ({ lastAbandonedStep: stepId ?? null }), username);
}

/** Outcome of a finished run, as reported to the host. */
export const FINISH_STATUS = Object.freeze({
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
});

/**
 * Persists the outcome of a run AND describes it for the host to report.
 *
 * One function rather than two because the two must agree on the same run: the
 * start timestamp has to be read BEFORE completion rewrites the record, so a
 * host that reported first and persisted second would measure the wrong
 * duration (or none).
 *
 * Feed it the engine's `onFinish` payload verbatim. Every field of the returned
 * descriptor is plain data -- no event names, no analytics vocabulary -- so the
 * host maps it onto whatever telemetry contract it owns.
 *
 * @param {{flowId: string, completed: boolean, stepId?: string|null,
 *          stepIndex?: number, totalSteps?: number}} info
 * @param {{id: string, revision?: number}[]} flows the flows given to the provider
 * @returns {{flowId: string, status: string, stepId: string|null,
 *            stepIndex: number|undefined, totalSteps: number|undefined,
 *            durationMs: number|undefined}|null} null for a payload with no flow
 */
export function recordFlowFinish(info, flows, now = Date.now(), username = currentUsername()) {
  const { flowId, completed, stepId = null, stepIndex, totalSteps } = info ?? {};
  if (!flowId) return null;

  const revision = (flows ?? []).find((flow) => flow?.id === flowId)?.revision ?? 1;
  // Read the start BEFORE writing, since completing rewrites the record. A run
  // whose start was never recorded (storage disabled) reports no duration at
  // all rather than a bogus one.
  const startedAt = Date.parse(readFlowRecord(flowId, username).lastStartedAt ?? '');
  const durationMs = Number.isFinite(startedAt) ? now - startedAt : undefined;

  if (completed) {
    markFlowCompleted(flowId, revision, now, username);
  } else {
    markFlowAbandoned(flowId, stepId, username);
  }

  return {
    flowId,
    status: completed ? FINISH_STATUS.COMPLETED : FINISH_STATUS.ABANDONED,
    // Where the run ended. On an abandoned run this is the step the user walked
    // away from -- the only datum that says WHERE a tour loses people.
    stepId,
    stepIndex,
    totalSteps,
    durationMs,
  };
}

/** Test/support seam: forget everything this user has taken. */
export function resetProgress(username = currentUsername()) {
  const all = readAll();
  const users = { ...(all.users ?? {}) };
  delete users[username];
  writeAll({ ...all, users });
}

export const WALKTHROUGH_PROGRESS_STORAGE_KEY = STORAGE_KEY;
