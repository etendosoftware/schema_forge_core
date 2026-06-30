import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readSurveyState,
  writeSurveyState,
  markFirstLogin,
  markOnboardingCompleted,
  markSurveyShown,
  markSurveyResponded,
  markSurveyDismissed,
  incrementSurveyCounter,
} from '../survey-state.js';

const STORAGE_KEY = 'sf_survey_v1';

function makeStorage() {
  const store = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  };
}

describe('survey-state', () => {
  let mockStorage;
  const NOW = new Date('2026-01-15T10:00:00.000Z').getTime();

  beforeEach(() => {
    mockStorage = makeStorage();
    vi.stubGlobal('window', { localStorage: mockStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('readSurveyState', () => {
    it('returns defaults when storage is empty', () => {
      const state = readSurveyState();
      expect(state.firstLoginAt).toBeNull();
      expect(state.lastLoginAt).toBeNull();
      expect(state.onboardingCompleted).toBe(false);
      expect(state.onboardingShown).toBe(false);
      expect(state.counters).toEqual({ invoicing: 0, order: 0 });
      expect(state.shownThisMonth).toEqual({});
      expect(state.respondedCounts).toEqual({});
      expect(state.respondedAt).toEqual({});
      expect(state.dismissals).toEqual({});
    });

    it('merges stored data with defaults', () => {
      mockStorage.setItem(STORAGE_KEY, JSON.stringify({
        firstLoginAt: '2026-01-01T00:00:00.000Z',
        onboardingCompleted: true,
        counters: { invoicing: 3, order: 0 },
      }));
      const state = readSurveyState();
      expect(state.firstLoginAt).toBe('2026-01-01T00:00:00.000Z');
      expect(state.onboardingCompleted).toBe(true);
      expect(state.counters.invoicing).toBe(3);
      expect(state.shownThisMonth).toEqual({});
    });

    it('returns defaults on corrupted JSON', () => {
      mockStorage.setItem(STORAGE_KEY, 'not-json');
      const state = readSurveyState();
      expect(state.firstLoginAt).toBeNull();
    });
  });

  describe('markFirstLogin', () => {
    it('sets firstLoginAt and lastLoginAt on first call', () => {
      markFirstLogin(NOW);
      const state = readSurveyState();
      expect(state.firstLoginAt).toBe(new Date(NOW).toISOString());
      expect(state.lastLoginAt).toBe(new Date(NOW).toISOString());
    });

    it('does not overwrite firstLoginAt but updates lastLoginAt', () => {
      const earlier = new Date('2025-06-01').getTime();
      markFirstLogin(earlier);
      markFirstLogin(NOW);
      const state = readSurveyState();
      expect(state.firstLoginAt).toBe(new Date(earlier).toISOString());
      expect(state.lastLoginAt).toBe(new Date(NOW).toISOString());
    });
  });

  describe('markOnboardingCompleted', () => {
    it('sets onboardingCompleted to true', () => {
      markOnboardingCompleted();
      expect(readSurveyState().onboardingCompleted).toBe(true);
    });
  });

  describe('markSurveyShown', () => {
    it('updates lastShownAt and increments monthly counter', () => {
      markSurveyShown('nps', NOW);
      const state = readSurveyState();
      expect(state.lastShownAt).toBe(new Date(NOW).toISOString());
      expect(state.shownThisMonth['2026-01']).toBe(1);
    });

    it('sets onboardingShown when surveyId is csat_onboarding', () => {
      markSurveyShown('csat_onboarding', NOW);
      expect(readSurveyState().onboardingShown).toBe(true);
    });

    it('does not set onboardingShown for other surveys', () => {
      markSurveyShown('nps', NOW);
      expect(readSurveyState().onboardingShown).toBe(false);
    });
  });

  describe('markSurveyResponded', () => {
    it('increments respondedCounts and sets respondedAt', () => {
      markSurveyResponded('nps', NOW);
      const state = readSurveyState();
      expect(state.respondedCounts['nps']).toBe(1);
      expect(state.respondedAt['nps']).toBe(new Date(NOW).toISOString());
    });

    it('accumulates multiple responses', () => {
      markSurveyResponded('nps', NOW);
      markSurveyResponded('nps', NOW + 1000);
      expect(readSurveyState().respondedCounts['nps']).toBe(2);
    });
  });

  describe('markSurveyDismissed', () => {
    it('sets dismissal timestamp for the survey', () => {
      markSurveyDismissed('csat_invoicing', NOW);
      const state = readSurveyState();
      expect(state.lastDismissedAt).toBe(new Date(NOW).toISOString());
      expect(state.dismissals['csat_invoicing']).toBe(new Date(NOW).toISOString());
    });
  });

  describe('incrementSurveyCounter', () => {
    it('increments from zero', () => {
      const result = incrementSurveyCounter('invoicing');
      expect(result).toBe(1);
      expect(readSurveyState().counters.invoicing).toBe(1);
    });

    it('increments existing value', () => {
      incrementSurveyCounter('invoicing');
      incrementSurveyCounter('invoicing');
      const result = incrementSurveyCounter('invoicing');
      expect(result).toBe(3);
    });

    it('increments order independently from invoicing', () => {
      incrementSurveyCounter('invoicing');
      incrementSurveyCounter('invoicing');
      incrementSurveyCounter('order');
      const state = readSurveyState();
      expect(state.counters.invoicing).toBe(2);
      expect(state.counters.order).toBe(1);
    });
  });
});
