import { createContext, useContext } from 'react';

// No-op default: when no host injects real telemetry (e.g. tests, or core used
// standalone), calls are silently dropped. The functional host wraps its tree
// in <ObservabilityProvider value={...}> to inject the real domain wrapper.
const noop = () => {};
const defaultValue = {
  trackMcpConnectTabSelected: noop,
  // Guided walkthroughs (ETP-5144). The launcher and the finish handler
  // describe what happened in plain data; the host names the events. See
  // `walkthrough/WalkthroughLauncher.jsx` and `walkthrough/walkthroughProgress.js`.
  trackWalkthroughMenuOpened: noop,
  trackWalkthroughStarted: noop,
  trackWalkthroughFinished: noop,
  // Which tutorials users silence without taking them is a product signal, and
  // progress lives in `localStorage` -- so without this event "nobody cares
  // about tour X" is unobservable from outside the browser.
  trackWalkthroughDismissed: noop,
};

const ObservabilityContext = createContext(defaultValue);

export function ObservabilityProvider({ value, children }) {
  return (
    <ObservabilityContext.Provider value={value ?? defaultValue}>
      {children}
    </ObservabilityContext.Provider>
  );
}

export function useObservability() {
  return useContext(ObservabilityContext);
}
  