import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * BFF proxy to Etendo upstream (/sws/*).
 *
 * The inbound request carries an RS256 app JWT; NEO Headless does not verify
 * those, so we swap it for a cached service-account token before forwarding.
 * See etendo-auth.js for the rationale and caveats.
 *
 * Returns an array of middlewares: the first pre-fetches the service token
 * asynchronously (http-proxy-middleware v3 treats `on.proxyReq` synchronously
 * and will send the request before any awaited work completes), the second
 * runs the proxy and reads the token synchronously from `req`.
 */
export function createEtendoProxy({ target, etendoAuth }) {
  async function attachServiceToken(req, res, next) {
    try {
      req.etendoServiceToken = await etendoAuth.getToken();
      next();
    } catch (err) {
      console.error('[etendo-proxy] failed to obtain service token:', err.message);
      res.status(502).json({ error: 'upstream_auth_failed', detail: err.message });
    }
  }

  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    // Express strips the `/api/etendo` mount prefix before the middleware runs,
    // so req.url arrives as `/neo/...`. Prefix `/sws` to reach NEO Headless.
    pathRewrite: (path) => `/sws${path}`,
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.etendoServiceToken) {
          proxyReq.setHeader('Authorization', `Bearer ${req.etendoServiceToken}`);
        }
      },
    },
  });

  return [attachServiceToken, proxy];
}
