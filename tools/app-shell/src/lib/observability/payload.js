const DENYLISTED_PROPERTY_KEYS = new Set([
  'authCode',
  'authorization',
  'businessPartner',
  'businessPartnerName',
  'code',
  'documentId',
  'documentNo',
  'hash',
  'id',
  'label',
  'name',
  'oauthState',
  'query',
  'rawUrl',
  'recordId',
  'search',
  'state',
  'token',
  'url',
]);

const SAFE_EVENT_PROPERTY_KEYS = new Set([
  'action',
  'app',
  'component',
  'enabled',
  'environment',
  'event',
  'hostname',
  'locale',
  'mockMode',
  'provider',
  'route',
  'routePattern',
  'source',
  'status',
  'timestamp',
  'type',
  'windowName',
]);

function toPathname(value = '/') {
  const raw = String(value || '/');

  try {
    return new URL(raw, 'https://observability.local').pathname || '/';
  } catch {
    return raw.split(/[?#]/, 1)[0] || '/';
  }
}

function sanitizeSegment(segment) {
  return Array.from(segment)
    .filter(char => isAllowedRouteChar(char))
    .join('');
}

function isAllowedRouteChar(char) {
  return isAlphaNumeric(char) || ['.', '_', '~', '-'].includes(char);
}

function isAlphaNumeric(char) {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
}

function isHexChar(char) {
  const code = char.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 97 && code <= 102);
}

function isNumericId(segment) {
  return segment.length > 0 && Array.from(segment).every(char => {
    const code = char.charCodeAt(0);
    return code >= 48 && code <= 57;
  });
}

function isHexId(segment) {
  const compact = segment.replaceAll('-', '').toLowerCase();
  return compact.length >= 16 && Array.from(compact).every(isHexChar);
}

function isOpaqueId(segment) {
  return segment.length >= 12 && Array.from(segment).every(char => (
    isAlphaNumeric(char) || char === '_' || char === '-'
  ));
}

function isRecordDetailRoute(segments) {
  return segments.length === 2 && segments[0] !== 'artifacts';
}

function isDynamicSegment(segment) {
  return isNumericId(segment) || isHexId(segment) || isOpaqueId(segment);
}

export function normalizeRoute(value = '/') {
  const pathname = toPathname(value);
  const segments = pathname
    .split('/')
    .map(sanitizeSegment)
    .filter(Boolean);

  if (segments.length === 0) return '/';

  const normalized = segments.map((segment, index) => {
    if (isRecordDetailRoute(segments) && index === 1) return ':recordId';
    if (index > 0 && isDynamicSegment(segment)) return ':id';
    return segment;
  });

  return `/${normalized.join('/')}`;
}

export function extractWindowName(route = '/') {
  const [firstSegment] = normalizeRoute(route).split('/').filter(Boolean);
  return firstSegment && !firstSegment.startsWith(':') ? firstSegment : undefined;
}

export function sanitizeEventProperties(properties = {}) {
  const sanitized = {};

  for (const [key, value] of Object.entries(properties ?? {})) {
    if (DENYLISTED_PROPERTY_KEYS.has(key) || !SAFE_EVENT_PROPERTY_KEYS.has(key)) continue;
    if (value == null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function buildEventPayload({
  properties = {},
  context = {},
  metadata = {},
  route,
  timestamp = new Date().toISOString(),
} = {}) {
  const normalizedRoute = route ? normalizeRoute(route) : undefined;
  const safeProperties = sanitizeEventProperties(properties);
  const safeContext = sanitizeEventProperties(context);
  const safeMetadata = sanitizeEventProperties(metadata);
  const windowName = normalizedRoute ? extractWindowName(normalizedRoute) : undefined;

  return {
    ...safeMetadata,
    ...safeContext,
    ...safeProperties,
    timestamp,
    ...(normalizedRoute ? { route: normalizedRoute, routePattern: normalizedRoute } : {}),
    ...(windowName ? { windowName } : {}),
  };
}
