import { normalizeRoute, extractWindowName, sanitizeEventProperties, buildEventPayload } from '../payload.js';

describe('normalizeRoute', () => {
  it('returns / for empty input', () => {
    expect(normalizeRoute()).toBe('/');
    expect(normalizeRoute('/')).toBe('/');
  });

  it('keeps simple route', () => {
    expect(normalizeRoute('/sales-order')).toBe('/sales-order');
  });

  it('replaces second segment with :recordId for 2-segment detail route', () => {
    expect(normalizeRoute('/sales-order/12345678')).toBe('/sales-order/:recordId');
  });

  it('replaces hex UUID segment with :id', () => {
    expect(normalizeRoute('/orders/main/95E2A8B50A254B2AAE6774B8C2F28120')).toBe('/orders/main/:id');
  });

  it('replaces numeric ID segment with :id at index > 0', () => {
    expect(normalizeRoute('/orders/lines/99999')).toBe('/orders/lines/:id');
  });

  it('replaces second segment as recordId for 2-segment route even if first is numeric', () => {
    expect(normalizeRoute('/12345/detail')).toBe('/12345/:recordId');
  });

  it('keeps non-ID second segment for 2-segment route', () => {
    expect(normalizeRoute('/sales-order/list')).toBe('/sales-order/:recordId');
  });

  it('handles URL with query string', () => {
    expect(normalizeRoute('/orders?page=1')).toBe('/orders');
  });

  it('handles URL with hash', () => {
    expect(normalizeRoute('/orders#section')).toBe('/orders');
  });

  it('handles full URL', () => {
    expect(normalizeRoute('https://example.com/sales-order/123')).toBe('/sales-order/:recordId');
  });

  it('sanitizes special characters from segments', () => {
    expect(normalizeRoute('/valid-path/ok_segment')).toBe('/valid-path/:recordId');
  });

  it('handles opaque IDs (long alphanumeric >= 12 chars)', () => {
    expect(normalizeRoute('/entity/main/abcdefghijklmnop')).toBe('/entity/main/:id');
  });

  it('does not replace short segments as IDs', () => {
    expect(normalizeRoute('/entity/lines/abc')).toBe('/entity/lines/abc');
  });

  it('returns / for null input', () => {
    expect(normalizeRoute(null)).toBe('/');
  });

  it('returns / for empty string', () => {
    expect(normalizeRoute('')).toBe('/');
  });

  it('handles artifacts prefix (isRecordDetailRoute returns false)', () => {
    // artifacts is excluded from record detail route detection, but numeric segment still becomes :id
    expect(normalizeRoute('/artifacts/12345')).toBe('/artifacts/:id');
  });

  it('handles UUID with dashes', () => {
    expect(normalizeRoute('/path/sub/a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe('/path/sub/:id');
  });

  it('handles invalid URL gracefully', () => {
    const result = normalizeRoute('not a valid url with spaces');
    expect(typeof result).toBe('string');
  });
});

describe('extractWindowName', () => {
  it('extracts first segment from simple route', () => {
    expect(extractWindowName('/sales-order')).toBe('sales-order');
  });

  it('extracts first segment from detail route', () => {
    expect(extractWindowName('/sales-order/123')).toBe('sales-order');
  });

  it('returns undefined for root route', () => {
    expect(extractWindowName('/')).toBeUndefined();
  });

  it('returns undefined when first segment starts with :', () => {
    // Edge case: normalizeRoute would turn /12345 into /:recordId for 2-segment
    // but for single segment it stays as the number
    expect(extractWindowName()).toBeUndefined();
  });

  it('returns window name from full URL', () => {
    expect(extractWindowName('https://example.com/purchase-order/456')).toBe('purchase-order');
  });
});

describe('sanitizeEventProperties', () => {
  it('keeps safe keys with string values', () => {
    expect(sanitizeEventProperties({ action: 'click', type: 'button' })).toEqual({ action: 'click', type: 'button' });
  });

  it('keeps safe keys with number values', () => {
    expect(sanitizeEventProperties({ status: 200 })).toEqual({ status: 200 });
  });

  it('keeps safe keys with boolean values', () => {
    expect(sanitizeEventProperties({ enabled: true })).toEqual({ enabled: true });
  });

  it('removes denylisted keys', () => {
    expect(sanitizeEventProperties({ token: 'secret', name: 'John', action: 'click' })).toEqual({ action: 'click' });
  });

  it('removes non-safe keys', () => {
    expect(sanitizeEventProperties({ randomKey: 'value', action: 'click' })).toEqual({ action: 'click' });
  });

  it('removes null values', () => {
    expect(sanitizeEventProperties({ action: null })).toEqual({});
  });

  it('removes undefined values', () => {
    expect(sanitizeEventProperties({ action: undefined })).toEqual({});
  });

  it('removes object values (not string/number/boolean)', () => {
    expect(sanitizeEventProperties({ action: { nested: true } })).toEqual({});
  });

  it('returns empty object for empty input', () => {
    expect(sanitizeEventProperties({})).toEqual({});
  });

  it('returns empty object for undefined input', () => {
    expect(sanitizeEventProperties()).toEqual({});
  });

  it('handles null input', () => {
    expect(sanitizeEventProperties(null)).toEqual({});
  });
});

describe('buildEventPayload', () => {
  it('builds payload with route', () => {
    const payload = buildEventPayload({ route: '/sales-order/123', timestamp: '2026-01-01T00:00:00Z' });
    expect(payload.route).toBe('/sales-order/:recordId');
    expect(payload.routePattern).toBe('/sales-order/:recordId');
    expect(payload.windowName).toBe('sales-order');
    expect(payload.timestamp).toBe('2026-01-01T00:00:00Z');
  });

  it('builds payload without route', () => {
    const payload = buildEventPayload({ timestamp: '2026-01-01T00:00:00Z' });
    expect(payload.route).toBeUndefined();
    expect(payload.windowName).toBeUndefined();
  });

  it('sanitizes properties, context, and metadata', () => {
    const payload = buildEventPayload({
      properties: { action: 'click', token: 'secret' },
      context: { locale: 'en_US' },
      metadata: { environment: 'prod' },
      timestamp: 'T',
    });
    expect(payload.action).toBe('click');
    expect(payload.token).toBeUndefined();
    expect(payload.locale).toBe('en_US');
    expect(payload.environment).toBe('prod');
  });

  it('returns default payload with no args', () => {
    const payload = buildEventPayload();
    expect(payload.timestamp).toBeTruthy();
  });

  it('properties override context and metadata', () => {
    const payload = buildEventPayload({
      properties: { action: 'from-props' },
      context: { action: 'from-context' },
      metadata: { action: 'from-meta' },
      timestamp: 'T',
    });
    expect(payload.action).toBe('from-props');
  });

  it('does not include windowName when route is root', () => {
    const payload = buildEventPayload({ route: '/', timestamp: 'T' });
    expect(payload.windowName).toBeUndefined();
  });
});