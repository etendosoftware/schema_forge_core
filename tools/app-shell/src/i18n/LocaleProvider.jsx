import React, { createContext, useContext, useMemo } from 'react';

const LocaleContext = createContext(null);

// Import all locale files statically (Vite handles JSON imports)
const localeModules = import.meta.glob('../locales/*.json', { eager: true });

/**
 * Provides locale dictionary to the component tree via React context.
 * Accepts a locale prop (e.g., "en_US") and resolves the matching JSON file.
 * Optionally accepts setLocale callback for locale switching.
 */
export function LocaleProvider({ locale = 'en_US', setLocale, children }) {
  const dictionary = useMemo(() => {
    const key = `../locales/${locale}.json`;
    return localeModules[key]?.default ?? localeModules[key] ?? {};
  }, [locale]);

  const value = useMemo(() => ({
    dictionary,
    locale,
    setLocale: setLocale || null,
  }), [dictionary, locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

/**
 * Returns the raw locale dictionary from context.
 * For backward compatibility, returns just the dictionary object.
 */
export function useLocale() {
  const ctx = useContext(LocaleContext);
  // Backward compat: if context is the old shape (plain dict), return it as-is
  if (ctx && ctx.dictionary) return ctx.dictionary;
  return ctx;
}

/**
 * Returns { locale, setLocale } for components that need to switch locales.
 */
export function useLocaleSwitch() {
  const ctx = useContext(LocaleContext);
  return { locale: ctx?.locale ?? 'en_US', setLocale: ctx?.setLocale ?? null };
}
