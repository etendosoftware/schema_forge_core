import express from 'express';
import { mountEtendoBff } from '@etendoerp/apps-sdk-bff';

const PORT = process.env.PORT || 4100;
const ETENDO_URL = process.env.ETENDO_URL || 'http://localhost:8080/etendo_sf2';
const JWKS_URL = process.env.JWKS_URL || 'http://localhost:3100/sws/apps/.well-known/jwks.json';
const APP_ID = 'spike-hello-app';

const app = express();
mountEtendoBff(app, {
  appId: APP_ID,
  jwksUrl: JWKS_URL,
  etendoUrl: ETENDO_URL,
  serviceAuth: {
    user: process.env.ETENDO_SERVICE_USER || 'admin',
    password: process.env.ETENDO_SERVICE_PASSWORD || 'admin',
  },
});

app.use(express.static('dist'));

app.listen(PORT, () => console.log(`spike app listening on :${PORT}`));
