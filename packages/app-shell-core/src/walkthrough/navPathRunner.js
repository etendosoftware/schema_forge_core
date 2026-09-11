/**
 * Runs a step's `navPath`: the sequence of REAL clicks the walkthrough performs
 * itself to reach the screen a step lives on (open the side menu, click the
 * section, click the window entry).
 *
 * Why real clicks and not a decorative pointer over a programmatic route jump:
 * a decorative cursor desynchronizes from the navigation it pretends to drive
 * and ends up pointing at nothing. Here the animation and the navigation are
 * the same event — the cursor lands on the element and that element is then
 * genuinely clicked, so what the user watches is exactly the path they can
 * repeat alone afterwards.
 *
 * NAVIGATION ONLY. This module is reachable only from the engine's step-entry
 * phase and never from `advance`: the tour must never fill in a field or press
 * Save for the user, because then it stops teaching. Nothing here knows how to
 * type, and the engine gives it no way to be called once a step is active.
 *
 * Kept free of React so it can be driven directly against a jsdom document.
 */

import { WALKTHROUGH_ERROR, resolveTarget, waitForTarget } from './targetResolver.js';

/** Extra error codes this module can surface, on top of WALKTHROUGH_ERROR. */
export const NAV_PATH_ERROR = Object.freeze({
  /** A real user click happened mid-path, so the user has taken over. */
  USER_TAKEOVER: 'navPathUserTakeover',
  /** The engine tore the path down (unmount, step change, tour ended). */
  ABORTED: 'aborted',
});

/**
 * Dispatches a click the application's real handlers will react to.
 *
 * A bare `el.click()` is not enough across the board: Radix triggers (the
 * collapsed side-menu group popovers, dropdowns) open on `pointerdown`, not on
 * `click`. So the full press sequence is emitted, then `click()` for the plain
 * `onClick` handlers. Every event here is untrusted (`isTrusted === false`),
 * which is exactly how `runNavPath` tells its own clicks apart from a real
 * user's.
 */
export function syntheticClick(el) {
  if (!el) return;
  const view = el.ownerDocument?.defaultView ?? globalThis;
  const rect = el.getBoundingClientRect?.() ?? { left: 0, top: 0, width: 0, height: 0 };
  const init = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };

  const PointerEventCtor = view.PointerEvent;
  const MouseEventCtor = view.MouseEvent;
  const fire = (pointerType, mouseType) => {
    if (typeof PointerEventCtor === 'function') {
      el.dispatchEvent(new PointerEventCtor(pointerType, { ...init, isPrimary: true }));
    }
    if (typeof MouseEventCtor === 'function') {
      el.dispatchEvent(new MouseEventCtor(mouseType, init));
    }
  };

  el.focus?.({ preventScroll: true });
  fire('pointerdown', 'mousedown');
  fire('pointerup', 'mouseup');
  el.click?.();
}

/** The centre of an element, in viewport coordinates. */
export function elementCenter(el) {
  const rect = el?.getBoundingClientRect?.();
  if (!rect) return { x: 0, y: 0 };
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Does this document have a layout engine at all?
 *
 * jsdom does not: EVERY `getBoundingClientRect()` there is `0x0`. So a
 * "this element has no box yet" guard must be a no-op under jsdom, or every
 * hop in every unit test would stall for the settle deadline and then behave
 * exactly as it does today, only slower. The root element is the probe: a real
 * browser always gives it a box.
 */
function hasLayout(doc) {
  const rect = doc?.documentElement?.getBoundingClientRect?.();
  return !!rect && (rect.width > 0 || rect.height > 0);
}

/** An element we can actually point the cursor at. */
function isPointable(el, doc) {
  if (!el?.isConnected) return false;
  if (!hasLayout(doc)) return true;
  const rect = el.getBoundingClientRect?.();
  return !!rect && rect.width > 0 && rect.height > 0;
}

/**
 * Re-resolves a hop's target until it is something the cursor can travel to.
 *
 * Two ways a just-found hop element goes stale before we use it, both observed
 * live in the side menu:
 *
 *  1. **It is replaced.** `sidebar-expand` and the expanded menu are different
 *     render branches, so clicking "expand" unmounts the collapsed group
 *     trigger and mounts the inline group header -- same selector, different
 *     element. `waitForTarget` resolved the old one; by the time the next hop
 *     runs it is DETACHED, and a detached element reports an all-zero rect.
 *     The cursor then animates to (0, 0) -- the corner of the screen -- and
 *     clicks something with no box. That is not a hypothetical: it is what the
 *     trajectory showed once `menu-group-*` started existing in both states.
 *  2. **It is not laid out yet.** The side menu animates its width for 200ms,
 *     so an element can be mounted and still measure `0x0` for a few frames.
 *
 * Both are the same question -- "can I point at this yet?" -- so both get the
 * same answer: keep re-resolving the selector for a short while. On timeout we
 * return whatever we have; the caller still CLICKS it (a click needs no box),
 * it just skips the tween rather than flying to the corner.
 */
async function settleTarget(el, selector, { doc, signal, timeoutMs = 800, intervalMs = 50 } = {}) {
  if (isPointable(el, doc)) return el;

  const deadline = Date.now() + timeoutMs;
  let current = el;
  while (Date.now() < deadline) {
    if (signal?.aborted) return current;
    // eslint-disable-next-line no-await-in-loop -- a deliberate poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const fresh = resolveTarget(selector, doc);
    if (fresh) current = fresh;
    if (isPointable(current, doc)) return current;
  }
  return current;
}

const defaultIsUserEvent = (event) => !!event?.isTrusted;

function makeError(code, message, detail) {
  const error = new Error(message);
  error.code = code;
  error.detail = detail;
  return error;
}

/**
 * Walks the hops in order: wait for the element, animate the cursor to it, then
 * click it for real.
 *
 * Resolution/rejection contract — the caller (the engine) decides what to do,
 * and in every rejecting case it falls back to the step's programmatic `route`:
 *   - resolves `{ hops, clicked }` when every hop was handled (clicked or skipped)
 *   - rejects with `WALKTHROUGH_ERROR.TARGET_NOT_FOUND` when a required hop
 *     never appeared
 *   - rejects with `NAV_PATH_ERROR.USER_TAKEOVER` when a real click happened
 *   - rejects with `NAV_PATH_ERROR.ABORTED` when the caller aborted
 *
 * A user's mouse MOVEMENT is deliberately not watched: a stray movement over
 * the screen must not kill the tour. Only an actual click means "I'll drive".
 *
 * @param {object[]} hops normalized hops (see `flowSchema.js`)
 * @param {{doc?: Document, signal?: AbortSignal, reducedMotion?: boolean,
 *          moveCursor?: (point: {x: number, y: number}, durationMs: number) => Promise<void>,
 *          click?: (el: Element) => void,
 *          isUserEvent?: (event: Event) => boolean}} options
 * @returns {Promise<{hops: number, clicked: number}>}
 */
export async function runNavPath(hops, options = {}) {
  const {
    doc = globalThis.document,
    signal,
    reducedMotion = false,
    moveCursor,
    click = syntheticClick,
    // Injectable so a test can simulate a real click: jsdom refuses to let
    // `isTrusted` be redefined on a synthetic event, which would otherwise make
    // the takeover branch unreachable from a unit test.
    isUserEvent = defaultIsUserEvent,
  } = options;

  const list = Array.isArray(hops) ? hops : [];
  if (list.length === 0) return { hops: 0, clicked: 0 };

  let clicked = 0;

  // --- takeover detection -------------------------------------------------
  let takenOver = false;
  const onUserClick = (event) => {
    // Our own clicks are synthetic and therefore untrusted; a real user's are
    // trusted. No flag-passing, no window of ambiguity.
    if (isUserEvent(event)) takenOver = true;
  };
  doc?.addEventListener?.('click', onUserClick, true);

  const assertLive = () => {
    if (signal?.aborted) throw makeError(NAV_PATH_ERROR.ABORTED, 'navPath aborted');
    if (takenOver) throw makeError(NAV_PATH_ERROR.USER_TAKEOVER, 'user took over navigation');
  };

  try {
    for (const hop of list) {
      assertLive();

      // Already-satisfied hop: the group is open, the menu is expanded. Clicking
      // it again would undo it.
      if (hop.skipIf && resolveTarget(hop.skipIf, doc)) continue;

      let el;
      try {
        // eslint-disable-next-line no-await-in-loop -- hops are sequential by nature
        el = await waitForTarget(hop.target, {
          timeoutMs: hop.timeoutMs,
          doc,
          signal,
        });
      } catch (error) {
        if (error?.code === 'aborted') {
          throw makeError(NAV_PATH_ERROR.ABORTED, 'navPath aborted', hop.target);
        }
        if (hop.optional) continue;
        throw makeError(
          WALKTHROUGH_ERROR.TARGET_NOT_FOUND,
          `navPath hop not found: ${hop.target}`,
          hop.target,
        );
      }

      assertLive();
      // eslint-disable-next-line no-await-in-loop -- hops are sequential by nature
      el = await settleTarget(el, hop.target, { doc, signal });
      assertLive();
      if (moveCursor && isPointable(el, doc)) {
        // Reduced motion: land on the target with no tween, but still click.
        // The lesson (which element, in which order) survives; only the travel
        // animation is dropped.
        // eslint-disable-next-line no-await-in-loop -- hops are sequential by nature
        await moveCursor(elementCenter(el), reducedMotion ? 0 : hop.durationMs);
      }
      assertLive();
      click(el);
      clicked += 1;
    }
    return { hops: list.length, clicked };
  } finally {
    doc?.removeEventListener?.('click', onUserClick, true);
  }
}
