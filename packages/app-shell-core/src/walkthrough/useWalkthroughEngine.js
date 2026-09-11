import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { matchRoutePattern } from './routeMatch.js';
import { NAV_PATH_ERROR, runNavPath, syntheticClick } from './navPathRunner.js';
import {
  WALKTHROUGH_ERROR,
  isTargetDisabled,
  readTargetValue,
  resolveTarget,
  waitForTarget,
} from './targetResolver.js';
import { useReducedMotion } from './useReducedMotion.js';

/**
 * The walkthrough state machine. Generic by construction: everything it knows
 * about a window arrives as normalized flow data (see `flowSchema.js`).
 *
 * Phases
 *   idle       nothing running
 *   entering   a step was just entered; navigation (if any) is being issued
 *   navigating waiting for the browser location to reach the step's screen
 *   waiting    on the right screen, waiting for the target element to mount
 *   active     target found and highlighted
 *   error      the step could not be reached (target missing / navigation failed)
 *   completed  the last step finished
 *
 * `navigate` and `pathname` are injected rather than read from react-router so
 * the machine can be driven directly in a unit test with no Router mounted.
 *
 * @param {{flows: object[], navigate: Function, pathname: string,
 *          onFinish?: (info: {flowId: string, completed: boolean, stepId: string|null,
 *                            stepIndex: number, totalSteps: number}) => void}} params
 */
export function useWalkthroughEngine({ flows, navigate, pathname, onFinish }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  // The animated pointer lives OUTSIDE the state machine: it is presentation
  // that changes several times within a single machine phase, and folding it in
  // would make every cursor tick a state transition.
  const [cursor, setCursor] = useState(IDLE_CURSOR);
  // Last navPath failure, surfaced so a test (and the overlay's dataset) can
  // assert that a broken tour path was reported rather than swallowed.
  const [navPathFailure, setNavPathFailure] = useState(null);
  const reducedMotion = useReducedMotion();

  // Mirrors kept in refs so the step-lifecycle effect can read the latest
  // location/navigate without re-running every time the user moves around.
  const pathnameRef = useRef(pathname);
  const navigateRef = useRef(navigate);
  const onFinishRef = useRef(onFinish);
  // The element that had focus when the tour started, restored on exit so
  // abandoning a walkthrough leaves the window exactly as usable as before.
  const previousFocusRef = useRef(null);
  // Aborts the navPath currently being walked. Held in a ref (not state) so the
  // single teardown path can reach it from any caller.
  const navRunRef = useRef(null);
  const cursorTimersRef = useRef([]);
  // The pending requestAnimationFrame that starts the first hop's travel (see
  // `moveCursor`). Held so THE teardown can cancel it -- an uncancelled frame
  // fires after teardown and resurrects a cursor that should be gone.
  const cursorFrameRef = useRef(null);
  const cursorVisibleRef = useRef(false);
  // The user's last real pointer position, used to seed the animated cursor so
  // its first hop starts from where the user is looking instead of sweeping in
  // from the viewport corner. Movement is recorded but NEVER treated as intent
  // to take over -- only a real click is (see `runNavPath`).
  const pointerRef = useRef(null);
  // `onFinish` is reported at most once per run: a completed tour dispatches
  // `complete` (which keeps the congratulations card up) and the card's button
  // then ends the tour, which must not report a second, contradictory result.
  const reportedRef = useRef(false);
  const reducedMotionRef = useRef(reducedMotion);
  useEffect(() => { reducedMotionRef.current = reducedMotion; }, [reducedMotion]);

  useEffect(() => {
    pathnameRef.current = pathname;
    navigateRef.current = navigate;
    onFinishRef.current = onFinish;
  }, [pathname, navigate, onFinish]);

  const flowsById = useMemo(() => {
    const map = new Map();
    (flows ?? []).forEach((flow) => map.set(flow.id, flow));
    return map;
  }, [flows]);

  const flow = state.flowId ? flowsById.get(state.flowId) ?? null : null;
  const step = flow?.steps?.[state.stepIndex] ?? null;
  const isRunning = state.phase !== 'idle';

  // --- public commands ------------------------------------------------------

  const start = useCallback((flowId) => {
    if (!flowsById.has(flowId)) return false;
    previousFocusRef.current = globalThis.document?.activeElement ?? null;
    reportedRef.current = false;
    dispatch({ type: 'start', flowId });
    return true;
  }, [flowsById]);

  const restoreFocus = useCallback(() => {
    const el = previousFocusRef.current;
    previousFocusRef.current = null;
    if (el && typeof el.focus === 'function' && el.isConnected) {
      el.focus({ preventScroll: true });
    }
  }, []);

  const clearCursorTimers = useCallback(() => {
    cursorTimersRef.current.forEach(clearTimeout);
    cursorTimersRef.current = [];
    if (cursorFrameRef.current !== null) {
      globalThis.cancelAnimationFrame?.(cursorFrameRef.current);
      cursorFrameRef.current = null;
    }
  }, []);

  const hideCursor = useCallback(() => {
    clearCursorTimers();
    cursorVisibleRef.current = false;
    setCursor(IDLE_CURSOR);
  }, [clearCursorTimers]);

  /**
   * Moves the animated cursor to a point and resolves when it has "pressed"
   * there, so the caller clicks exactly when the press is visible.
   *
   * `durationMs === 0` is the reduced-motion contract: jump straight there, the
   * press still happens, the click still happens.
   */
  const moveCursor = useCallback((point, durationMs) => new Promise((resolve) => {
    const push = (timer) => cursorTimersRef.current.push(timer);

    const travel = () => {
      setCursor({ visible: true, x: point.x, y: point.y, durationMs, pressed: false });
      push(setTimeout(() => {
        setCursor((prev) => ({ ...prev, pressed: true }));
        push(setTimeout(() => setCursor((prev) => ({ ...prev, pressed: false })), CURSOR_PRESS_MS));
        resolve();
      }, durationMs));
    };

    if (!cursorVisibleRef.current) {
      cursorVisibleRef.current = true;
      const seed = pointerRef.current ?? {
        x: (globalThis.innerWidth ?? 1280) / 2,
        y: (globalThis.innerHeight ?? 800) / 2,
      };
      setCursor({ visible: true, x: seed.x, y: seed.y, durationMs: 0, pressed: false });
      // The seeded position must be PAINTED before the transition to the target
      // starts, or the browser coalesces both transforms into one and there is
      // no travel to watch: the cursor simply materialises on the target and
      // sits there for the whole duration. That is what `setTimeout(0)` used to
      // do here -- a macrotask is not a guaranteed paint, and measured live the
      // cursor spent its entire first hop parked on the button it was supposed
      // to be flying towards.
      //
      // Two frames is the reliable primitive: the first fires before the paint
      // that commits the seed, the second after it. `setTimeout` remains the
      // fallback for environments with no rAF (jsdom under fake timers).
      const raf = globalThis.requestAnimationFrame;
      if (typeof raf === 'function') {
        cursorFrameRef.current = raf(() => {
          cursorFrameRef.current = raf(() => {
            cursorFrameRef.current = null;
            travel();
          });
        });
      } else {
        push(setTimeout(travel, 0));
      }
      return;
    }
    travel();
  }), []);

  /**
   * THE teardown. Every way out of a walkthrough -- Escape, the close button,
   * "Exit", "Finish", the error card's exit, finishing the last step, unmount
   * -- goes through here. A second teardown function is how an overlay gets
   * leaked or a cursor stranded, so there is exactly one.
   */
  const teardown = useCallback(() => {
    navRunRef.current?.abort();
    navRunRef.current = null;
    hideCursor();
    restoreFocus();
  }, [hideCursor, restoreFocus]);

  const endTour = useCallback((completed) => {
    const finishedFlowId = state.flowId;
    // Read the step BEFORE dispatching: `complete` resets `stepIndex` to 0, so
    // a host that reports where the run ended must be handed the pre-dispatch
    // position. `step`/`state.stepIndex` here are the render's snapshot, which
    // is exactly that.
    const finishedStepId = step?.id ?? null;
    const finishedStepIndex = state.stepIndex;
    const totalSteps = flow?.steps?.length ?? 0;
    dispatch({ type: completed ? 'complete' : 'stop' });
    teardown();
    if (finishedFlowId && !reportedRef.current) {
      reportedRef.current = true;
      onFinishRef.current?.({
        flowId: finishedFlowId,
        completed,
        // Where the run ended. On an abandoned run this is the step the user
        // walked away from -- the only datum that says WHERE a tour loses
        // people, which a bare `completed: false` cannot.
        stepId: finishedStepId,
        stepIndex: finishedStepIndex,
        totalSteps,
      });
    }
  }, [state.flowId, state.stepIndex, step, flow, teardown]);

  const stop = useCallback(() => endTour(false), [endTour]);

  const goToStep = useCallback((index) => {
    dispatch({ type: 'goto', stepIndex: index });
  }, []);

  const isLastStep = !!flow && state.stepIndex >= flow.steps.length - 1;

  // The tour that follows this one, offered from the completion card so a user
  // who just finished is one click away from continuing instead of hunting for
  // the launcher again. "Next" is simply the next entry in the registry, so the
  // progression is authored by ORDERING the flow list (contact -> product ->
  // sales order, each building on the previous one) rather than by a separate
  // graph nobody would keep in sync. The last flow has no next: `null`, and the
  // card falls back to its plain close button.
  const nextFlow = useMemo(() => {
    if (!flow) return null;
    const list = flows ?? [];
    const index = list.findIndex((candidate) => candidate.id === flow.id);
    return index >= 0 && index < list.length - 1 ? list[index + 1] : null;
  }, [flows, flow]);

  const next = useCallback(() => {
    if (!flow) return;
    if (state.stepIndex >= flow.steps.length - 1) {
      endTour(true);
      return;
    }
    dispatch({ type: 'goto', stepIndex: state.stepIndex + 1 });
  }, [endTour, flow, state.stepIndex]);

  /**
   * "Finish" -- offered on EVERY step, not only the last one. A user who has
   * seen enough must be able to end the tour from where they are without
   * hunting for a close icon. On the last step it shows the completion card;
   * earlier it simply ends, reported as not completed (because it was not).
   */
  const finish = useCallback(() => endTour(isLastStep), [endTour, isLastStep]);

  const previous = useCallback(() => {
    if (state.stepIndex <= 0) return;
    dispatch({ type: 'goto', stepIndex: state.stepIndex - 1 });
  }, [state.stepIndex]);

  const retry = useCallback(() => {
    dispatch({ type: 'goto', stepIndex: state.stepIndex });
  }, [state.stepIndex]);

  // Keep `next` reachable from effects without adding it to their dep arrays.
  const nextRef = useRef(next);
  useEffect(() => { nextRef.current = next; }, [next]);

  // --- effect 1: enter a step — decide whether we must travel at all --------

  useEffect(() => {
    // Only the freshly-entered phase issues navigation. Without this guard the
    // `completed` phase (which resets stepIndex/attempt, and so changes this
    // dep array) would re-enter step 0 and restart the tour.
    if (state.phase !== 'entering' || !step) return;

    // A visible target is sufficient only for a route-less step, or when the
    // current route belongs to this step. Action selectors such as `action-new`
    // are deliberately shared by many windows: a Product tour started from
    // Contacts must travel to Product rather than highlighting Contacts' New.
    const targetOnExpectedRoute = resolveTarget(step.target)
      && (!step.routeMatch || matchRoutePattern(step.routeMatch, pathnameRef.current));
    if (targetOnExpectedRoute) {
      dispatch({ type: 'routeReady' });
      return;
    }

    // Requirement, explicit: never animate a trip to where we already are. A
    // matching `routeMatch` skips the whole navPath — no menu opening, no
    // cursor, no clicks. (The target simply has not mounted yet; effect 3
    // waits for it.)
    if (!step.routeMatch || matchRoutePattern(step.routeMatch, pathnameRef.current)) {
      dispatch({ type: 'routeReady' });
      return;
    }

    // A step with nowhere to go and no target on screen is not a navigation
    // problem — let effect 3 wait for the target and report it if it never
    // arrives, instead of pretending to open a screen.
    if (!step.route) {
      dispatch({ type: 'routeReady' });
      return;
    }

    dispatch({ type: 'navigating' });
    // Intentionally keyed on the step identity + phase only — the current
    // location and the navigate function are read from refs (see above) so
    // moving around during a tour does not re-enter the step.
  }, [state.phase, state.flowId, state.stepIndex, state.attempt, step]);

  // --- effect 1b: perform the trip, under a timeout that cannot be lost -----

  useEffect(() => {
    if (state.phase !== 'navigating' || !step) return undefined;

    let cancelled = false;

    // The navigation timeout lives HERE, in the `navigating` phase, rather than
    // in the effect that decides to navigate. That effect destroyed its own
    // timer: dispatching `navigating` changed its dep array, so React ran its
    // cleanup (clearing the timeout) and then re-ran it into the early return.
    // The result was an "Opening the screen for this step…" spinner that never
    // resolved and never failed — the exact edge case the design forbids.
    const timer = setTimeout(() => {
      dispatch({
        type: 'failIfNavigating',
        error: { code: WALKTHROUGH_ERROR.NAVIGATION_FAILED, stepId: step.id, detail: step.route },
      });
    }, step.navTimeoutMs);

    const programmaticNavigate = () => {
      try {
        navigateRef.current?.(step.route);
      } catch {
        dispatch({
          type: 'fail',
          error: { code: WALKTHROUGH_ERROR.NAVIGATION_FAILED, stepId: step.id, detail: step.route },
        });
      }
    };

    if (step.navPath.length === 0) {
      programmaticNavigate();
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    // The animated path: real clicks through the real menu, so the user learns
    // the route and can repeat it alone. Everything it can do is navigation —
    // it is only ever started from a step's travel phase, never from `advance`.
    const controller = new AbortController();
    navRunRef.current = controller;
    setNavPathFailure(null);

    runNavPath(step.navPath, {
      signal: controller.signal,
      reducedMotion: reducedMotionRef.current,
      moveCursor,
      click: syntheticClick,
    }).catch((error) => {
      if (cancelled || error?.code === NAV_PATH_ERROR.ABORTED) return;
      // A hop that never appeared, or a user who took over mid-path: fall back
      // to the plain programmatic jump. The tour continues at this step's own
      // target either way — the user is never left with a highlight over
      // nothing, and `timer` above still bounds the whole thing.
      //
      // But the fallback MUST NOT be silent. A broken hop selector produces an
      // instant route jump with no cursor, which is visually indistinguishable
      // from "the animated path was never built" — the flow author has no way
      // to find out their tour is broken. Same class of defect as a spinner
      // that never resolves: graceful for the user, invisible to the developer.
      // A user takeover is NOT a broken flow, so it is not reported as one.
      if (error?.code !== NAV_PATH_ERROR.USER_TAKEOVER) {
        const failure = { stepId: step.id, code: error?.code ?? null, selector: error?.detail ?? null };
        setNavPathFailure(failure);
        // eslint-disable-next-line no-console
        console.warn(
          `[walkthrough] navPath failed on step "${step.id}" (${failure.code}): `
          + `hop selector ${failure.selector} never resolved. `
          + `Falling back to route "${step.route}" — the user will see an instant `
          + 'jump with no animated path. Fix the hop selector in the flow JSON.',
        );
      }
      programmaticNavigate();
    }).finally(() => {
      if (navRunRef.current === controller) navRunRef.current = null;
      if (!cancelled) hideCursor();
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
      if (navRunRef.current === controller) navRunRef.current = null;
      hideCursor();
    };
  }, [state.phase, state.flowId, state.stepIndex, state.attempt, step, hideCursor, moveCursor]);

  // --- effect 2: the location reached the step's screen ---------------------

  useEffect(() => {
    if (state.phase !== 'navigating' || !step) return;
    if (!step.routeMatch || matchRoutePattern(step.routeMatch, pathname)) {
      dispatch({ type: 'routeReady' });
    }
  }, [pathname, state.phase, step]);

  // --- effect 3: wait for the target element to mount ----------------------

  useEffect(() => {
    if (state.phase !== 'waiting' || !step) return undefined;

    const controller = new AbortController();
    let cancelled = false;

    waitForTarget(step.target, {
      timeoutMs: step.targetTimeoutMs,
      signal: controller.signal,
    }).then((el) => {
      if (cancelled) return;
      el.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      dispatch({ type: 'targetReady', target: el });
    }).catch((error) => {
      if (cancelled || error?.code === 'aborted') return;
      // An optional step whose UI simply is not present in this configuration
      // is skipped rather than reported.
      if (step.optional && error?.code === WALKTHROUGH_ERROR.TARGET_NOT_FOUND) {
        nextRef.current?.();
        return;
      }
      dispatch({
        type: 'fail',
        error: {
          code: error?.code ?? WALKTHROUGH_ERROR.TARGET_NOT_FOUND,
          stepId: step.id,
          detail: step.target,
        },
      });
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [state.phase, state.flowId, state.stepIndex, state.attempt, step]);

  // --- effect 3b: the target element was swapped out from under us ---------

  useEffect(() => {
    if (state.phase !== 'active' || !step || !state.target) return undefined;

    // A field does not merely CHANGE while a step is active -- it can be
    // REPLACED. A searchable FK renders an `<input>` while empty and swaps it
    // for a `-chip` button the moment a record is picked, so the element the
    // step latched onto becomes detached exactly when the user does the thing
    // the step asked for. The spotlight then tracks a node that is no longer in
    // the document and `readTargetValue` reads the dead input's empty value, so
    // a `requireValue` gate never opens: the user selects a category and "Next"
    // stays disabled forever.
    //
    // Polling connectivity is enough -- `step.target` matches both shapes (see
    // `testIdSelector`), so re-resolving finds whichever one is mounted now.
    const timer = setInterval(() => {
      if (state.target.isConnected) return;
      const replacement = resolveTarget(step.target);
      if (replacement) dispatch({ type: 'targetReady', target: replacement });
    }, TARGET_RECHECK_MS);
    return () => clearInterval(timer);
  }, [state.phase, state.target, step]);

  // --- effect 4: advance conditions ----------------------------------------

  useEffect(() => {
    if (state.phase !== 'active' || !step || !state.target) return undefined;
    const mode = step.advance.on;

    if (mode === 'targetClick') {
      const el = state.target;
      const onClick = () => nextRef.current?.();
      el.addEventListener('click', onClick, { once: true });
      // Whether that click is even POSSIBLE is polled, because it changes
      // while the step is open: sales-order's "Save" is enabled exactly while
      // the order is dirty, and committing a line clears that from under the
      // step. A disabled `<button>` dispatches no click, so without this the
      // step's own gate and the card's "Next" would both be dead at once.
      const checkDisabled = () => {
        dispatch({ type: 'targetDisabled', value: isTargetDisabled(el) });
      };
      checkDisabled();
      const timer = setInterval(checkDisabled, VALUE_POLL_MS);
      return () => {
        clearInterval(timer);
        el.removeEventListener('click', onClick);
      };
    }

    if (mode === 'targetValue' || step.advance.requireValue) {
      // Polled rather than listened to: selector fields commit their value from
      // a portalled dropdown and swap the input for a chip, so neither `input`
      // nor `change` fires reliably on the target subtree.
      //
      // The poll ENABLES "Next"; it never presses it. A field step that
      // auto-advanced on the first typed character yanked the bubble away
      // mid-word — the user could not finish typing, let alone read the hint.
      // Acting advances (see `targetClick`); typing does not.
      const check = () => {
        const satisfied = readTargetValue(state.target).length > 0;
        dispatch({ type: 'valueSatisfied', value: satisfied });
      };
      check();
      const timer = setInterval(check, VALUE_POLL_MS);
      return () => clearInterval(timer);
    }

    return undefined;
  }, [state.phase, state.target, step]);

  useEffect(() => {
    if (state.phase !== 'active' || step?.advance.on !== 'route') return;
    if (matchRoutePattern(step.advance.route, pathname)) nextRef.current?.();
  }, [pathname, state.phase, step]);

  // --- effect 5: Escape always exits ---------------------------------------

  useEffect(() => {
    if (!isRunning) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') stop();
    };
    globalThis.document?.addEventListener('keydown', onKeyDown);
    return () => globalThis.document?.removeEventListener('keydown', onKeyDown);
  }, [isRunning, stop]);

  // --- effect 6: seed the animated cursor from the real pointer ------------

  useEffect(() => {
    const recordPointer = (event) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
    };
    globalThis.document?.addEventListener('mousemove', recordPointer, { passive: true });
    // A pointer can click the launcher without emitting a new mousemove. Capture
    // the press as well so the animated cursor starts at that exact position.
    globalThis.document?.addEventListener('pointerdown', recordPointer, { passive: true });
    return () => {
      globalThis.document?.removeEventListener('mousemove', recordPointer);
      globalThis.document?.removeEventListener('pointerdown', recordPointer);
    };
  }, []);

  // --- effect 7: unmount goes through the same teardown --------------------

  useEffect(() => teardown, [teardown]);

  const canAdvance = state.phase === 'active'
    && (!step?.advance.requireValue || state.valueSatisfied);

  return {
    flows: flows ?? [],
    flow,
    step,
    stepIndex: state.stepIndex,
    stepCount: flow?.steps.length ?? 0,
    phase: state.phase,
    error: state.error,
    target: state.target,
    isRunning,
    canAdvance,
    isLastStep,
    nextFlow,
    targetDisabled: state.targetDisabled,
    reducedMotion,
    cursor,
    navPathFailure,
    start,
    stop,
    finish,
    next,
    previous,
    goToStep,
    retry,
    // The error card's escape hatch: move past a step whose target never
    // appeared instead of trapping the user on it.
    skipStep: next,
  };
}

const VALUE_POLL_MS = 250;
/** How often an active step checks that its target is still in the document. */
const TARGET_RECHECK_MS = 200;
/** How long the cursor renders its "pressed" state around a synthetic click. */
const CURSOR_PRESS_MS = 180;

const IDLE_CURSOR = Object.freeze({
  visible: false, x: 0, y: 0, durationMs: 0, pressed: false,
});

const INITIAL_STATE = {
  flowId: null,
  stepIndex: 0,
  // Incremented by `retry`, so re-entering the SAME step re-runs the lifecycle
  // effects (whose dep arrays would otherwise be unchanged).
  attempt: 0,
  phase: 'idle',
  error: null,
  target: null,
  valueSatisfied: false,
  targetDisabled: false,
};

function enterStep(state, patch) {
  return {
    ...state,
    ...patch,
    attempt: state.attempt + 1,
    phase: 'entering',
    error: null,
    target: null,
    valueSatisfied: false,
    targetDisabled: false,
  };
}

export function reducer(state, action) {
  switch (action.type) {
    case 'start':
      return enterStep(INITIAL_STATE, { flowId: action.flowId, stepIndex: 0 });
    case 'goto':
      return enterStep(state, { stepIndex: action.stepIndex });
    case 'navigating':
      return state.phase === 'entering' ? { ...state, phase: 'navigating' } : state;
    case 'routeReady':
      return (state.phase === 'entering' || state.phase === 'navigating')
        ? { ...state, phase: 'waiting' }
        : state;
    case 'targetReady':
      return { ...state, phase: 'active', target: action.target, error: null };
    case 'fail':
      return { ...state, phase: 'error', error: action.error, target: null };
    case 'failIfNavigating':
      return state.phase === 'navigating'
        ? { ...state, phase: 'error', error: action.error, target: null }
        : state;
    case 'targetDisabled':
      return state.targetDisabled === action.value
        ? state
        : { ...state, targetDisabled: action.value };
    case 'valueSatisfied':
      return state.valueSatisfied === action.value
        ? state
        : { ...state, valueSatisfied: action.value };
    case 'complete':
      return { ...INITIAL_STATE, flowId: state.flowId, phase: 'completed' };
    case 'stop':
      return INITIAL_STATE;
    default:
      return state;
  }
}
