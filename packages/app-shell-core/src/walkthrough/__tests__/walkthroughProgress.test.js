/**
 * Contract of the per-user walkthrough progress store (ETP-5144).
 *
 * The invariants pinned here are the ones the functional repo's
 * `docs/walkthrough-flows.md` §11 states and that a careless refactor would
 * silently break: the dot counts anything UNFINISHED (`unseen`, `in-progress`
 * and `updated` alike — only `completed` is done); an unfinished run outranks a
 * revision bump; replaying an old revision must not demote a user who already
 * completed a newer one; and every storage access degrades to "nothing was ever
 * taken" instead of throwing.
 *
 * `node:test`, not vitest: the module reads `window.localStorage` lazily (via
 * `auth/session.js` for the username), so a stub installed on `globalThis`
 * before the import is enough — no jsdom needed.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/** Map-backed stand-in for `window.localStorage`. */
function createStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
    get size() { return map.size; },
  };
}

globalThis.window = { localStorage: createStorage() };

const {
  FINISH_STATUS,
  FLOW_STATUS,
  WALKTHROUGH_PROGRESS_STORAGE_KEY,
  countPendingFlows,
  getFlowStatus,
  isPendingStatus,
  markFlowAbandoned,
  markFlowCompleted,
  markFlowStarted,
  readFlowRecord,
  recordFlowFinish,
  readProgress,
  resetProgress,
} = await import('../walkthroughProgress.js');

const USERNAME_KEY = 'sf_auth_user';
const USER = 'valentin';

/** The three shipped flows, at revision 1. */
const FLOWS_V1 = [
  { id: 'create-contact', revision: 1 },
  { id: 'create-product', revision: 1 },
  { id: 'create-sales-order', revision: 1 },
];

function useStorage(storage) {
  globalThis.window.localStorage = storage;
  return storage;
}

beforeEach(() => {
  const storage = useStorage(createStorage());
  storage.setItem(USERNAME_KEY, USER);
});

describe('walkthrough-progress — fresh state', () => {
  it('reports every flow as unseen and counts them all as pending', () => {
    for (const flow of FLOWS_V1) {
      assert.equal(getFlowStatus(flow.id, flow.revision), FLOW_STATUS.UNSEEN);
    }
    assert.equal(countPendingFlows(FLOWS_V1), FLOWS_V1.length);
  });

  it('returns a fully defaulted record for a flow that was never touched', () => {
    assert.deepEqual(readFlowRecord('create-contact'), {
      starts: 0,
      completions: 0,
      firstStartedAt: null,
      lastStartedAt: null,
      completedAt: null,
      completedRevision: 0,
      lastAbandonedStep: null,
    });
  });

  it('exposes the storage key it owns', () => {
    assert.equal(WALKTHROUGH_PROGRESS_STORAGE_KEY, 'sf_walkthrough_v1');
  });

  it('treats every unfinished status as pending — only completed is done', () => {
    assert.equal(isPendingStatus(FLOW_STATUS.UNSEEN), true);
    assert.equal(isPendingStatus(FLOW_STATUS.UPDATED), true);
    // A half-done tour keeps the dot lit: the reminder is about unfinished
    // work, so leaving one half-way does not resolve it.
    assert.equal(isPendingStatus(FLOW_STATUS.IN_PROGRESS), true);
    assert.equal(isPendingStatus(FLOW_STATUS.COMPLETED), false);
  });
});

describe('walkthrough-progress — starting a run', () => {
  it('moves the flow to in-progress and records the timestamps', () => {
    const record = markFlowStarted('create-contact', Date.parse('2026-09-04T10:00:00.000Z'));

    assert.equal(record.starts, 1);
    assert.equal(record.firstStartedAt, '2026-09-04T10:00:00.000Z');
    assert.equal(record.lastStartedAt, '2026-09-04T10:00:00.000Z');
    assert.equal(getFlowStatus('create-contact', 1), FLOW_STATUS.IN_PROGRESS);
  });

  it('keeps firstStartedAt from the first run while advancing lastStartedAt', () => {
    markFlowStarted('create-contact', Date.parse('2026-09-04T10:00:00.000Z'));
    const record = markFlowStarted('create-contact', Date.parse('2026-09-05T08:30:00.000Z'));

    assert.equal(record.starts, 2);
    assert.equal(record.firstStartedAt, '2026-09-04T10:00:00.000Z');
    assert.equal(record.lastStartedAt, '2026-09-05T08:30:00.000Z');
  });

  it('keeps counting that flow as pending — a half-done tour is still unfinished', () => {
    markFlowStarted('create-contact');

    assert.equal(countPendingFlows(FLOWS_V1), FLOWS_V1.length);
  });

  it('ignores a missing flow id instead of writing a junk record', () => {
    const record = markFlowStarted(undefined);

    assert.equal(record.starts, 0);
    assert.deepEqual(readProgress().flows, {});
  });
});

describe('walkthrough-progress — abandoning a run', () => {
  it('stores the step it died on and leaves the status at in-progress', () => {
    markFlowStarted('create-contact');
    const record = markFlowAbandoned('create-contact', 'address-city');

    assert.equal(record.lastAbandonedStep, 'address-city');
    assert.equal(getFlowStatus('create-contact', 1), FLOW_STATUS.IN_PROGRESS);
    assert.equal(readFlowRecord('create-contact').lastAbandonedStep, 'address-city');
  });

  it('normalizes a missing step to null', () => {
    markFlowStarted('create-contact');

    assert.equal(markFlowAbandoned('create-contact').lastAbandonedStep, null);
  });
});

describe('walkthrough-progress — completing a run', () => {
  it('moves the flow to completed and clears the abandoned step', () => {
    markFlowStarted('create-contact');
    markFlowAbandoned('create-contact', 'save');
    const record = markFlowCompleted('create-contact', 1, Date.parse('2026-09-04T11:00:00.000Z'));

    assert.equal(record.completions, 1);
    assert.equal(record.completedAt, '2026-09-04T11:00:00.000Z');
    assert.equal(record.completedRevision, 1);
    assert.equal(record.lastAbandonedStep, null);
    assert.equal(getFlowStatus('create-contact', 1), FLOW_STATUS.COMPLETED);
  });

  it('is the only thing that drops a flow out of the pending count', () => {
    markFlowCompleted('create-contact', 1);

    assert.equal(countPendingFlows(FLOWS_V1), FLOWS_V1.length - 1);
  });
});

describe('walkthrough-progress — revision bumps', () => {
  it('surfaces a completed flow as updated (and pending again) when its revision rises', () => {
    markFlowCompleted('create-contact', 1);

    assert.equal(getFlowStatus('create-contact', 2), FLOW_STATUS.UPDATED);
    assert.equal(
      countPendingFlows([{ id: 'create-contact', revision: 2 }]),
      1,
    );
  });

  it('an unfinished run outranks a revision bump — half done is the more useful truth', () => {
    markFlowStarted('create-contact');

    assert.equal(getFlowStatus('create-contact', 2), FLOW_STATUS.IN_PROGRESS);
    // ...and it stays pending either way, because it is still unfinished.
    assert.equal(countPendingFlows([{ id: 'create-contact', revision: 2 }]), 1);
  });

  it('replaying an OLD revision must not demote a user who completed a newer one', () => {
    markFlowCompleted('create-contact', 2);
    markFlowCompleted('create-contact', 1);

    assert.equal(readFlowRecord('create-contact').completedRevision, 2);
    assert.equal(getFlowStatus('create-contact', 2), FLOW_STATUS.COMPLETED);
  });

  it('defaults an undeclared revision to 1', () => {
    markFlowCompleted('create-contact');

    assert.equal(getFlowStatus('create-contact'), FLOW_STATUS.COMPLETED);
    assert.equal(countPendingFlows([{ id: 'create-contact' }]), 0);
  });
});

// An earlier design let opening the launcher dismiss the dot (an
// `acknowledgedRevision` per flow). It was dropped: "you have unfinished
// tutorials" does not stop being true because the user glanced at the menu, and
// a dot that clears on the first open is a reminder that reminds once. These
// pin that ONLY completion clears the count -- nothing about merely reading it.
describe('walkthrough-progress — nothing but completion clears the count', () => {
  it('counts a revised-but-completed flow and an untouched one alike', () => {
    markFlowCompleted('create-contact', 1);
    const revised = [{ id: 'create-contact', revision: 2 }, ...FLOWS_V1.slice(1)];

    assert.equal(countPendingFlows(revised), revised.length);
    assert.equal(getFlowStatus('create-contact', 2), FLOW_STATUS.UPDATED);
    assert.equal(getFlowStatus('create-product', 1), FLOW_STATUS.UNSEEN);
  });

  it('keeps no acknowledgement field on the record at all', () => {
    markFlowCompleted('create-contact', 1);

    assert.equal('acknowledgedRevision' in readFlowRecord('create-contact'), false);
  });

  it('clears the count only once every flow is completed at its revision', () => {
    const revised = [{ id: 'create-contact', revision: 2 }, ...FLOWS_V1.slice(1)];
    revised.forEach((flow) => markFlowCompleted(flow.id, flow.revision ?? 1));

    assert.equal(countPendingFlows(revised), 0);
  });

  it('tolerates a missing or empty flow list', () => {
    assert.equal(countPendingFlows(undefined), 0);
    assert.equal(countPendingFlows([]), 0);
  });
});

// `recordFlowFinish` is the half of the old functional `handleWalkthroughFinish`
// that is not about naming events: it persists a run's outcome and describes it
// for the host to report. The two are one function because they must agree on
// the same run -- the start timestamp has to be read BEFORE completion rewrites
// the record, so persisting after reporting would measure the wrong duration.
describe('walkthrough-progress — recordFlowFinish', () => {
  const FLOWS = [
    { id: 'create-contact', revision: 1 },
    { id: 'create-product', revision: 2 },
  ];

  it('persists a completion at the flow\'s OWN revision and reports it', () => {
    markFlowStarted('create-product');

    const report = recordFlowFinish(
      { flowId: 'create-product', completed: true, stepId: 'price-set', stepIndex: 10, totalSteps: 11 },
      FLOWS,
    );

    assert.equal(report.status, FINISH_STATUS.COMPLETED);
    assert.equal(report.flowId, 'create-product');
    assert.equal(report.stepId, 'price-set');
    assert.equal(report.stepIndex, 10);
    assert.equal(report.totalSteps, 11);
    // The flow declares revision 2, so completing it must record revision 2 --
    // otherwise the user is told about an "update" they just took.
    assert.equal(readFlowRecord('create-product').completedRevision, 2);
    assert.ok(readFlowRecord('create-product').completedAt);
    assert.equal(getFlowStatus('create-product', 2), FLOW_STATUS.COMPLETED);
  });

  it('stores the step an abandoned run walked away from', () => {
    markFlowStarted('create-contact');

    const report = recordFlowFinish(
      { flowId: 'create-contact', completed: false, stepId: 'address-city', stepIndex: 12, totalSteps: 15 },
      FLOWS,
    );

    assert.equal(report.status, FINISH_STATUS.ABANDONED);
    assert.equal(report.stepId, 'address-city');
    assert.equal(readFlowRecord('create-contact').completedAt, null);
    assert.equal(readFlowRecord('create-contact').lastAbandonedStep, 'address-city');
    // Still unfinished, so it still counts toward the dot.
    assert.equal(getFlowStatus('create-contact', 1), FLOW_STATUS.IN_PROGRESS);
  });

  it('measures the duration from the recorded start', () => {
    const startedAt = Date.parse('2026-09-04T10:00:00.000Z');
    markFlowStarted('create-contact', startedAt);

    const report = recordFlowFinish(
      { flowId: 'create-contact', completed: true },
      FLOWS,
      Date.parse('2026-09-04T10:04:12.000Z'),
    );

    assert.equal(report.durationMs, 252000);
  });

  it('reports NO duration when the start was never recorded, rather than a bogus one', () => {
    const report = recordFlowFinish({ flowId: 'create-contact', completed: true }, FLOWS);

    assert.equal(report.durationMs, undefined);
  });

  it('defaults a flow that is not in the list to revision 1 rather than throwing', () => {
    const report = recordFlowFinish({ flowId: 'not-in-list', completed: true }, FLOWS);

    assert.equal(report.flowId, 'not-in-list');
    assert.equal(readFlowRecord('not-in-list').completedRevision, 1);
  });

  it('returns null for a payload with no flow id, so the host reports nothing', () => {
    assert.equal(recordFlowFinish(undefined, FLOWS), null);
    assert.equal(recordFlowFinish({ completed: true }, FLOWS), null);
    assert.deepEqual(readProgress().flows, {});
  });
});

describe('walkthrough-progress — per-user isolation', () => {
  it('gives a different username a clean slate, and hands the first one its progress back', () => {
    markFlowCompleted('create-contact', 1);

    globalThis.window.localStorage.setItem(USERNAME_KEY, 'other-user');
    assert.equal(getFlowStatus('create-contact', 1), FLOW_STATUS.UNSEEN);
    assert.equal(countPendingFlows(FLOWS_V1), FLOWS_V1.length);

    globalThis.window.localStorage.setItem(USERNAME_KEY, USER);
    assert.equal(getFlowStatus('create-contact', 1), FLOW_STATUS.COMPLETED);
  });

  it('files progress under an anonymous bucket when nobody is logged in', () => {
    globalThis.window.localStorage.removeItem(USERNAME_KEY);
    markFlowCompleted('create-contact', 1);

    assert.equal(getFlowStatus('create-contact', 1, '__anonymous__'), FLOW_STATUS.COMPLETED);
    assert.equal(getFlowStatus('create-contact', 1, USER), FLOW_STATUS.UNSEEN);
  });

  it('resetProgress forgets only the current user', () => {
    markFlowCompleted('create-contact', 1);
    markFlowCompleted('create-contact', 1, Date.now(), 'other-user');

    resetProgress();

    assert.equal(getFlowStatus('create-contact', 1), FLOW_STATUS.UNSEEN);
    assert.equal(getFlowStatus('create-contact', 1, 'other-user'), FLOW_STATUS.COMPLETED);
  });
});

describe('walkthrough-progress — hostile storage', () => {
  it('degrades to "nothing was ever taken" when storage is unavailable', () => {
    useStorage(null);

    assert.doesNotThrow(() => markFlowStarted('create-contact'));
    assert.doesNotThrow(() => markFlowCompleted('create-contact', 1));
    assert.doesNotThrow(() => markFlowAbandoned('create-contact', 'category'));
    assert.doesNotThrow(() => resetProgress());
    assert.deepEqual(readProgress().flows, {});
    assert.equal(getFlowStatus('create-contact', 1), FLOW_STATUS.UNSEEN);
    assert.equal(countPendingFlows(FLOWS_V1), FLOWS_V1.length);
  });

  it('survives a getItem that throws (storage blocked by the browser)', () => {
    useStorage({
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => {},
      removeItem: () => {},
    });

    assert.deepEqual(readProgress().flows, {});
    assert.equal(getFlowStatus('create-contact', 1), FLOW_STATUS.UNSEEN);
    assert.doesNotThrow(() => markFlowStarted('create-contact'));
  });

  it('starts over on an unparseable payload instead of throwing on every render', () => {
    const storage = useStorage(createStorage());
    storage.setItem(USERNAME_KEY, USER);
    storage.setItem(WALKTHROUGH_PROGRESS_STORAGE_KEY, '{not json');

    assert.deepEqual(readProgress().flows, {});
    assert.equal(getFlowStatus('create-contact', 1), FLOW_STATUS.UNSEEN);
    // ...and a write recovers the key rather than compounding the corruption.
    markFlowCompleted('create-contact', 1);
    assert.equal(getFlowStatus('create-contact', 1), FLOW_STATUS.COMPLETED);
  });

  it('ignores a payload of the wrong shape', () => {
    const storage = useStorage(createStorage());
    storage.setItem(USERNAME_KEY, USER);
    storage.setItem(WALKTHROUGH_PROGRESS_STORAGE_KEY, JSON.stringify({ users: 'nope' }));

    assert.deepEqual(readProgress().flows, {});
    assert.equal(getFlowStatus('create-contact', 1), FLOW_STATUS.UNSEEN);
  });

  it('swallows a setItem that throws (quota exceeded) and keeps reporting unseen', () => {
    const reads = createStorage({ [USERNAME_KEY]: USER });
    useStorage({
      getItem: (key) => reads.getItem(key),
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: (key) => reads.removeItem(key),
    });

    assert.doesNotThrow(() => markFlowStarted('create-contact'));
    assert.doesNotThrow(() => markFlowCompleted('create-contact', 1));
    // The write was lost, so the dot keeps offering the tutorial. Progress is a
    // nicety, never a blocker.
    assert.equal(getFlowStatus('create-contact', 1), FLOW_STATUS.UNSEEN);
    assert.equal(countPendingFlows(FLOWS_V1), FLOWS_V1.length);
  });
});
