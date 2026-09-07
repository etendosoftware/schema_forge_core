import { createContext, useContext, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { normalizeFlows } from './flowSchema.js';
import { useWalkthroughEngine } from './useWalkthroughEngine.js';
import { WalkthroughOverlay } from './WalkthroughOverlay.jsx';

/**
 * Inert default so a component that renders outside the provider (or in a unit
 * test that mounts it in isolation) can call `useWalkthrough()` without a
 * guard. `available: false` lets a launcher hide itself instead of rendering a
 * dead control.
 */
const INERT = Object.freeze({
  available: false,
  flows: [],
  isRunning: false,
  activeFlowId: null,
  start: () => false,
  stop: () => {},
});

const WalkthroughContext = createContext(INERT);

/**
 * Hosts the walkthrough engine and its overlay.
 *
 * Must be mounted INSIDE the router (it navigates on the user's behalf) and
 * inside the locale provider (every string it renders is locale-resolved).
 * Mount it once, high enough that it survives the route changes a flow drives —
 * in this app that is the shell layout.
 *
 * The engine is generic: `flows` is the only window-specific input, and it is
 * plain data (see `flowSchema.js`). Adding or editing a flow never touches this
 * component.
 *
 * @param {{flows?: object[], onFlowsInvalid?: (errors: string[]) => void,
 *          onFinish?: (info: {flowId: string, completed: boolean, stepId: string|null,
 *                            stepIndex: number, totalSteps: number}) => void,
 *          children?: React.ReactNode}} props
 */
export function WalkthroughProvider({ flows: rawFlows, onFlowsInvalid, onFinish, children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const { flows, errors } = useMemo(() => normalizeFlows(rawFlows), [rawFlows]);

  useEffect(() => {
    if (errors.length === 0) return;
    if (onFlowsInvalid) {
      onFlowsInvalid(errors);
      return;
    }
    // A malformed flow file is a development-time authoring error: drop the
    // flow (already done by `normalizeFlows`) and say why, loudly, instead of
    // failing the shell.
    // eslint-disable-next-line no-console
    console.error('[walkthrough] invalid flow definitions:', errors);
  }, [errors, onFlowsInvalid]);

  const engine = useWalkthroughEngine({ flows, navigate, pathname, onFinish });

  const value = useMemo(() => ({
    available: true,
    flows: engine.flows,
    isRunning: engine.isRunning,
    activeFlowId: engine.flow?.id ?? null,
    start: engine.start,
    stop: engine.stop,
  }), [engine.flows, engine.isRunning, engine.flow, engine.start, engine.stop]);

  return (
    <WalkthroughContext.Provider value={value} data-testid="WalkthroughContextProvider__wt">
      {children}
      <WalkthroughOverlay engine={engine} data-testid="WalkthroughOverlay__wt" />
    </WalkthroughContext.Provider>
  );
}

/** Everything a launcher needs: the available flows and how to start one. */
export function useWalkthrough() {
  return useContext(WalkthroughContext);
}
