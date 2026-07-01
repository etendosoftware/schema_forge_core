import { useState, useCallback } from 'react';

const STORAGE_KEY = 'schema-forge-locale';
const DEFAULT_LOCALE = 'es_ES';

/**
 * Read the active locale outside of React (for non-hook code such as request
 * header builders). Mirrors the persistence used by {@link useLocaleState}.
 * Returns an Etendo language code like 'es_ES'.
 */
export function getStoredLocale() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Hook that manages the active locale with localStorage persistence.
 * Returns [locale, setLocale] similar to useState.
 *
 * On mount, reads from localStorage (falls back to 'es_ES').
 * On setLocale, writes to localStorage and updates state.
 */
export function useLocaleState() {
  const [locale, setLocaleRaw] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_LOCALE;
    } catch {
      return DEFAULT_LOCALE;
    }
  });

  const setLocale = useCallback((newLocale) => {
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // localStorage unavailable — state still updates in memory
    }
    setLocaleRaw(newLocale);
  }, []);

  return [locale, setLocale];
}
