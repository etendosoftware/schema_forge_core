const KPI_PROPERTY_KEYS = new Set([
  'action',
  'attempt',
  'channel',
  'component',
  'correctCount',
  'count',
  'critical',
  'durationMs',
  'entityType',
  'errorClass',
  'flow',
  'kpiId',
  'module',
  'position',
  'provider',
  'score',
  'source',
  'status',
  'step',
  'total',
  'type',
  'value',
]);

const KPI_MODULES = new Set([
  'accounting',
  'copilot',
  'contacts',
  'dashboard',
  'fixed_assets',
  'inventory',
  'onboarding',
  'products',
  'purchases',
  'sales',
  'transversal',
]);

const KPI_CHANNELS = new Set([
  'automatic',
  'email',
  'manual',
  'ocr',
  'purchase_invoice',
  'system',
  'system_email',
]);

const KPI_STATUSES = new Set([
  'abandoned',
  'blocked',
  'failed',
  'partial',
  'started',
  'success',
]);

const SNAKE_CASE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const KPI_ID = /^kpi_[a-z0-9]+(?:_[a-z0-9]+)*$/;

const KPI_NUMERIC_RANGES = new Map([
  ['attempt', { min: 0, max: 1000 }],
  ['correctCount', { min: 0, max: 1000000000 }],
  ['count', { min: 0, max: 1000000000 }],
  ['durationMs', { min: 0, max: 86400000 }],
  ['position', { min: 0, max: 1000000 }],
  ['score', { min: 0, max: 100 }],
  ['step', { min: 0, max: 1000 }],
  ['total', { min: 0, max: 1000000000 }],
  ['value', { min: -1000000000, max: 1000000000 }],
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSafeToken(value, pattern = SNAKE_CASE) {
  return typeof value === 'string' && pattern.test(value);
}

function isSafePrimitive(value) {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function shouldKeepProperty(key, value) {
  if (!KPI_PROPERTY_KEYS.has(key) || value == null || !isSafePrimitive(value)) return false;

  if (KPI_NUMERIC_RANGES.has(key)) return isSafeNumberForKey(key, value);

  if (key === 'kpiId') return isSafeToken(value, KPI_ID);
  if (key === 'module') return KPI_MODULES.has(value);
  if (key === 'channel') return KPI_CHANNELS.has(value);
  if (key === 'status') return KPI_STATUSES.has(value);
  if (['action', 'component', 'entityType', 'errorClass', 'flow', 'provider', 'source', 'type'].includes(key)) {
    return isSafeToken(value);
  }

  return true;
}

function isSafeNumberForKey(key, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;

  const range = KPI_NUMERIC_RANGES.get(key);
  return value >= range.min && value <= range.max;
}

export function buildKpiProperties(properties = {}) {
  if (!isPlainObject(properties)) return {};

  const safeProperties = {};

  for (const [key, value] of Object.entries(properties)) {
    if (shouldKeepProperty(key, value)) {
      safeProperties[key] = value;
    }
  }

  return safeProperties;
}

export async function trackKpiEvent(trackFn, eventName, properties = {}) {
  if (typeof trackFn !== 'function' || !isSafeToken(eventName)) return undefined;

  const safeProperties = buildKpiProperties(properties);
  return trackFn(eventName, safeProperties);
}
