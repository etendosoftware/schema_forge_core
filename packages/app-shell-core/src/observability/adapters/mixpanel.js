/**
 * Mixpanel adapter for the telemetry gateway (ETP-4578, PRD WS-3).
 *
 * The SDK is INJECTED through `loadSdk` (the host passes `() => import('mixpanel-browser')`),
 * so this package never imports a provider SDK and the SDK is only fetched when the
 * provider is enabled and first used.
 *
 * Mixpanel adds its own properties to every event after the gateway has sanitized it:
 * `$current_url` (with the full query string), `$referrer`, persisted `$initial_referrer`,
 * marketing parameters and whatever was registered as a super-property. Two layers close
 * that egress:
 *  - `property_blacklist` removes raw URLs, referrers and marketing parameters inside the
 *    SDK's own `track()`. It is the only layer that also covers the events the SDK sends
 *    with `skip_hooks` (the `$identify` event emitted by `identify()`), and it removes values
 *    persisted in cookies by earlier sessions.
 *  - the `before_send_events` / `_people` / `_groups` hooks rebuild the final payload from
 *    an explicit list: host properties through the gateway allowlist, SDK identity, and the
 *    approved SDK defaults. URLs, when kept at all, are re-added as a normalized path.
 *
 * Configurable from the host, with conservative defaults while D6/D7 are open: the approved
 * SDK defaults, whether URL properties travel as a normalized path or not at all, and IP
 * geolocation (off). The organization name (`$name` on a group) only goes out if the host
 * adds it to the allowlist (D6).
 */
import { normalizeRoute, sanitizeValue } from '../sanitize.js';
import { compact, pickScalars, safeWarn, sanitizeText } from './shared.js';

/** SDK-generated identifiers the endpoint needs; copied as-is (the project token is public). */
const EVENT_IDENTITY = ['token', 'distinct_id', '$device_id', '$insert_id', 'time'];
const PEOPLE_IDENTITY = ['$token', '$distinct_id', '$device_id', '$user_id', '$had_persisted_distinct_id'];
const GROUP_IDENTITY = ['$token', '$group_key', '$group_id'];

/** SDK defaults approved on events unless the host passes its own list (D7). */
export const DEFAULT_APPROVED_SDK_PROPERTIES = [
  'mp_lib', '$lib_version', '$os', '$browser', '$browser_version', '$device',
  '$screen_height', '$screen_width', '$duration',
];

/** SDK defaults approved on people updates (the SDK's own `people_properties`). */
export const DEFAULT_APPROVED_PEOPLE_PROPERTIES = ['$os', '$browser', '$browser_version'];

/** Removed by the SDK itself before any hook runs, on every send path. */
export const MIXPANEL_PROPERTY_BLACKLIST = [
  '$current_url', '$referrer', '$referring_domain', '$initial_referrer', '$initial_referring_domain',
  '$search_engine', 'mp_keyword',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
  'utm_source_platform', 'utm_campaign_id', 'utm_creative_format', 'utm_marketing_tactic',
  'dclid', 'fbclid', 'gclid', 'ko_click_id', 'li_fat_id', 'msclkid', 'sccid', 'ttclid', 'twclid', 'wbraid',
];

// Mixpanel-only, one-time-per-browser flag, kept byte-for-byte from the host provider so a
// browser that already shed its stale identity is not reset again. Browsers identify()'d
// with a real username/email before the ETP-4352 GDPR remediation keep that distinct_id in
// the SDK's storage until something clears it; this makes each browser get exactly one
// reset() and then leaves its anonymous id alone.
const IDENTITY_RESET_FLAG_KEY = 'sf_mixpanel_identity_reset_v1';

function isOptedIn(value) {
  return value === true || value === 'true';
}

function readResetFlag(storage) {
  try {
    return storage?.getItem?.(IDENTITY_RESET_FLAG_KEY) ?? null;
  } catch {
    return null; // Storage inaccessible: treat as "not reset yet"; the retry is harmless.
  }
}

function writeResetFlag(storage) {
  try {
    storage?.setItem?.(IDENTITY_RESET_FLAG_KEY, '1');
  } catch {
    // Retry the (harmless) reset next load rather than leave a stale identity behind.
  }
}

function resolvePolicy(policy = {}) {
  const allowedKeys = Array.from(policy.allowedKeys ?? []);
  const trustedKeys = Array.from(policy.trustedKeys ?? []);
  const limits = policy.limits ?? {};
  return {
    options: { ...limits, allowedKeys, trustedKeys },
    eventOptions: { ...limits, allowedKeys: [...allowedKeys, ...(policy.approvedSdkProperties ?? DEFAULT_APPROVED_SDK_PROPERTIES)], trustedKeys },
    peopleOptions: { ...limits, allowedKeys: [...allowedKeys, ...(policy.approvedPeopleProperties ?? DEFAULT_APPROVED_PEOPLE_PROPERTIES)], trustedKeys },
    urlPropertyMode: policy.urlPropertyMode ?? 'path',
    currentUrl: policy.currentUrl,
    referrer: policy.referrer,
  };
}

/**
 * A URL reduced to its normalized path (query, fragment and record ids gone), or undefined.
 * With `sameOriginAs`, a URL from another origin yields undefined: even its bare path would
 * tell Mixpanel where a person came from (a mail client, a search engine).
 */
function toNormalizedPath(readUrl, resolved, sameOriginAs) {
  try {
    const raw = typeof readUrl === 'function' ? readUrl() : undefined;
    if (typeof raw !== 'string' || raw.length === 0) return undefined;
    const url = new URL(raw);
    if (sameOriginAs) {
      const own = typeof sameOriginAs === 'function' ? sameOriginAs() : undefined;
      if (typeof own !== 'string' || new URL(own).origin !== url.origin) return undefined;
    }
    return sanitizeText(normalizeRoute(url.pathname), resolved.options);
  } catch {
    return undefined;
  }
}

/** Keys the SDK manages itself (`$device_id`, `__mps`, …); never removed or filtered as data. */
const isSdkInternalKey = (key) => key.startsWith('$') || key.startsWith('__');

/**
 * Filters a super-property object (what `register`/`register_once` persist and attach to
 * every later event and to `$identify`, which skips the send hooks): approved host keys,
 * SDK identity and approved SDK defaults survive; the SDK's own `$`/`__` keys too, except
 * the ones the property blacklist exists to remove.
 */
export function sanitizeMixpanelSuperProperties(props, policy = {}) {
  const resolved = resolvePolicy(policy);
  const approved = new Set(resolved.eventOptions.allowedKeys);
  const out = {};
  for (const [key, value] of Object.entries(props && typeof props === 'object' ? props : {})) {
    if (MIXPANEL_PROPERTY_BLACKLIST.includes(key)) continue;
    if (approved.has(key) || EVENT_IDENTITY.includes(key) || PEOPLE_IDENTITY.includes(key) || isSdkInternalKey(key)) {
      out[key] = value;
    }
  }
  return sanitizeValue(out, { ...resolved.eventOptions, allowedKeys: Object.keys(out) });
}

/** Persisted super-property keys an earlier build (or an earlier policy) left behind. */
function staleSuperPropertyKeys(client, policy) {
  const persisted = client?.persistence?.properties?.();
  if (!persisted || typeof persisted !== 'object') return [];
  const keep = sanitizeMixpanelSuperProperties(persisted, policy);
  return Object.keys(persisted).filter((key) => !(key in keep));
}

function sanitizeOperations(data, resolved, options) {
  return compact({
    $set: data?.$set ? sanitizeValue(data.$set, options) : undefined,
    $set_once: data?.$set_once ? sanitizeValue(data.$set_once, options) : undefined,
    $unset: Array.isArray(data?.$unset)
      ? data.$unset.filter((name) => typeof name === 'string' && options.allowedKeys.includes(name))
      : undefined,
  });
}

/** Rebuilds `{ event, properties }` as `before_send_events` receives it. */
export function sanitizeMixpanelEvent(data, policy = {}) {
  const resolved = resolvePolicy(policy);
  const properties = data?.properties ?? {};
  const urls = resolved.urlPropertyMode === 'path'
    ? { $current_url: toNormalizedPath(resolved.currentUrl, resolved), $referrer: toNormalizedPath(resolved.referrer, resolved, resolved.currentUrl) }
    : {};
  return {
    event: sanitizeText(data?.event, resolved.options),
    properties: compact({
      ...sanitizeValue(properties, resolved.eventOptions),
      ...pickScalars(properties, EVENT_IDENTITY),
      ...urls,
    }),
  };
}

/** Rebuilds a people update: SDK identity plus allowlisted `$set`/`$set_once`/`$unset`. */
export function sanitizeMixpanelPeople(data, policy = {}) {
  const resolved = resolvePolicy(policy);
  return { ...pickScalars(data, PEOPLE_IDENTITY), ...sanitizeOperations(data, resolved, resolved.peopleOptions) };
}

/** Rebuilds a group update; a group trait (e.g. `$name`) needs to be in the allowlist (D6). */
export function sanitizeMixpanelGroup(data, policy = {}) {
  const resolved = resolvePolicy(policy);
  return { ...pickScalars(data, GROUP_IDENTITY), ...sanitizeOperations(data, resolved, resolved.options) };
}

/**
 * @param {object} options
 * @param {() => Promise<object>} options.loadSdk Resolves the `mixpanel-browser` module.
 * @param {boolean|string} [options.enabled] Explicit opt-in; off by default (D3).
 * @param {string} [options.token]
 * @param {string} [options.apiHost]
 * @param {boolean|string} [options.debug]
 * @param {boolean} [options.trackIp] IP geolocation; off by default (D7).
 * @param {'cookie'|'localStorage'} [options.persistence] Where the SDK keeps its identity and
 *   super-properties. `cookie` is the SDK default and is not governed by cookie consent; the
 *   host may choose `localStorage`.
 * @param {Iterable<string>} [options.allowedKeys] The gateway allowlist.
 * @param {Iterable<string>} [options.trustedKeys] Subset of `allowedKeys` exempt from the
 *   sensitive-key-name rule.
 * @param {Iterable<string>} [options.approvedSdkProperties]
 * @param {Iterable<string>} [options.approvedPeopleProperties]
 * @param {'path'|'drop'} [options.urlPropertyMode] URLs as a normalized path, or not at all.
 * @param {() => string} [options.currentUrl] Defaults to `location.href`.
 * @param {() => string} [options.referrer] Defaults to `document.referrer`.
 * @param {Storage} [options.storage] For the one-time identity reset flag.
 * @param {object} [options.limits] Forwarded to `sanitizeValue()`.
 * @param {{warn?: Function}} [options.logger]
 */
export function createMixpanelAdapter({
  loadSdk,
  enabled = false,
  token,
  apiHost,
  debug = false,
  trackIp = false,
  persistence = 'cookie',
  allowedKeys,
  trustedKeys,
  approvedSdkProperties,
  approvedPeopleProperties,
  urlPropertyMode,
  currentUrl = () => globalThis.location?.href,
  referrer = () => globalThis.document?.referrer,
  storage = globalThis.localStorage,
  limits,
  logger = console,
} = {}) {
  const optedIn = isOptedIn(enabled);
  const providerEnabled = optedIn && Boolean(token);
  if (optedIn && !token) {
    safeWarn(logger, '[observability] Mixpanel is enabled but VITE_MIXPANEL_TOKEN is missing');
  }

  const policy = { allowedKeys, trustedKeys, approvedSdkProperties, approvedPeopleProperties, urlPropertyMode, currentUrl, referrer, limits };
  // After a hot kill every hook drops its payload: nothing leaves, including requests the
  // SDK already queued. (opt_out_tracking() is not used: it persists across sessions and
  // opting back in sends an `$opt_in` event.)
  let stopped = false;
  let clientPromise;

  function hook(name, sanitize, fallback = () => null) {
    return (payload) => {
      if (stopped) return fallback();
      try {
        return sanitize(payload, policy);
      } catch (error) {
        safeWarn(logger, `[observability] mixpanel.${name} dropped a payload it could not sanitize`, error);
        return fallback();
      }
    };
  }

  function sdkConfig() {
    return compact({
      debug: isOptedIn(debug),
      api_host: apiHost || undefined,
      batch_requests: false,
      ip: Boolean(trackIp),
      track_pageview: false,
      autocapture: false,
      record_sessions_percent: 0,
      record_heatmap_data: false,
      track_marketing: false,
      save_referrer: false,
      persistence,
      property_blacklist: MIXPANEL_PROPERTY_BLACKLIST,
      hooks: {
        before_send_events: hook('before_send_events', sanitizeMixpanelEvent),
        before_send_people: hook('before_send_people', sanitizeMixpanelPeople),
        before_send_groups: hook('before_send_groups', sanitizeMixpanelGroup),
        // register() persists properties that ride on EVERY later event and on `$identify`,
        // which skips the send hooks entirely: they are filtered here, when they are stored.
        before_register: hook('before_register', sanitizeMixpanelSuperProperties, () => ({})),
        before_register_once: hook('before_register_once', sanitizeMixpanelSuperProperties, () => ({})),
      },
    });
  }

  // Must run after client.init(): reset() touches persistence that init() sets up.
  function resetStaleIdentityOnce(client) {
    if (readResetFlag(storage)) return;
    if (typeof client?.reset !== 'function') return;
    try {
      client.reset();
      writeResetFlag(storage);
    } catch (error) {
      safeWarn(logger, '[observability] Mixpanel stale-identity reset failed', error);
    }
  }

  // Single gate every method goes through: loads and initializes the SDK once and runs the
  // one-time reset in the same cached chain, so no SDK call can ever precede the reset.
  function getClient() {
    if (!providerEnabled) return Promise.resolve(undefined);
    if (!clientPromise) {
      clientPromise = Promise.resolve()
        .then(() => loadSdk())
        .then((module) => module?.default ?? module)
        .then((client) => {
          client.init(token, sdkConfig());
          resetStaleIdentityOnce(client);
          for (const key of staleSuperPropertyKeys(client, policy)) client.unregister?.(key);
          return client;
        });
      // A failed load (a chunk that did not download, a bad init) must not be cached, or
      // every later call would fail for the rest of the session.
      clientPromise.catch(() => { clientPromise = undefined; });
    }
    return clientPromise;
  }

  /**
   * The client, or undefined when the adapter is off. Checked after the await on purpose: a
   * kill landing while the SDK was loading must still stop the call, and `$identify` skips
   * the hooks, so the hooks alone cannot.
   */
  async function liveClient() {
    const client = await getClient();
    return stopped ? undefined : client;
  }

  return {
    name: 'mixpanel',
    enabled: providerEnabled,

    async init() {
      stopped = false;
      await getClient();
    },

    async shutdown() {
      stopped = true;
    },

    async track(eventName, properties = {}, { context } = {}) {
      const client = await liveClient();
      if (typeof client?.track !== 'function') return;
      await new Promise((resolve) => {
        const queued = client.track(eventName, { ...(context ?? {}), ...properties }, {}, resolve);
        // A payload a hook dropped is never called back: do not wait for it.
        if (!queued) resolve();
      });
    },

    async page(route, properties = {}, { context } = {}) {
      const client = await liveClient();
      if (typeof client?.track !== 'function') return;
      client.track('page_view', { ...(context ?? {}), ...properties, route, routePattern: route });
    },

    async identify(userId, traits = {}) {
      const client = await liveClient();
      if (typeof client?.identify === 'function') client.identify(userId);
      if (typeof client?.people?.set === 'function') client.people.set(traits);
    },

    async group(groupKey, groupId) {
      const client = await liveClient();
      if (typeof client?.set_group !== 'function') return;
      client.set_group(groupKey, groupId);
      // set_group() registers group_ids as an array super-property; membership is 1:1 by
      // design, so force the scalar back (see the host provider this replaces).
      if (typeof client.register === 'function') client.register({ [groupKey]: groupId });
    },

    async groupSet(groupKey, groupId, properties = {}) {
      const client = await liveClient();
      const group = client?.get_group?.(groupKey, groupId);
      if (typeof group?.set === 'function') group.set(properties);
    },

    async reset() {
      const client = await liveClient();
      if (typeof client?.reset === 'function') client.reset();
    },

    async flush() {
      const client = await liveClient();
      if (typeof client?.flush === 'function') await client.flush();
    },
  };
}
