/**
 * Walkthrough flow schema — the data contract between the (generic) engine and
 * the (window-specific) flow JSON files that live in the consuming application.
 *
 * The engine knows NOTHING about any particular window: every reference to a
 * window, a route, a field or an action is data supplied by a flow file. Adding
 * a flow, reordering its steps or repointing a step is therefore a pure data
 * change — no code change, no recompiled tour logic.
 *
 * The full, human-readable contract (with examples) is documented in the
 * consuming repo under `docs/walkthrough-flows.md`. This module is the
 * executable version of it: it normalizes and validates raw JSON, and it is
 * pure (no React, no DOM), so it can be unit-tested directly.
 */

/** Bumped whenever the step/flow shape changes incompatibly. */
export const WALKTHROUGH_SCHEMA_VERSION = 1;

/**
 * Revision assumed for a flow that declares none. See `normalizeFlow`'s
 * `revision` for what the field means and why it is author-managed.
 */
export const DEFAULT_FLOW_REVISION = 1;

/** How a step decides it is finished. */
export const ADVANCE_MODES = Object.freeze([
  // The user presses "Next" in the step card. Optionally gated by `requireValue`.
  'manual',
  // The target element is clicked (a button, a tab, a kebab menu, a row).
  'targetClick',
  // The target field holds a non-empty value. NOT a trigger: this only
  // ENABLES the "Next" button — the user still presses it. A field step that
  // advanced by itself on the first typed character pulled the bubble away
  // mid-word. The rule is: acting advances (`targetClick`), typing does not.
  'targetValue',
  // The browser location starts matching `advance.route` (e.g. after a save
  // redirects `/sales-order/new` -> `/sales-order/<id>`).
  'route',
]);

/** Where the step card is drawn relative to the highlighted element. */
export const PLACEMENTS = Object.freeze([
  'auto', 'top', 'bottom', 'left', 'right', 'center',
]);

const DEFAULT_TARGET_TIMEOUT_MS = 10000;
// An OPTIONAL step waits far less before giving up. Its target is not "slow to
// arrive", it is conditionally rendered: once the screen is up the element is
// either there or it never will be. This is what makes a flow branch by DOM
// presence -- e.g. a contact form hides "Razon Social" in person mode and hides
// first/last name in company mode (ContactsBusinessPartnerForm), so each branch
// simply skips the steps that do not apply and both converge on the rest. At
// the full 10s budget three skipped steps would strand the user for half a
// minute staring at a card that is waiting for something that never comes.
const DEFAULT_OPTIONAL_TARGET_TIMEOUT_MS = 400;
const DEFAULT_NAV_TIMEOUT_MS = 8000;
const DEFAULT_SPOTLIGHT_PADDING = 8;

/**
 * How long the animated cursor takes to travel to ONE `navPath` hop.
 *
 * Deliberately slow enough to be readable: the point of animating the trip
 * through the side menu is that the user LEARNS the path and can repeat it
 * alone, which a 60ms flick does not teach. ~400-600ms per hop is the readable
 * band; 500 is the default. A flow (or a single step) may override it with
 * `navPathSpeedMs`, clamped to the band below so no flow can make the cursor
 * instantaneous (indistinguishable from a route jump) or glacial.
 */
export const DEFAULT_NAV_PATH_SPEED_MS = 500;
export const NAV_PATH_SPEED_MIN_MS = 120;
export const NAV_PATH_SPEED_MAX_MS = 3000;
/** Per-hop wait for the hop's own element. Shorter than a step's own target
 *  timeout: a menu entry either is there or the menu is not what we expect, and
 *  the fallback (a programmatic route jump) is cheap. */
const DEFAULT_NAV_HOP_TIMEOUT_MS = 4000;

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Turns the `targetTestId` shorthand into a real CSS selector. Flow authors
 * overwhelmingly want to point at a `data-testid`, and writing the escaped
 * attribute selector by hand inside JSON is noisy and error-prone.
 *
 * A `field-*` id also matches the field's `-chip` variant. This is not a
 * convenience: a searchable FK field (CreatableSearchSelect) renders EITHER an
 * `<input data-testid="field-x">` while empty OR a `<button
 * data-testid="field-x-chip">` once a record is picked -- never both. Pointing a
 * step at `field-x` alone therefore resolves only while the field is empty, and
 * a field carrying a default (contacts' "Contact Category" resolves one from
 * `@SQL=...`) is ALREADY filled by the time the step is entered, so the step
 * failed with "target not found" on a field that was plainly on screen. Both
 * shapes are the same field to a flow author, so both are the same target here.
 * Scoped to the `field-` prefix so action/menu ids do not grow a meaningless
 * alternative.
 */
export function testIdSelector(testId) {
  const base = `[data-testid="${testId}"]`;
  return String(testId).startsWith('field-') ? `${base}, [data-testid="${testId}-chip"]` : base;
}

/** Clamps an authored `navPathSpeedMs` into the readable band. */
export function clampNavPathSpeed(value, fallback = DEFAULT_NAV_PATH_SPEED_MS) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(NAV_PATH_SPEED_MAX_MS, Math.max(NAV_PATH_SPEED_MIN_MS, value));
}

function validateNavPathHop(raw, path, errors) {
  if (!isPlainObject(raw)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!isNonEmptyString(raw.target) && !isNonEmptyString(raw.targetTestId)) {
    errors.push(`${path} requires either "target" (CSS selector) or "targetTestId"`);
  }
  if (raw.optional !== undefined && typeof raw.optional !== 'boolean') {
    errors.push(`${path}.optional must be a boolean`);
  }
  if (raw.skipIf !== undefined) {
    if (!isPlainObject(raw.skipIf)) {
      errors.push(`${path}.skipIf must be an object`);
    } else if (!isNonEmptyString(raw.skipIf.target) && !isNonEmptyString(raw.skipIf.targetTestId)) {
      errors.push(`${path}.skipIf requires either "target" or "targetTestId"`);
    }
  }
}

function validateNavPath(raw, path, errors) {
  if (raw === undefined) return;
  if (!Array.isArray(raw)) {
    errors.push(`${path}.navPath must be an array`);
    return;
  }
  raw.forEach((hop, i) => validateNavPathHop(hop, `${path}.navPath[${i}]`, errors));
}

function normalizeNavPathHop(raw, speedMs) {
  return {
    target: isNonEmptyString(raw.target) ? raw.target : testIdSelector(raw.targetTestId),
    // A hop whose element never appears aborts the whole path (and falls back
    // to the programmatic route) UNLESS it is optional, in which case it is
    // simply skipped -- the "expand the side menu if it happens to be
    // collapsed" case, where the control does not exist when already expanded.
    optional: raw.optional === true,
    // "Do not click this if its effect is already visible." Menu group headers
    // TOGGLE, so clicking an already-open group would close it and hide the
    // very entry the next hop needs.
    skipIf: isPlainObject(raw.skipIf)
      ? (isNonEmptyString(raw.skipIf.target)
        ? raw.skipIf.target
        : testIdSelector(raw.skipIf.targetTestId))
      : null,
    timeoutMs: Number.isFinite(raw.timeoutMs) ? raw.timeoutMs : DEFAULT_NAV_HOP_TIMEOUT_MS,
    durationMs: clampNavPathSpeed(raw.durationMs, speedMs),
  };
}

function validateAdvance(advance, path, errors) {
  if (advance === undefined) return;
  if (!isPlainObject(advance)) {
    errors.push(`${path}.advance must be an object`);
    return;
  }
  if (advance.on !== undefined && !ADVANCE_MODES.includes(advance.on)) {
    errors.push(`${path}.advance.on must be one of ${ADVANCE_MODES.join('|')}`);
  }
  if (advance.on === 'route' && !isNonEmptyString(advance.route)) {
    errors.push(`${path}.advance.route is required when advance.on is "route"`);
  }
  if (advance.requireValue !== undefined && typeof advance.requireValue !== 'boolean') {
    errors.push(`${path}.advance.requireValue must be a boolean`);
  }
}

/**
 * Collects every problem with a raw step. Returns an array of human-readable
 * strings — empty means valid.
 */
export function validateStep(raw, path = 'step') {
  const errors = [];
  if (!isPlainObject(raw)) return [`${path} must be an object`];

  if (!isNonEmptyString(raw.id)) errors.push(`${path}.id is required`);
  if (!isNonEmptyString(raw.target) && !isNonEmptyString(raw.targetTestId)) {
    errors.push(`${path} requires either "target" (CSS selector) or "targetTestId"`);
  }
  if (!isNonEmptyString(raw.bodyKey)) errors.push(`${path}.bodyKey is required`);
  if (raw.titleKey !== undefined && !isNonEmptyString(raw.titleKey)) {
    errors.push(`${path}.titleKey must be a non-empty string when present`);
  }
  if (raw.placement !== undefined && !PLACEMENTS.includes(raw.placement)) {
    errors.push(`${path}.placement must be one of ${PLACEMENTS.join('|')}`);
  }
  if (raw.routeMatch !== undefined && !isNonEmptyString(raw.routeMatch)) {
    errors.push(`${path}.routeMatch must be a non-empty string when present`);
  }
  if (raw.route !== undefined && !isNonEmptyString(raw.route)) {
    errors.push(`${path}.route must be a non-empty string when present`);
  }
  if (raw.routeMatch !== undefined && raw.route === undefined) {
    errors.push(`${path}.routeMatch requires "route" (the concrete path to navigate to)`);
  }
  if (raw.navPathSpeedMs !== undefined && !Number.isFinite(raw.navPathSpeedMs)) {
    errors.push(`${path}.navPathSpeedMs must be a number when present`);
  }
  validateNavPath(raw.navPath, path, errors);
  // A navPath is only ever RUN when the step is off-screen, which is decided by
  // `routeMatch` -- and `routeMatch` defaults to `route`. Without a `route` the
  // navigation branch is never entered, so the navPath would be dead data. It
  // is also the documented fallback when a hop never appears.
  if (Array.isArray(raw.navPath) && raw.navPath.length > 0 && !isNonEmptyString(raw.route)) {
    errors.push(`${path}.navPath requires "route" (the fallback when a hop is unreachable)`);
  }
  validateAdvance(raw.advance, path, errors);
  return errors;
}

/**
 * Normalizes a raw step into the shape the engine consumes. Assumes the step
 * has already been validated (see `validateStep`).
 */
export function normalizeStep(raw, flowDefaults = {}) {
  const advance = isPlainObject(raw.advance) ? raw.advance : {};
  const on = ADVANCE_MODES.includes(advance.on) ? advance.on : 'manual';
  const speedMs = clampNavPathSpeed(
    raw.navPathSpeedMs,
    clampNavPathSpeed(flowDefaults.navPathSpeedMs),
  );
  return {
    id: raw.id,
    // The concrete path to navigate to when the step is not already reachable.
    route: isNonEmptyString(raw.route) ? raw.route : null,
    // The pattern that means "we are already where this step lives". Defaults
    // to `route` itself, which covers the common static-path case. A step that
    // lands on a record id (`/sales-order/new` -> `/sales-order/<id>`) declares
    // the looser pattern so a later step does not navigate back to `/new`.
    routeMatch: isNonEmptyString(raw.routeMatch)
      ? raw.routeMatch
      : (isNonEmptyString(raw.route) ? raw.route : null),
    target: isNonEmptyString(raw.target) ? raw.target : testIdSelector(raw.targetTestId),
    titleKey: isNonEmptyString(raw.titleKey) ? raw.titleKey : null,
    bodyKey: raw.bodyKey,
    placement: PLACEMENTS.includes(raw.placement) ? raw.placement : 'auto',
    advance: {
      on,
      route: isNonEmptyString(advance.route) ? advance.route : null,
      // `targetValue` is a value gate by definition; `manual` opts in.
      requireValue: on === 'targetValue' ? true : advance.requireValue === true,
    },
    // An optional step is skipped (silently, next step) when its target never
    // appears — for UI that only exists under some configurations.
    optional: raw.optional === true,
    // ON by default: if it is dimmed, it is not touchable. A stray click on a
    // greyed-out control derails the flow and leaves the user wondering why
    // nothing happened.
    //
    // Three things this does NOT block, and they are the point: the
    // spotlighted target itself (there is no scrim over the hole, so the user
    // can click into the field and type), the step card, and `Escape`. The
    // overlay also only blocks while a step is genuinely ACTIVE with a
    // measured hole — during navigation there is no hole, and a full-screen
    // block with no hole is just a frozen application.
    //
    // A step opts out with `"blockOutside": false`.
    blockOutside: raw.blockOutside !== false,
    spotlightPadding: Number.isFinite(raw.spotlightPadding)
      ? raw.spotlightPadding
      : DEFAULT_SPOTLIGHT_PADDING,
    targetTimeoutMs: Number.isFinite(raw.targetTimeoutMs)
      ? raw.targetTimeoutMs
      : (raw.optional === true
        ? DEFAULT_OPTIONAL_TARGET_TIMEOUT_MS
        : DEFAULT_TARGET_TIMEOUT_MS),
    navTimeoutMs: Number.isFinite(raw.navTimeoutMs)
      ? raw.navTimeoutMs
      : DEFAULT_NAV_TIMEOUT_MS,
    // The clicks the walkthrough performs ITSELF to reach this step's screen,
    // in order (open the side menu, click the section, click the window). It is
    // NAVIGATION ONLY by construction: the runner is reachable only from the
    // step-entry phase, never from `advance`, so the tour can never fill in a
    // field or press Save on the user's behalf.
    navPath: (Array.isArray(raw.navPath) ? raw.navPath : [])
      .filter(isPlainObject)
      .map((hop) => normalizeNavPathHop(hop, speedMs)),
    navPathSpeedMs: speedMs,
  };
}

/** Collects every problem with a raw flow. Empty array means valid. */
export function validateFlow(raw) {
  const errors = [];
  if (!isPlainObject(raw)) return ['flow must be an object'];

  const id = isNonEmptyString(raw.id) ? raw.id : null;
  if (!id) errors.push('flow.id is required');
  if (!isNonEmptyString(raw.titleKey)) errors.push(`flow(${id ?? '?'}).titleKey is required`);
  if (raw.descriptionKey !== undefined && !isNonEmptyString(raw.descriptionKey)) {
    errors.push(`flow(${id ?? '?'}).descriptionKey must be a non-empty string when present`);
  }
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== WALKTHROUGH_SCHEMA_VERSION) {
    errors.push(
      `flow(${id ?? '?'}).schemaVersion ${raw.schemaVersion} is not supported `
      + `(engine speaks ${WALKTHROUGH_SCHEMA_VERSION})`
    );
  }
  if (raw.navPathSpeedMs !== undefined && !Number.isFinite(raw.navPathSpeedMs)) {
    errors.push(`flow(${id ?? '?'}).navPathSpeedMs must be a number when present`);
  }
  if (raw.revision !== undefined && !isPositiveInteger(raw.revision)) {
    errors.push(`flow(${id ?? '?'}).revision must be a positive integer when present`);
  }
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
    errors.push(`flow(${id ?? '?'}).steps must be a non-empty array`);
    return errors;
  }

  const seen = new Set();
  raw.steps.forEach((step, i) => {
    errors.push(...validateStep(step, `flow(${id ?? '?'}).steps[${i}]`));
    if (isNonEmptyString(step?.id)) {
      if (seen.has(step.id)) errors.push(`flow(${id ?? '?'}) has duplicate step id "${step.id}"`);
      seen.add(step.id);
    }
  });
  return errors;
}

/** Normalizes a raw flow. Assumes it has already been validated. */
/** True for 1, 2, 3... -- what a revision counter is allowed to be. */
function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

/**
 * A flow with no `revision` is revision 1, so an existing flow file needs no
 * edit and a user who completed it counts as up to date.
 */
export function normalizeRevision(value) {
  return isPositiveInteger(value) ? value : DEFAULT_FLOW_REVISION;
}

export function normalizeFlow(raw) {
  return {
    id: raw.id,
    schemaVersion: WALKTHROUGH_SCHEMA_VERSION,
    titleKey: raw.titleKey,
    descriptionKey: isNonEmptyString(raw.descriptionKey) ? raw.descriptionKey : null,
    // Free-form hint for the host's launcher UI (e.g. a lucide icon name). The
    // engine never reads it — it exists so the flow list can be presented
    // without the host having to keep a parallel table keyed by flow id.
    icon: isNonEmptyString(raw.icon) ? raw.icon : null,
    // Author-managed "this flow changed" counter, for the host's launcher UI.
    // Like `icon`, the engine NEVER reads it: it exists so a launcher can tell
    // a user who completed revision 1 that revision 2 is worth another look.
    // Distinct from `schemaVersion`, which is the engine<->flow contract --
    // this is the flow<->user one. Bumped BY HAND, because only the author
    // knows whether a change altered what the tour teaches; deriving it from
    // the step ids would re-notify everyone over a cosmetic rename.
    revision: normalizeRevision(raw.revision),
    // Flow-wide cursor speed, overridable per step. See
    // `DEFAULT_NAV_PATH_SPEED_MS` for why this is a named constant.
    navPathSpeedMs: clampNavPathSpeed(raw.navPathSpeedMs),
    steps: raw.steps.map((step) => normalizeStep(step, { navPathSpeedMs: raw.navPathSpeedMs })),
  };
}

/**
 * Normalizes a list of raw flows, dropping the invalid ones.
 *
 * @returns {{flows: object[], errors: string[]}} valid flows in input order,
 *   plus every validation error found (including those of dropped flows), so a
 *   host can log them and a test can assert on them.
 */
export function normalizeFlows(rawFlows) {
  const flows = [];
  const errors = [];
  const seen = new Set();

  (Array.isArray(rawFlows) ? rawFlows : []).forEach((raw) => {
    const flowErrors = validateFlow(raw);
    if (flowErrors.length > 0) {
      errors.push(...flowErrors);
      return;
    }
    if (seen.has(raw.id)) {
      errors.push(`duplicate flow id "${raw.id}"`);
      return;
    }
    seen.add(raw.id);
    flows.push(normalizeFlow(raw));
  });

  return { flows, errors };
}

/**
 * Every locale key a flow references (flow title/description + each step's
 * title/body). Used by the launcher, and by the i18n coverage test that asserts
 * no flow can ship a key that is missing from a shipped locale.
 */
export function collectFlowLabelKeys(flow) {
  const keys = [];
  if (isNonEmptyString(flow?.titleKey)) keys.push(flow.titleKey);
  if (isNonEmptyString(flow?.descriptionKey)) keys.push(flow.descriptionKey);
  (flow?.steps ?? []).forEach((step) => {
    if (isNonEmptyString(step?.titleKey)) keys.push(step.titleKey);
    if (isNonEmptyString(step?.bodyKey)) keys.push(step.bodyKey);
  });
  return keys;
}

/**
 * Finds flow label keys that are absent from a locale dictionary.
 *
 * This is the testable half of the "a hint must never render as a raw key"
 * requirement: `resolveStepText` guarantees a client never SEES a raw key, and
 * this function guarantees a test can FAIL when one is missing from a locale.
 *
 * @param {object[]} flows normalized flows
 * @param {object} dictionary a locale dictionary (`{genericLabels: {...}}`)
 * @returns {{flowId: string, key: string}[]}
 */
export function findMissingFlowLabelKeys(flows, dictionary) {
  const labels = dictionary?.genericLabels ?? {};
  const missing = [];
  (Array.isArray(flows) ? flows : []).forEach((flow) => {
    collectFlowLabelKeys(flow).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(labels, key)) {
        missing.push({ flowId: flow.id, key });
      }
    });
  });
  return missing;
}
