/**
 * Catalog of the usage events the UI may emit (ETP-5462, plan decisions D4 + D5).
 *
 * Every entry declares WHERE it goes, so a call site instruments once and
 * `trackUsage()` fans the event out to the declared destinations:
 *
 * - `table` — `POST /sws/neo/usage` → `ETGO_USAGE_EVENT`. The server only accepts the types listed
 *   in `com.etendoerp.go.usageevents.UsageEventTypes` and silently drops the rest, so an entry
 *   with this destination MUST also be added there, in the same change.
 * - `mixpanel` — handed to the host's observability layer through
 *   `ObservabilityContext.trackUsageEvent`. The core never talks to Mixpanel itself.
 *
 * There is no automatic mirroring (D5): an event reaches Mixpanel only when its entry says so.
 * A type that is not in this catalog is ignored — nothing is sent anywhere.
 *
 * The catalog starts empty on purpose. The only server types agreed so far (`ai.agent.message`,
 * `ai.support.message`) are recorded server-side, never from the browser, because they carry
 * cost data a UI could forge (plan §9.1). UI events are added here as they are agreed (plan §9).
 *
 * Adding an event:
 *   1. Agree it: it must answer a product question nobody can already answer (plan §9).
 *   2. Add a `defineUsageEvent(...)` entry below (lower-case, dot-separated name, ≤ 60 chars).
 *   3. If it goes to the table, add the same name to `UsageEventTypes.KNOWN` in com.etendoerp.go.
 */

export const USAGE_DESTINATIONS = Object.freeze({
  TABLE: 'table',
  MIXPANEL: 'mixpanel',
});

const VALID_DESTINATIONS = new Set(Object.values(USAGE_DESTINATIONS));

/** Same shape the server enforces (`UsageEventTypes.PATTERN`). */
export const USAGE_EVENT_TYPE_PATTERN = /^[a-z][a-z0-9_.]{1,59}$/;

export function defineUsageEvent(name, { destinations = [] } = {}) {
  if (!USAGE_EVENT_TYPE_PATTERN.test(name)) {
    throw new Error(`Invalid usage event type: ${name}`);
  }
  const unknown = destinations.filter((d) => !VALID_DESTINATIONS.has(d));
  if (unknown.length > 0 || destinations.length === 0) {
    throw new Error(`Usage event ${name} needs destinations from ${[...VALID_DESTINATIONS].join(', ')}`);
  }
  return Object.freeze({ name, destinations: Object.freeze([...new Set(destinations)]) });
}

export const USAGE_EVENTS = Object.freeze({});

/** @returns {Map<string, {name: string, destinations: readonly string[]}>} */
export function buildUsageCatalog(events = Object.values(USAGE_EVENTS)) {
  return new Map(events.map((event) => [event.name, event]));
}
