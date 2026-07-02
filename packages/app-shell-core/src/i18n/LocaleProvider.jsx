import React, { createContext, useContext, useMemo } from 'react';

const LocaleContext = createContext(null);

// Stable empty fallback — an inline `dictionaries = {}` default would create a
// new object on every LocaleProvider render, defeating the `[dictionaries, locale]`
// memo below and breaking the hook-stability guarantees in useUI/useLabel/useMenuLabel.
const EMPTY_DICTIONARIES = {};

/**
 * Provides locale dictionary to the component tree via React context.
 * Accepts a locale prop (e.g., "en_US") and a `dictionaries` map
 * (`{ [locale]: dictionaryObject }`) supplied by the host application —
 * app-shell-core does not bundle or load locale data itself, so any app
 * consuming this runtime owns its own translations.
 * Optionally accepts setLocale callback for locale switching.
 */
export function LocaleProvider({ locale = 'es_ES', setLocale, dictionaries = EMPTY_DICTIONARIES, children }) {
  const dictionary = useMemo(() => dictionaries[locale] ?? {}, [dictionaries, locale]);

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
  return { locale: ctx?.locale ?? 'es_ES', setLocale: ctx?.setLocale ?? null };
}
