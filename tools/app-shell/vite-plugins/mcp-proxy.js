import http from 'node:http';
import https from 'node:https';

/**
 * Vite plugin that proxies /mcp requests to Etendo with retry logic.
 * When Tomcat restarts, the upstream is temporarily unavailable.
 * Instead of failing immediately (502), this plugin retries with
 * exponential backoff so the MCP SSE connection can survive brief outages.
 */
export default function mcpRetryProxy(etendoUrl) {
  const MAX_RETRIES = 10;
  const BASE_DELAY_MS = 1000;
  const MAX_DELAY_MS = 10000;

  const target = new URL(etendoUrl);
  const isHttps = target.protocol === 'https:';
  const agent = isHttps
    ? new https.Agent({ keepAlive: true })
    : new http.Agent({ keepAlive: true });

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function proxyRequest(req, res, attempt = 0) {
    const targetPath = req.url.replace(/^\/mcp/, '/sws/mcp');
    const options = {
      hostname: target.hostname,
      port: target.port || (isHttps ? 443 : 80),
      path: `${target.pathname.replace(/\/$/, '')}${targetPath}`,
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host,
      },
      agent,
    };

    const transport = isHttps ? https : http;
    const proxyReq = transport.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', async (err) => {
      const isRetryable =
        err.code === 'ECONNREFUSED' ||
        err.code === 'ECONNRESET' ||
        err.code === 'EPIPE' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ENOTFOUND' ||
        err.code === 'EAI_AGAIN';

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
        const next = attempt + 1;
        console.log(
          `[mcp-proxy] upstream ${err.code}, retry ${next}/${MAX_RETRIES} in ${delay}ms`
        );
        await sleep(delay);

        if (res.headersSent || res.writableEnded) return;
        proxyRequest(req, res, next);
      } else {
        console.error(
          `[mcp-proxy] upstream failed after ${attempt + 1} attempts: ${err.code}`
        );
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
        }
        if (!res.writableEnded) {
          res.end(
            JSON.stringify({
              error: 'upstream_unavailable',
              message: `Etendo is not reachable after ${attempt + 1} attempts (${err.code})`,
            })
          );
        }
      }
    });

    req.pipe(proxyReq, { end: true });
  }

  return {
    name: 'mcp-retry-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/mcp')) return next();
        proxyRequest(req, res);
      });
    },
  };
}
