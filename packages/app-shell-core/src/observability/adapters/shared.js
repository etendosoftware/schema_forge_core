/**
 * Helpers shared by the provider adapters (ETP-4578). The adapters rebuild each provider
 * payload field by field from an explicit list — never by copying the SDK's object and
 * deleting known-bad fields — so a field the SDK adds in a future version is dropped by
 * default instead of leaking by default.
 */
import { sanitizeValue } from '../sanitize.js';

/** A string scrubbed like any other value, or undefined for anything that is not a string. */
export function sanitizeText(value, options) {
  return typeof value === 'string' ? sanitizeValue(value, options) : undefined;
}

/** Copies the listed keys whose values are primitive identifiers/scalars; drops the rest. */
export function pickScalars(source, keys) {
  const out = {};
  if (!source || typeof source !== 'object') return out;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' ? Number.isFinite(value) : ['string', 'boolean'].includes(typeof value)) {
      out[key] = value;
    }
  }
  return out;
}

/** Keeps only `{ value: number, unit?: string }` entries, the shape of SDK measurements. */
export function pickMeasurements(measurements) {
  const out = {};
  if (!measurements || typeof measurements !== 'object') return undefined;
  for (const [name, entry] of Object.entries(measurements)) {
    if (entry && Number.isFinite(entry.value)) {
      out[name] = typeof entry.unit === 'string' ? { value: entry.value, unit: entry.unit } : { value: entry.value };
    }
  }
  return out;
}

/** Drops undefined members so a rebuilt payload carries no empty placeholders. */
export function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

export function safeWarn(logger, ...args) {
  try {
    if (typeof logger?.warn === 'function') logger.warn(...args);
  } catch {
    // A broken logger must not break a provider hook.
  }
}
