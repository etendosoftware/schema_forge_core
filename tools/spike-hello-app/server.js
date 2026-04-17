// tools/spike-hello-app/server.js
import express from 'express';
import { requireJwt } from './src/jwt-middleware.js';
import { createEtendoProxy } from './src/etendo-proxy.js';
import { createEtendoAuth } from './src/etendo-auth.js';

const PORT = process.env.PORT || 4100;
const ETENDO_URL = process.env.ETENDO_URL || 'http://localhost:8080/etendo_sf2';
// During the F1 spike the JWKS is served by the app-shell Vite plugin at
// /sws/apps/.well-known/jwks.json (port 3100). Override via JWKS_URL once the
// Java AppsServlet serves the endpoint in the deployed environment.
const JWKS_URL = process.env.JWKS_URL || 'http://localhost:3100/sws/apps/.well-known/jwks.json';
const APP_ID = 'spike-hello-app';

// Spike service credentials — used by the BFF to obtain an Etendo-native token
// that it can forward to NEO Headless. See src/etendo-auth.js for caveats.
const etendoAuth = createEtendoAuth({
  etendoUrl: ETENDO_URL,
  username: process.env.ETENDO_SERVICE_USER || 'admin',
  password: process.env.ETENDO_SERVICE_PASSWORD || 'admin',
});

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
  ...createEtendoProxy({ target: ETENDO_URL, etendoAuth }));

// Static UI (built output)
app.use(express.static('dist'));

app.listen(PORT, () => console.log(`spike app listening on :${PORT}`));
