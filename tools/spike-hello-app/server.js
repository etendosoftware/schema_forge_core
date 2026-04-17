// tools/spike-hello-app/server.js
import express from 'express';
import { requireJwt } from './src/jwt-middleware.js';
import { createEtendoProxy } from './src/etendo-proxy.js';

const PORT = process.env.PORT || 4100;
const ETENDO_URL = process.env.ETENDO_URL || 'http://localhost:8080/etendo';
const JWKS_URL = `${ETENDO_URL}/neo/apps/.well-known/jwks.json`;
const APP_ID = 'spike-hello-app';

const app = express();

// Health (no auth)
app.get('/health', (_req, res) => res.json({ ok: true }));

// All /api routes require a valid Etendo Go JWT
app.use('/api', requireJwt({ jwksUrl: JWKS_URL, audience: APP_ID }));

app.get('/api/me', (req, res) => {
  res.json({
    userId: req.etendoContext.sub,
    tenant: req.etendoContext.tenant,
    org: req.etendoContext.org,
  });
});

app.use('/api/etendo',
  requireJwt({ jwksUrl: JWKS_URL, audience: APP_ID }),
  createEtendoProxy({ target: ETENDO_URL }));

// Static UI (built output)
app.use(express.static('dist'));

app.listen(PORT, () => console.log(`spike app listening on :${PORT}`));
