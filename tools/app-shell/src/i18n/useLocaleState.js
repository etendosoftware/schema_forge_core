import { useState, useCallback } from 'react';

const STORAGE_KEY = 'schema-forge-locale';
const DEFAULT_LOCALE = 'en_US';

/**
 * Hook that manages the active locale with localStorage persistence.
 * Returns [locale, setLocale] similar to useState.
 *
 * On mount, reads from localStorage (falls back to 'en_US').
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
