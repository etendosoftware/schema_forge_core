import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * BFF proxy to Etendo upstream (/sws/*).
 *
 * The inbound request carries an RS256 app JWT; NEO Headless does not verify
 * those, so we swap it for a cached service-account token before forwarding.
 *
 * Returns an array of TWO middlewares — mount them with spread:
 *   app.use('/api/etendo', ...createEtendoProxy({ target, etendoAuth }));
 *
 * http-proxy-middleware v3 treats `on.proxyReq` synchronously; any awaited
 * work inside it races with the request body. The first middleware pre-fetches the
 * service token (async) and attaches it to `req`; the second reads it
 * synchronously inside proxyReq.
 */
export function createEtendoProxy({ target, etendoAuth }) {
  if (!target) throw new Error('createEtendoProxy: target is required');
  if (!etendoAuth?.getToken) throw new Error('createEtendoProxy: etendoAuth.getToken is required');

  async function attachServiceToken(req, res, next) {
    try {
      req.etendoServiceToken = await etendoAuth.getToken();
      next();
    } catch (err) {
      console.error('[apps-sdk-bff] failed to obtain service token:', err.message);
      res.status(502).json({ error: 'upstream_auth_failed', detail: err.message });
    }
  }

  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    // Express strips the mount prefix before the middleware runs, so req.url
    // enters as `/neo/...`. Prefix `/sws` to reach NEO Headless.
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
