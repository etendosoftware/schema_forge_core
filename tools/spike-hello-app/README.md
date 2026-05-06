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

## Run the full spike loop (shell + spike) in one command

    npm run dev:with-shell
    # Shell: http://localhost:3100
    # UI:    http://localhost:5173
    # API:   http://localhost:4100

Starts the `app-shell` dev server alongside the spike so you can click
`Sidebar → Spike Apps → Hello App (spike)` and see the iframe load.
