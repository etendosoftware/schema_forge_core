/**
 * Provider-neutral hosted checkout helpers shared by Etendo GO clients.
 * The server remains the source of truth for price, currency and tenant ownership;
 * this module only transports the authenticated request and validates the response.
 */

export function createCheckoutSession(fetchImpl, baseUrl, token, input = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');
  if (!token) throw new Error('Authentication token is required');
  const body = {
    action: 'create',
    clientName: input.clientName,
    language: input.language,
    countryCode: input.countryCode,
  };
  return fetchImpl(`${String(baseUrl).replace(/\/$/, '')}/sws/go/checkout/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(Object.entries(body).filter(([, value]) => value != null))),
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || payload.code || 'Unable to create checkout session');
      error.code = payload.code || 'CHECKOUT_CREATION_FAILED';
      throw error;
    }
    if (!payload.checkoutUrl || !payload.requestId) {
      throw new Error('Checkout response is incomplete');
    }
    return payload;
  });
}

export function getCheckoutStatus(fetchImpl, baseUrl, token, requestId) {
  if (!requestId) throw new Error('requestId is required');
  return fetchImpl(`${String(baseUrl).replace(/\/$/, '')}/sws/go/checkout/sessions/${encodeURIComponent(requestId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Unable to read checkout status');
    return payload;
  });
}
