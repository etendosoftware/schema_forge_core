import { createProxyMiddleware } from 'http-proxy-middleware';

export function createEtendoProxy({ target }) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { '^/api/etendo': '' },
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.jwtRaw) {
          proxyReq.setHeader('Authorization', `Bearer ${req.jwtRaw}`);
        }
      },
    },
  });
}
