import { requireAppJwt } from './requireAppJwt.js';
import { createEtendoProxy } from './createEtendoProxy.js';
import { createServiceAuth } from './createServiceAuth.js';

/**
 * Mount the standard Etendo Apps BFF surface on an Express app:
 *   GET  /health         → { ok: true }
 *   GET  /api/me         → { userId, tenant, org } (requires app JWT)
 *   *    /api/etendo/*   → proxied to ${etendoUrl}/sws/* with service token
 *
 * Apps that need a different shape can compose the low-level exports instead.
 */
export function mountEtendoBff(app, {
  appId,
  jwksUrl,
  etendoUrl,
  serviceAuth: { user, password },
}) {
  if (!appId || !jwksUrl || !etendoUrl) {
    throw new Error('mountEtendoBff: appId, jwksUrl, and etendoUrl are required');
  }

  const etendoAuth = createServiceAuth({ etendoUrl, user, password });
  const requireJwt = requireAppJwt({ jwksUrl, appId });

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.get('/api/me', requireJwt, (req, res) => {
    res.json({
      userId: req.etendoContext.sub,
      tenant: req.etendoContext.tenant,
      org: req.etendoContext.org,
    });
  });

  app.use('/api/etendo',
    requireJwt,
    ...createEtendoProxy({ target: etendoUrl, etendoAuth }));
}
