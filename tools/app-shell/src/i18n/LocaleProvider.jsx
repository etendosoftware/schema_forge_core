import React, { createContext, useContext, useMemo } from 'react';

const LocaleContext = createContext(null);

// Import all locale files statically (Vite handles JSON imports)
const localeModules = import.meta.glob('../locales/*.json', { eager: true });

/**
 * Provides locale dictionary to the component tree via React context.
 * Accepts a locale prop (e.g., "en_US") and resolves the matching JSON file.
 */
export function LocaleProvider({ locale = 'en_US', children }) {
  const dictionary = useMemo(() => {
    const key = `../locales/${locale}.json`;
    return localeModules[key]?.default ?? localeModules[key] ?? {};
  }, [locale]);

  return (
    <LocaleContext.Provider value={dictionary}>
      {children}
    </LocaleContext.Provider>
  );
}

/**
 * Returns the raw locale dictionary from context.
 */
export function useLocale() {
  return useContext(LocaleContext);
}
