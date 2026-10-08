import { normalizeText } from './resolveDependentEntity.js';

const resolvers = new Map();

// In-flight and settled answers of this import run, keyed by resolver + normalised value +
// session token. Holds the PROMISE, so concurrent workers asking for the same value share one
// call instead of each firing their own (ETP-5676).
const memo = new Map();

/** Forget every memoised resolution. Called when a new file is loaded (see `importRunState`). */
export function resetFkResolverMemo() {
  memo.clear();
}

/** The preview's answer for this raw value, only when it is a definitive match. */
function previewedResolution(fkResolutions, target, raw) {
  if (!fkResolutions || !target) return null;
  const resolution = fkResolutions.get?.(target)?.get?.(raw);
  return resolution?.status === 'auto-resolved' ? resolution : null;
}

function memoised(name, fn, value, context) {
  const key = [name, normalizeText(value), context.token ?? ''].join('|');
  if (memo.has(key)) return memo.get(key);
  const pending = Promise.resolve(fn(value, context));
  memo.set(key, pending);
  // A failure is not a result worth remembering: evict it so a retry is a real retry. The
  // identity check keeps a newer promise stored under the same key after a reset.
  pending.catch(() => {
    if (memo.get(key) === pending) memo.delete(key);
  });
  return pending;
}

/**
 * Register a custom foreign-key resolver under a name a composite descriptor can look
 * up by string (same pattern as `buildOperations.js`'s descriptor registry). Exists
 * because some FK columns can't be resolved independently by distinct value — e.g. a
 * region name means different things depending on which country a row already
 * resolved to — so they opt out of the generic `resolveForeignKeys` distinct-value
 * batching entirely and are resolved by the composite descriptor itself, one value (and
 * whatever extra context it needs, e.g. an already-resolved country id) at a time.
 *
 * The registered function is wrapped so that, at send time, a call:
 *  1. returns the preview's auto-resolved answer when the context carries `fkResolutions`
 *     (the dialog's `Map<target, Map<rawValue, resolution>>`, popover picks included) and the
 *     value is in it — no network. `target` comes from `options.target` or `context.target`;
 *  2. otherwise is memoised per run, so N rows sharing one unpreviewed value cost one call.
 *
 * @param {string} name
 * @param {Function} fn `(value, context) => Promise<resolution>`
 * @param {{ target?: string }} [options] import-field target whose preview answer applies
 */
export function registerFkResolver(name, fn, options = {}) {
  const wrapped = (value, context = {}) => {
    const raw = String(value ?? '').trim();
    if (raw === '') return Promise.resolve(fn(value, context));
    const previewed = previewedResolution(context.fkResolutions, context.target ?? options.target, raw);
    if (previewed) return Promise.resolve(previewed);
    return memoised(name, fn, value, context);
  };
  resolvers.set(name, wrapped);
}

export function getFkResolver(name) {
  return resolvers.get(name);
}
