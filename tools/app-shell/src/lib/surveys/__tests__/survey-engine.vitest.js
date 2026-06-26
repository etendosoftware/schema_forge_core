import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isGlobalCooldownActive,
  isMonthlyLimitReached,
  isDismissedCooldownActive,
  selectNextSurvey,
} from '../survey-engine.js';

const MS_DAY = 86_400_000;
const NOW = new Date('2026-06-26T12:00:00.000Z').getTime();

function makeState(overrides = {}) {
  return {
    firstLoginAt: null,
    lastShownAt: null,
    lastDismissedAt: null,
    onboardingCompleted: false,
    onboardingShown: false,
    counters: { invoicing: 0, po: 0 },
    shownThisMonth: {},
    respondedCounts: {},
    respondedAt: {},
    dismissals: {},
    ...overrides,
  };
}

function isoAgo(ms, from = NOW) {
  return new Date(from - ms).toISOString();
}

describe('isGlobalCooldownActive', () => {
  it('returns false when never shown', () => {
    expect(isGlobalCooldownActive(makeState(), NOW)).toBe(false);
  });

  it('returns true within 30 days of last shown', () => {
    const state = makeState({ lastShownAt: isoAgo(15 * MS_DAY) });
    expect(isGlobalCooldownActive(state, NOW)).toBe(true);
  });

  it('returns false after 30 days', () => {
    const state = makeState({ lastShownAt: isoAgo(31 * MS_DAY) });
    expect(isGlobalCooldownActive(state, NOW)).toBe(false);
  });
});

describe('isMonthlyLimitReached', () => {
  it('returns false when no surveys shown this month', () => {
    expect(isMonthlyLimitReached(makeState(), NOW)).toBe(false);
  });

  it('returns false with 1 shown', () => {
    const state = makeState({ shownThisMonth: { '2026-06': 1 } });
    expect(isMonthlyLimitReached(state, NOW)).toBe(false);
  });

  it('returns true at 2 shown', () => {
    const state = makeState({ shownThisMonth: { '2026-06': 2 } });
    expect(isMonthlyLimitReached(state, NOW)).toBe(true);
  });

  it('ignores counts from other months', () => {
    const state = makeState({ shownThisMonth: { '2026-05': 5 } });
    expect(isMonthlyLimitReached(state, NOW)).toBe(false);
  });
});

describe('isDismissedCooldownActive', () => {
  it('returns false when never dismissed', () => {
    expect(isDismissedCooldownActive(makeState(), 'nps', NOW)).toBe(false);
  });

  it('returns true within 21 days of dismissal', () => {
    const state = makeState({ dismissals: { nps: isoAgo(10 * MS_DAY) } });
    expect(isDismissedCooldownActive(state, 'nps', NOW)).toBe(true);
  });

  it('returns false after 21 days', () => {
    const state = makeState({ dismissals: { nps: isoAgo(22 * MS_DAY) } });
    expect(isDismissedCooldownActive(state, 'nps', NOW)).toBe(false);
  });

  it('does not affect other survey ids', () => {
    const state = makeState({ dismissals: { nps: isoAgo(5 * MS_DAY) } });
    expect(isDismissedCooldownActive(state, 'csat_invoicing', NOW)).toBe(false);
  });
});

describe('selectNextSurvey', () => {
  let mockStorage;
  const STORAGE_KEY = 'sf_survey_v1';

  beforeEach(() => {
    mockStorage = (() => {
      const store = {};
      return {
        getItem: (k) => store[k] ?? null,
        setItem: (k, v) => { store[k] = v; },
        removeItem: (k) => { delete store[k]; },
      };
    })();
    vi.stubGlobal('window', { localStorage: mockStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when no survey is due', () => {
    expect(selectNextSurvey({ isAdmin: false, now: NOW })).toBeNull();
  });

  it('returns csat_onboarding for admin with onboarding completed', () => {
    mockStorage.setItem(STORAGE_KEY, JSON.stringify({
      onboardingCompleted: true,
      onboardingShown: false,
      counters: { invoicing: 0, po: 0 },
    }));
    const survey = selectNextSurvey({ isAdmin: true, now: NOW });
    expect(survey?.id).toBe('csat_onboarding');
  });

  it('does not return csat_onboarding when already shown', () => {
    mockStorage.setItem(STORAGE_KEY, JSON.stringify({
      onboardingCompleted: true,
      onboardingShown: true,
      counters: { invoicing: 0, po: 0 },
    }));
    expect(selectNextSurvey({ isAdmin: true, now: NOW })).toBeNull();
  });

  it('returns nps after 60 days for first-time user', () => {
    mockStorage.setItem(STORAGE_KEY, JSON.stringify({
      firstLoginAt: new Date(NOW - 61 * MS_DAY).toISOString(),
      counters: { invoicing: 0, po: 0 },
    }));
    const survey = selectNextSurvey({ isAdmin: false, now: NOW });
    expect(survey?.id).toBe('nps');
  });

  it('does not return nps before 60 days', () => {
    mockStorage.setItem(STORAGE_KEY, JSON.stringify({
      firstLoginAt: new Date(NOW - 30 * MS_DAY).toISOString(),
      counters: { invoicing: 0, po: 0 },
    }));
    expect(selectNextSurvey({ isAdmin: false, now: NOW })).toBeNull();
  });

  it('returns csat_invoicing at 5th invoice for standard user', () => {
    mockStorage.setItem(STORAGE_KEY, JSON.stringify({
      counters: { invoicing: 5, po: 0 },
    }));
    const survey = selectNextSurvey({ isAdmin: false, now: NOW });
    expect(survey?.id).toBe('csat_invoicing');
  });

  it('does not return csat_invoicing for admin users', () => {
    mockStorage.setItem(STORAGE_KEY, JSON.stringify({
      counters: { invoicing: 10, po: 0 },
    }));
    expect(selectNextSurvey({ isAdmin: true, now: NOW })).toBeNull();
  });

  it('returns csat_po at 5th PO for standard user', () => {
    mockStorage.setItem(STORAGE_KEY, JSON.stringify({
      counters: { invoicing: 0, po: 5 },
    }));
    const survey = selectNextSurvey({ isAdmin: false, now: NOW });
    expect(survey?.id).toBe('csat_po');
  });

  it('returns null when global cooldown is active', () => {
    mockStorage.setItem(STORAGE_KEY, JSON.stringify({
      firstLoginAt: new Date(NOW - 61 * MS_DAY).toISOString(),
      lastShownAt: new Date(NOW - 5 * MS_DAY).toISOString(),
      counters: { invoicing: 0, po: 0 },
    }));
    expect(selectNextSurvey({ isAdmin: false, now: NOW })).toBeNull();
  });

  it('returns null when monthly limit (2) is reached', () => {
    mockStorage.setItem(STORAGE_KEY, JSON.stringify({
      firstLoginAt: new Date(NOW - 61 * MS_DAY).toISOString(),
      shownThisMonth: { '2026-06': 2 },
      counters: { invoicing: 0, po: 0 },
    }));
    expect(selectNextSurvey({ isAdmin: false, now: NOW })).toBeNull();
  });
});
