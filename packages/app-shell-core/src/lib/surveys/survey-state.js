/**
 * Survey state persistence — storage, dismissal and monthly-cap machinery.
 *
 * This module deliberately knows NO survey ids and NO counter names. Which survey
 * is the onboarding one, and which counter a given survey snapshots, are supplied
 * by the caller: they are product decisions belonging to the app that defines the
 * surveys, not to the shared runtime. Everything here works for any survey set.
 */
const STORAGE_KEY = 'sf_survey_v1';

const DEFAULTS = Object.freeze({
  firstLoginAt: null,
  lastLoginAt: null,
  lastShownAt: null,
  lastDismissedAt: null,
  onboardingCompleted: false,
  onboardingShown: false,
  // Counters start empty: the key set is whatever the app increments. Every read
  // of a counter — here and in callers — is `?? 0` guarded, so an absent key and a
  // key seeded to 0 are indistinguishable.
  counters: Object.freeze({}),
  shownThisMonth: Object.freeze({}),
  respondedCounts: Object.freeze({}),
  respondedAt: Object.freeze({}),
  respondedCountAt: Object.freeze({}),
  dismissals: Object.freeze({}),
});

function getStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readSurveyState() {
  try {
    const raw = getStorage()?.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS, counters: { ...DEFAULTS.counters }, shownThisMonth: {}, respondedCounts: {}, respondedAt: {}, respondedCountAt: {}, dismissals: {} };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULTS,
      counters: { ...DEFAULTS.counters },
      shownThisMonth: {},
      respondedCounts: {},
      respondedAt: {},
      respondedCountAt: {},
      dismissals: {},
      ...parsed,
    };
  } catch {
    return { ...DEFAULTS, counters: { ...DEFAULTS.counters }, shownThisMonth: {}, respondedCounts: {}, respondedAt: {}, respondedCountAt: {}, dismissals: {} };
  }
}

export function writeSurveyState(next) {
  try {
    getStorage()?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — fail silently
  }
}

export function markFirstLogin(now = Date.now()) {
  const state = readSurveyState();
  writeSurveyState({
    ...state,
    firstLoginAt: state.firstLoginAt ?? new Date(now).toISOString(),
    lastLoginAt: new Date(now).toISOString(),
  });
}

export function markOnboardingCompleted() {
  const state = readSurveyState();
  writeSurveyState({ ...state, onboardingCompleted: true });
}

/**
 * @param {string}  surveyId
 * @param {number}  [now]
 * @param {object}  [opts]
 * @param {boolean} [opts.isOnboarding] Whether THIS survey is the app's onboarding
 *   survey. The caller decides — the shared runtime has no way to know which id
 *   that is, and no business guessing.
 */
export function markSurveyShown(surveyId, now = Date.now(), { isOnboarding = false } = {}) {
  const state = readSurveyState();
  const monthKey = new Date(now).toISOString().slice(0, 7);
  writeSurveyState({
    ...state,
    lastShownAt: new Date(now).toISOString(),
    onboardingShown: isOnboarding ? true : state.onboardingShown,
    shownThisMonth: {
      ...state.shownThisMonth,
      [monthKey]: (state.shownThisMonth[monthKey] ?? 0) + 1,
    },
  });
}

/**
 * @param {string}  surveyId
 * @param {number}  [now]
 * @param {object}  [opts]
 * @param {?string} [opts.counterKey] Which counter to snapshot into
 *   `respondedCountAt[surveyId]` — the "how many of these had the user done when
 *   they last answered" reading that re-ask cadence is based on. Omit for surveys
 *   that track no counter; nothing is recorded then, which is what surveys with no
 *   counter did before this was an input.
 */
export function markSurveyResponded(surveyId, now = Date.now(), { counterKey = null } = {}) {
  const state = readSurveyState();
  writeSurveyState({
    ...state,
    respondedCounts: {
      ...state.respondedCounts,
      [surveyId]: (state.respondedCounts[surveyId] ?? 0) + 1,
    },
    respondedAt: {
      ...state.respondedAt,
      [surveyId]: new Date(now).toISOString(),
    },
    respondedCountAt: {
      ...state.respondedCountAt,
      ...(counterKey ? { [surveyId]: state.counters[counterKey] ?? 0 } : {}),
    },
  });
}

export function markSurveyDismissed(surveyId, now = Date.now()) {
  const state = readSurveyState();
  writeSurveyState({
    ...state,
    lastDismissedAt: new Date(now).toISOString(),
    dismissals: {
      ...state.dismissals,
      [surveyId]: new Date(now).toISOString(),
    },
  });
}

export function incrementSurveyCounter(key, now = Date.now()) {
  const state = readSurveyState();
  const counters = { ...state.counters, [key]: (state.counters[key] ?? 0) + 1 };
  writeSurveyState({ ...state, counters });
  return counters[key];
}
