import * as React from 'react';

/**
 * CurrentWindowContext — tracks which window/tab is currently active in the UI
 * so that the Copilot widget can auto-attach its context when opened.
 *
 * Shape of `current`:
 *   null  -> no window route is active (dashboard, onboarding, etc.)
 *   {
 *     spec:            string,        // kebab-case window slug
 *     tabTitle:        string,
 *     selectedRecords: object[],      // filtered to string/number/boolean fields
 *     formValues:      object | null, // filtered; only when isFormEditing
 *     isFormEditing:   boolean,
 *   }
 */
const CurrentWindowContext = React.createContext(null);

/**
 * Keep only string / number / boolean fields. Mirrors the legacy SmartClient
 * toolbar button behavior — nested objects, arrays, null, dates are dropped.
 */
function filterPrimitive(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[key] = value;
    }
  }
  return out;
}

function filterRecords(records) {
  if (!Array.isArray(records)) return [];
  return records.map(filterPrimitive);
}

export function CurrentWindowProvider({ children }) {
  const [current, setCurrent] = React.useState(null);

  const register = React.useCallback((info) => {
    if (!info || !info.spec) {
      setCurrent(null);
      return;
    }
    setCurrent({
      spec: info.spec,
      tabTitle: info.tabTitle || info.spec,
      selectedRecords: filterRecords(info.selectedRecords),
      formValues: info.isFormEditing ? filterPrimitive(info.formValues) : null,
      isFormEditing: Boolean(info.isFormEditing),
    });
  }, []);

  const clear = React.useCallback(() => setCurrent(null), []);

  const value = React.useMemo(
    () => ({ current, register, clear }),
    [current, register, clear],
  );

  return (
    <CurrentWindowContext.Provider value={value}>
      {children}
    </CurrentWindowContext.Provider>
  );
}

export function useCurrentWindowContext() {
  const ctx = React.useContext(CurrentWindowContext);
  if (!ctx) {
    // Tolerate usage outside the provider (e.g. preview mode) — return a no-op.
    return { current: null, register: () => {}, clear: () => {} };
  }
  return ctx;
}

/**
 * Register this component's window info while mounted. Clears on unmount.
 * Uses stable JSON serialization to avoid re-register loops when callers pass
 * fresh object references on every render.
 */
export function useRegisterWindowContext(info) {
  const { register, clear } = useCurrentWindowContext();

  // Stable signature based on the payload content, not identity.
  const signature = React.useMemo(() => {
    try {
      return JSON.stringify(info);
    } catch {
      return null;
    }
  }, [info]);

  React.useEffect(() => {
    register(info);
    return () => {
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
