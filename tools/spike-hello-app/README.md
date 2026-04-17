# spike-hello-app

Minimum viable Etendo Go app for the F1 spike (ETP-3805).

Proves: RS256 JWT verification, BFF proxy to NEO, iframe embedding.

## Run locally

    npm install
    npm run dev
    # UI:  http://localhost:5173
    # API: http://localhost:4100

Requires Etendo Go running at `http://localhost:8080/etendo`
(override with `ETENDO_URL=...`).
