// tools/spike-hello-app/server.js
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const PORT = process.env.PORT || 4100;
const ETENDO_URL = process.env.ETENDO_URL || 'http://localhost:8080/etendo';

const app = express();

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// API placeholder — replaced in Task 6
app.get('/api/me', (_req, res) => res.json({ placeholder: true }));

// Static UI (built output)
app.use(express.static('dist'));

app.listen(PORT, () => console.log(`spike app listening on :${PORT}`));
