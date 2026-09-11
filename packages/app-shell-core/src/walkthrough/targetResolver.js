/**
 * DOM-side helpers for the walkthrough engine: finding a step's target element,
 * waiting for it to mount, and reading whether a field target "has a value".
 *
 * Kept free of React so it can be exercised directly against a jsdom document.
 */

/** Error codes surfaced to the UI. Kept as data so tests can assert on them. */
export const WALKTHROUGH_ERROR = Object.freeze({
  TARGET_NOT_FOUND: 'targetNotFound',
  NAVIGATION_FAILED: 'navigationFailed',
  INVALID_SELECTOR: 'invalidSelector',
});

/**
 * True when the element occupies space and is not hidden. A target that exists
 * in the DOM but is collapsed (a closed tab panel, a `display:none` branch)
 * must not be highlighted — the user would get a spotlight over nothing.
 */
export function isTargetVisible(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) return false;
  const view = el.ownerDocument?.defaultView;
  if (view?.getComputedStyle) {
    const style = view.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

/**
 * First VISIBLE element matching the selector, or null.
 * Returns null (never throws) on a malformed selector — a broken flow file must
 * degrade into a reportable step error, not crash the app shell.
 */
export function resolveTarget(selector, doc = globalThis.document) {
  if (!doc || typeof selector !== 'string' || selector.trim().length === 0) return null;
  let matches;
  try {
    matches = doc.querySelectorAll(selector);
  } catch {
    return null;
  }
  for (const el of matches) {
    if (isTargetVisible(el)) return el;
  }
  return null;
}

/** True when the selector is syntactically usable. */
export function isSelectorValid(selector, doc = globalThis.document) {
  if (typeof selector !== 'string' || selector.trim().length === 0) return false;
  if (!doc) return true;
  try {
    doc.querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the "current value" of a field-ish target, for the `targetValue`
 * advance mode.
 *
 * The app renders a form control in several shapes: a bare `<input>`, a wrapper
 * `<div data-testid="field-x">` containing one, a selector field that replaces
 * its input with a `…-chip` once a record is picked, and a Radix select whose
 * trigger is a `<button>`. All four must count as "has a value".
 *
 * Deliberately does NOT fall back to the raw `textContent` of a field WRAPPER:
 * an empty field still renders its placeholder and its label, which would read
 * as "filled" and enable a gated Next button before the user typed anything.
 *
 * Text is only read from an element that IS the value display -- a selector
 * chip, a select/combobox trigger, a button. Verified against the live product
 * form: `field-searchKey` is the `<input>` itself (so the control branch
 * answers), while `field-productType-chip` is a `<button>` whose text ("Articulo")
 * genuinely is the chosen value. A plain wrapper `<div>` now returns '' instead
 * of its label text.
 */
export function readTargetValue(el) {
  if (!el) return '';

  const control = isFormControl(el) ? el : el.querySelector?.('input, textarea, select');
  if (control) {
    if (control.type === 'checkbox' || control.type === 'radio') {
      return control.checked ? 'on' : '';
    }
    const value = (control.value ?? '').toString().trim();
    if (value.length > 0) return value;
    // A selector field swaps its input for a chip on selection: the input goes
    // empty while the chosen record is rendered beside it.
    const chip = el.querySelector?.('[data-testid$="-chip"]');
    return chip ? (chip.textContent ?? '').trim() : '';
  }

  // Radix select trigger: it carries `data-placeholder` exactly while nothing
  // is selected, which is a far more reliable signal than its rendered text.
  if (el.hasAttribute?.('data-placeholder')) return '';
  if (el.querySelector?.('[data-placeholder]')) return '';

  const dataValue = el.getAttribute?.('data-value');
  if (typeof dataValue === 'string' && dataValue.trim().length > 0) return dataValue.trim();
  // Last resort, and only for an element that is itself the rendered value.
  if (isValueDisplay(el)) return (el.textContent ?? '').trim();
  return '';
}

/**
 * True when the element's own text IS the value, rather than a label or a
 * placeholder around one: a selector chip, a select/combobox trigger, a button.
 *
 * This is the line between "read the text" and "read nothing", and it is what
 * keeps `readTargetValue` honest about wrappers.
 */
export function isValueDisplay(el) {
  if (!el) return false;
  if (el.tagName === 'BUTTON') return true;
  const role = el.getAttribute?.('role');
  if (role === 'combobox' || role === 'listbox') return true;
  if (el.hasAttribute?.('aria-haspopup')) return true;
  const testId = el.getAttribute?.('data-testid');
  return typeof testId === 'string' && testId.endsWith('-chip');
}

/**
 * True when the element cannot be clicked. A `targetClick` step's gate IS the
 * click on its target, so a disabled target means that gate can never open --
 * the overlay uses this to hand "Next" back to the user instead of trapping
 * them between two dead buttons.
 *
 * `aria-disabled` counts: a styled-as-disabled element that still dispatches
 * clicks is rare, but a `div`/`a` acting as a button only has the ARIA form.
 */
export function isTargetDisabled(el) {
  if (!el) return false;
  if (el.disabled === true) return true;
  return el.getAttribute?.('aria-disabled') === 'true';
}

function isFormControl(el) {
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Resolves once the selector matches a visible element, or rejects with an
 * Error carrying `code === WALKTHROUGH_ERROR.TARGET_NOT_FOUND` after
 * `timeoutMs`.
 *
 * Polls rather than using a MutationObserver: visibility depends on layout, not
 * only on DOM mutations (a target can mount hidden inside a collapsed panel and
 * become visible without any further mutation).
 *
 * @param {string} selector
 * @param {{timeoutMs?: number, intervalMs?: number, doc?: Document,
 *          signal?: {aborted: boolean, addEventListener?: Function}}} options
 * @returns {Promise<Element>}
 */
export function waitForTarget(selector, options = {}) {
  const {
    timeoutMs = 10000,
    intervalMs = 100,
    doc = globalThis.document,
    signal,
  } = options;

  return new Promise((resolve, reject) => {
    if (!isSelectorValid(selector, doc)) {
      reject(makeError(WALKTHROUGH_ERROR.INVALID_SELECTOR, `Invalid selector: ${selector}`));
      return;
    }

    const immediate = resolveTarget(selector, doc);
    if (immediate) {
      resolve(immediate);
      return;
    }

    const deadline = Date.now() + timeoutMs;
    let timer = null;

    const cleanup = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
      signal?.removeEventListener?.('abort', onAbort);
    };

    function onAbort() {
      cleanup();
      reject(makeError('aborted', 'Walkthrough step aborted'));
    }

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener?.('abort', onAbort);

    timer = setInterval(() => {
      const el = resolveTarget(selector, doc);
      if (el) {
        cleanup();
        resolve(el);
        return;
      }
      if (Date.now() >= deadline) {
        cleanup();
        reject(makeError(
          WALKTHROUGH_ERROR.TARGET_NOT_FOUND,
          `Walkthrough target not found: ${selector}`,
        ));
      }
    }, intervalMs);
  });
}

function makeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * How much taller than the resolved target an ancestor may be and still count
 * as "the same field box". The gap between a `CreatableSearchSelect`'s bordered
 * wrapper and the input inside it is exactly its 1px border on each side;
 * between the wrapper and the chip it renders instead of the input it is the
 * chip's smaller height. The next ancestor up is the label+control stack, which
 * clears this by a wide margin (~28px for a single-line label).
 */
const HIGHLIGHT_BOX_HEIGHT_SLACK = 16;
/** Ancestors examined before giving up. The wrapper is always the first one. */
const HIGHLIGHT_BOX_MAX_CLIMB = 3;

/**
 * The element the spotlight should be drawn around, given the element a step
 * RESOLVED to. Usually the same element — but not for a composite control.
 *
 * A selector field carries `data-testid="field-<key>"` on the bare `<input>`
 * inside its bordered wrapper, while the chevron button is a flex SIBLING of
 * that input. Measured against the live stylesheet: the chevron's right edge
 * sits 20px past the input's, and the wrapper is 38px wider than the input but
 * only 2px taller. So a ring drawn around the raw target cut straight through
 * the chevron, and the scrim left it dimmed — the control looked broken in
 * half. Widening `spotlightPadding` is not the fix: it would fatten the ring on
 * all four sides of every other field to paper over one asymmetric case.
 *
 * The rule is "climb to the box that PAINTS the field", so it is self-limiting:
 * an ancestor qualifies only when it has a visible border AND is barely taller
 * than the target. A plain `<Input>` paints its own border and its parent is
 * the taller label+control stack, so it is returned untouched — this changes
 * nothing for a field that was already highlighted correctly.
 *
 * Highlight ONLY. The engine keeps pointing the click, the cursor and the
 * `targetValue` read at the element the flow actually named — those care about
 * the input, not about the box around it.
 */
export function resolveHighlightBox(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return el;
  const view = el.ownerDocument?.defaultView;
  if (!view?.getComputedStyle) return el;

  const baseHeight = el.getBoundingClientRect().height;
  let candidate = el.parentElement;
  for (let climbed = 0; candidate && climbed < HIGHLIGHT_BOX_MAX_CLIMB; climbed += 1) {
    const box = candidate.getBoundingClientRect();
    if (box.height - baseHeight > HIGHLIGHT_BOX_HEIGHT_SLACK) return el;
    if (paintsBorder(view.getComputedStyle(candidate))) return candidate;
    candidate = candidate.parentElement;
  }
  return el;
}

/** True when the element draws a border on all four sides. */
function paintsBorder(style) {
  if (!style) return false;
  const widths = [
    style.borderTopWidth,
    style.borderRightWidth,
    style.borderBottomWidth,
    style.borderLeftWidth,
  ];
  return widths.every((w) => Number.parseFloat(w) > 0) && style.borderStyle !== 'none';
}
