# CloudFront + ALB Routing for the SPA

> **Status:**
> - **Experimental:** APPLIED on 2026-04-10. Routing, login, and MCP discovery verified via curl. Browser smoke test still pending a live login.
> - **Staging:** NOT YET APPLIED. Replicate once experimental passes a full browser smoke test.
>
> **Last updated:** 2026-04-10

## Why this document exists

The Schema Forge SPA (`tools/app-shell`) is a static Vite build deployed to S3 and served by CloudFront. At runtime it calls the Etendo backend using **relative paths** (`/etendo/sws/*`, `/etendo/meta/*`, `/etendo/security/Login`, `/etendo/org.openbravo.*`, etc.) — see `tools/app-shell/src/auth/api.js` and `tools/app-shell/.env.production`. For those calls to reach Tomcat we need CloudFront to forward everything under `/etendo/*` to the ALB while still serving the rest from S3.

This is **Option A: same-origin** from the design discussion. No CORS. No cookie hacks. No rebuild. No new DNS. No new ALB listener rules.

### Problem it solves

Before this change, requests like `GET /etendo/security/Login` or `GET /etendo/meta/Window/123` at `go.experimental.etendo.cloud` were falling into the **default behavior → S3**, where S3 responded `200 OK` with `index.html` (SPA fallback). The SPA then tried to parse HTML as JSON and blew up. Only three narrow sub-paths were routed to the ALB (`/etendo/sws/*`, `/etendo/etendo_sf/*`, `/etendo/webhooks/*`), which left login, metadata, OAuth2, MCP discovery, legacy assets, and REST datasources all silently broken.

### What we're doing

Replacing the three narrow behaviors with a **single catch-all `/etendo/*` behavior** that forwards Host to the origin so Tomcat builds correct redirect URLs and MCP OAuth2 `resource_metadata` URLs.

## Environment inventory

### Account and region

| Field | Value |
|---|---|
| AWS account | `278186107973` |
| Region | `eu-west-3` (Paris) |
| AWS CLI profile | `go` |

### Experimental

| Component | Identifier |
|---|---|
| Domain (viewer) | `go.experimental.etendo.cloud` |
| CloudFront distribution | `E2KW4F1IFBTHJY` (`dfdusgbqnsjdw.cloudfront.net`) |
| S3 bucket (SPA) | `etendo-go-experimental-ui` |
| S3 origin id in CF | `s3-etendo-go-experimental-ui` |
| ALB | `etendo-experimental-alb` (`etendo-experimental-alb-1991162365.eu-west-3.elb.amazonaws.com`) |
| ALB origin id in CF | `alb-etendo-experimental` |
| Target group | `etendo-core-experimental-tg` (HTTP :8080, 1 healthy target) |
| ECS cluster / service | `etendo-experimental` / `etendo-core-service` |
| ACM certificate (ALB :443) | `arn:aws:acm:eu-west-3:278186107973:certificate/9fddf9dd-6f23-4f41-aec0-c4bc08421cb6` (SANs: `*.experimental.etendo.cloud`, `experimental.etendo.cloud`) |

### Staging (for later replication)

| Component | Identifier |
|---|---|
| Domain (viewer) | `go.staging.etendo.cloud` |
| CloudFront distribution | `E2XAO6Y99940X9` (`d1tf1daccdjiyj.cloudfront.net`) |
| S3 bucket (SPA) | `etendo-go-staging-ui` |
| S3 origin id in CF | `s3-etendo-go-staging-ui` |
| ALB | `etendo-staging-alb` (`etendo-staging-alb-779214105.eu-west-3.elb.amazonaws.com`) |
| ALB origin id in CF | `alb-etendo-staging` |
| Target group | `etendo-core-tg` |
| Existing extra behavior | `/jsreport/*` → jsreport-tg (independent, leave alone) |

### CloudFront origins (pre-existing, both environments)

Both distributions already have two origins configured before any of this work:

1. **S3 origin** — serves the static SPA (`index.html`, hashed JS/CSS bundles, `manifest.webmanifest`, `sw.js`, `api/reports` manifest).
2. **ALB origin** — `OriginProtocolPolicy: http-only`, port 80. CloudFront→ALB is unencrypted HTTP inside eu-west-3. The ALB itself terminates TLS from viewers on :443, but CloudFront always hits the ALB on plain :80. The ALB listener on :80 has **no host-header rules**, only a default forward to the core target group, so any Host header CloudFront sends is fine.

### Managed policy IDs used

These are AWS-managed CloudFront policies — same ID in every account:

| Alias | ID |
|---|---|
| `Managed-CachingDisabled` | `4135ea2d-6df8-44a3-9df3-4b5a84be39ad` |
| `Managed-CachingOptimized` | `658327ea-f89d-4fab-a63d-7e88639e58f6` |
| `Managed-AllViewer` | `216adef6-5c7f-47e4-b989-5492eafa07d3` |
| `Managed-AllViewerExceptHostHeader` | `b689b0a8-53d0-40ab-baf2-68738e2966ac` |

## Design decisions and what we learned

### Decision 1 — Collapse to a single `/etendo/*` behavior

**Initial plan:** Add a catch-all `/etendo/*` behavior *on top* of the three pre-existing specific ones (`/etendo/etendo_sf/*`, `/etendo/sws/*`, `/etendo/webhooks/*`). Keep the specific ones for "clarity".

**What actually happened:** All four behaviors used the same origin, same cache policy, and (in the intended final state) the same origin request policy. The specific behaviors were pure noise — they matched a strict subset of paths already covered by the catch-all and contributed zero differential behavior. So we **deleted the three specific behaviors** and kept only `/etendo/*`.

**Why this is better:**
- Half as much config to audit.
- Single place to change policy. If `/etendo/sws/*` ever needs a different setting, re-add it as a more-specific behavior ordered above the catch-all.
- Host-forwarding applied uniformly (see Decision 2).

### Decision 2 — Use `AllViewer`, not `AllViewerExceptHostHeader`

The three pre-existing behaviors used `Managed-AllViewerExceptHostHeader`, which forwards everything viewer sends *except* the `Host` header (replacing it with the origin's DNS name). That's usually the safe default for ALB origins because it lets ALB host-based routing work against the origin's internal DNS.

**Why it broke things here:** With Host stripped, Tomcat sees `Host: etendo-experimental-alb-1991162365.eu-west-3.elb.amazonaws.com` on every request. When Tomcat builds absolute URLs (302 `Location` headers, OAuth2 `resource_metadata` URLs, `www-authenticate` challenges), it uses that internal hostname. The browser then follows the redirect to the raw ALB DNS, which:
1. Is not served by CloudFront, so it bypasses our behaviors entirely.
2. Has no valid cert for that hostname (ACM cert is for `*.experimental.etendo.cloud`).
3. Breaks the MCP OAuth2 discovery flow because the `resource_metadata` URL is unreachable.

Concrete evidence observed during the rollout:

```
# Before the fix (/etendo/ 302):
location: https://etendo-experimental-alb-1991162365.eu-west-3.elb.amazonaws.com:443/etendo/security/Login

# After the fix:
location: https://go.experimental.etendo.cloud:443/etendo/security/Login
```

```
# Before on /etendo/sws/mcp:
www-authenticate: Bearer error="invalid_request",
  resource_metadata="https://etendo-experimental-alb-1991162365.eu-west-3.elb.amazonaws.com/etendo/sws/mcp/.well-known/oauth-protected-resource"

# After:
www-authenticate: Bearer error="invalid_request",
  resource_metadata="https://go.experimental.etendo.cloud/etendo/sws/mcp/.well-known/oauth-protected-resource"
```

**Why it's safe to forward Host here:**
- CloudFront talks to the ALB on HTTP :80.
- The ALB :80 listener has no host-header rules — only a default forward to `etendo-core-experimental-tg`. So no matter what Host arrives, the ALB routes to Tomcat.
- The ALB :443 listener (which *does* have host-header rules, including a `host=go.experimental.etendo.cloud → etendo-go-experimental-tg` rule pointing at an empty TG) is never reached by CloudFront.
- Health checks use the target group's configured path and the target's own address, not the viewer Host.

### Decision 3 — Cookies work without any extra configuration

Tomcat sets `JSESSIONID=...; Path=/etendo; Secure; HttpOnly` **without a `Domain=` attribute**. Omitting `Domain` scopes the cookie to exactly the host the browser sent the request to, which is `go.experimental.etendo.cloud`. Since the SPA and the backend are same-origin from the browser's perspective, the cookie round-trips correctly with zero hack.

No `SameSite=None` needed. No CORS needed. No `Access-Control-Allow-Credentials` needed.

### Decision 4 — `/etendo` (no trailing slash) still falls to S3

CloudFront path patterns use glob-style matching: `/etendo/*` matches `/etendo/` and deeper, but **not** literal `/etendo` without the trailing slash. A request to `GET /etendo` currently falls through to the default behavior and returns the SPA `index.html` with `server: AmazonS3`.

This is not a problem in practice because:
- The SPA never calls `/etendo` directly — it always uses `/etendo/sws/...`, `/etendo/meta/...`, etc.
- Users typing `/etendo` manually would get the SPA home page, which is arguably fine.

If it becomes a problem, add a second behavior with path pattern `/etendo` (exact, no trailing slash) pointing to the same ALB with the same policies. Not worth doing preemptively.

## Final configuration (experimental — applied 2026-04-10)

### Cache behaviors

| Order | Path pattern | Target origin | Cache policy | Origin request policy | Viewer function | Methods |
|---|---|---|---|---|---|---|
| 1 | `/mcp` | `alb-etendo-experimental` | `Managed-CachingDisabled` | `Managed-AllViewer` | `etendo-path-rewrite-experimental` | all |
| 2 | `/oauth2/*` | `alb-etendo-experimental` | `Managed-CachingDisabled` | `Managed-AllViewer` | `etendo-path-rewrite-experimental` | all |
| 3 | `/etendo/*` | `alb-etendo-experimental` | `Managed-CachingDisabled` | `Managed-AllViewer` | — | all |
| default | `*` | `s3-etendo-go-experimental-ui` | `Managed-CachingOptimized` | — | `etendo-go-spa-router` | GET, HEAD |

The `/mcp` and `/oauth2/*` behaviors attach a CloudFront Function (viewer-request) that rewrites the URI to the Etendo Tomcat context path before it reaches the ALB. See "Path rewrites (CloudFront Function)" below. `/authorize` is **not** a behavior — it is an SPA route served by the default S3 behavior and handled by React Router client-side (`tools/app-shell/src/pages/AuthorizePage.jsx`).

**Function naming convention:** the rewrite function is named per-environment — `etendo-path-rewrite-experimental` on `E2KW4F1IFBTHJY`, and `etendo-path-rewrite-staging` will be the name on `E2XAO6Y99940X9` when staging is replicated. CloudFront Functions don't support resource tags, so the environment is encoded in the name. The JS source is identical (`infra/cloudfront-functions/etendo-path-rewrite.js`) — only the deployed function name and the `Comment` field vary.

### What goes where at runtime

| Request | Behavior | Origin | Handled by |
|---|---|---|---|
| `GET /` | default | S3 | `index.html` (SPA shell) |
| `GET /sales-order`, `/dashboard`, etc. | default | S3 | `index.html` (SPA route, client-side) |
| `GET /authorize` | default | S3 | `AuthorizePage.jsx` (SPA consent screen) |
| `GET /.well-known/oauth-protected-resource` | default | S3 | Static JSON emitted at build (RFC 9728) |
| `GET /.well-known/oauth-authorization-server` | default | S3 | Static JSON emitted at build (RFC 8414) |
| `GET /.well-known/openid-configuration` | default | S3 | Static JSON emitted at build |
| `GET /assets/index.js`, `/assets/index.css` | default | S3 | Hashed static assets (long cache) |
| `GET /api/reports/...` | default | S3 | Reports manifest (generated at build) |
| `GET /mcp` | `/mcp` | ALB (rewritten to `/etendo/sws/mcp`) | MCP server (401 + OAuth2 discovery) |
| `POST /oauth2/token` | `/oauth2/*` | ALB (rewritten to `/etendo/oauth2/token`) | OAuth2 token endpoint |
| `POST /oauth2/register` | `/oauth2/*` | ALB (rewritten to `/etendo/oauth2/register`) | DCR endpoint |
| `GET /etendo/` | `/etendo/*` | ALB (no rewrite) | Tomcat redirect to `/etendo/security/Login` |
| `POST /etendo/sws/login` | `/etendo/*` | ALB (no rewrite) | Etendo JSON login |
| `GET /etendo/meta/Window/...` | `/etendo/*` | ALB (no rewrite) | Window metadata |
| `GET /etendo/org.openbravo.service.json.jsonrest/...` | `/etendo/*` | ALB (no rewrite) | REST datasource |
| `GET /etendo/web/...` | `/etendo/*` | ALB (no rewrite) | Legacy UI assets |
| `GET /etendo/security/Login` | `/etendo/*` | ALB (no rewrite) | Login HTML page |
| `GET /etendo/webhooks/...` | `/etendo/*` | ALB (no rewrite) | Webhook endpoints |

## Execution runbook

All commands use `AWS_PROFILE=go` and region `eu-west-3`. This is a copy-paste runbook — every step was executed in this order on experimental on 2026-04-10.

### 0. Pre-flight checks

```bash
export AWS_PROFILE=go
export AWS_REGION=eu-west-3

# Identity
aws sts get-caller-identity
# Expected: Account 278186107973

# Distribution exists and is currently Deployed
aws cloudfront get-distribution --id E2KW4F1IFBTHJY \
  --query 'Distribution.{Status:Status,Aliases:DistributionConfig.Aliases.Items}' \
  --output json
# Expected: Status=Deployed, Aliases=["go.experimental.etendo.cloud"]

# ALB target is healthy
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:eu-west-3:278186107973:targetgroup/etendo-core-experimental-tg/2e057644c70b9d4d \
  --query 'TargetHealthDescriptions[*].TargetHealth.State' --output text
# Expected: healthy
```

### 1. Snapshot current distribution config

```bash
mkdir -p /tmp/cf-runbook

aws cloudfront get-distribution-config --id E2KW4F1IFBTHJY \
  > /tmp/cf-runbook/exp-before.json

jq -r '.ETag' /tmp/cf-runbook/exp-before.json > /tmp/cf-runbook/exp-etag.txt

# Save this file until the change is verified stable — it's the rollback source
```

### 2. Build the new distribution config

Replace the `CacheBehaviors.Items` array with a single `/etendo/*` behavior using `AllViewer`:

```bash
jq '
  .DistributionConfig.CacheBehaviors.Items = [{
    "PathPattern": "/etendo/*",
    "TargetOriginId": "alb-etendo-experimental",
    "TrustedSigners": { "Enabled": false, "Quantity": 0 },
    "TrustedKeyGroups": { "Enabled": false, "Quantity": 0 },
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 7,
      "Items": ["HEAD","DELETE","POST","GET","OPTIONS","PUT","PATCH"],
      "CachedMethods": { "Quantity": 2, "Items": ["HEAD","GET"] }
    },
    "SmoothStreaming": false,
    "Compress": false,
    "LambdaFunctionAssociations": { "Quantity": 0 },
    "FunctionAssociations": { "Quantity": 0 },
    "FieldLevelEncryptionId": "",
    "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
    "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3",
    "GrpcConfig": { "Enabled": false }
  }]
  | .DistributionConfig.CacheBehaviors.Quantity = 1
  | .DistributionConfig
' /tmp/cf-runbook/exp-before.json > /tmp/cf-runbook/exp-after.json

# Sanity: should print exactly /etendo/*
jq -r '.CacheBehaviors.Items[].PathPattern' /tmp/cf-runbook/exp-after.json

# Sanity: Quantity should be 1
jq -r '.CacheBehaviors.Quantity' /tmp/cf-runbook/exp-after.json
```

### 3. Apply the update

```bash
aws cloudfront update-distribution \
  --id E2KW4F1IFBTHJY \
  --if-match "$(cat /tmp/cf-runbook/exp-etag.txt)" \
  --distribution-config file:///tmp/cf-runbook/exp-after.json \
  > /tmp/cf-runbook/exp-update-result.json

jq -r '.Distribution.Status' /tmp/cf-runbook/exp-update-result.json
# Expected: InProgress
```

### 4. Wait for deployment

Typical propagation on experimental is ~20–60 seconds, occasionally longer.

```bash
while true; do
  st=$(aws cloudfront get-distribution --id E2KW4F1IFBTHJY --query 'Distribution.Status' --output text)
  echo "$(date +%H:%M:%S) status=$st"
  [ "$st" = "Deployed" ] && break
  sleep 20
done
```

### 5. Optional: invalidate cache

Because `/etendo/*` uses `CachingDisabled`, invalidation is cosmetic. Run it only if you suspect stale SPA responses were cached earlier by the default behavior for `/etendo/*` paths.

```bash
aws cloudfront create-invalidation \
  --distribution-id E2KW4F1IFBTHJY \
  --paths "/etendo/*"
```

## Verification checklist (executed on experimental 2026-04-10)

### Automated curl checks — PASSED ✅

| # | Check | Expected | Observed |
|---|---|---|---|
| 1 | `GET /` returns SPA from S3 | `200`, `server: AmazonS3` | `200`, `server: AmazonS3`, `x-cache: RefreshHit from cloudfront` ✅ |
| 2 | `GET /sales-order` returns SPA from S3 | `200`, `server: AmazonS3` | `200`, `server: AmazonS3`, `x-cache: RefreshHit from cloudfront` ✅ |
| 3 | `GET /etendo/` redirects to Tomcat login | `302`, `location` on viewer host | `302`, `location: https://go.experimental.etendo.cloud:443/etendo/security/Login` ✅ |
| 4 | `GET /etendo/security/Login` returns HTML from Tomcat | `200`, `content-type: text/html;charset=UTF-8`, no `server: AmazonS3` | `200`, `content-type: text/html;charset=UTF-8`, `x-cache: Miss from cloudfront` ✅ |
| 5 | `POST /etendo/sws/login` with bad creds returns JSON error | `200`, `application/json`, Etendo error body | `200`, `application/json;charset=ISO-8859-1`, `{"status":"error","message":"Invalid user name or password."}` ✅ |
| 6 | `GET /etendo/sws/mcp` returns 401 with correct `resource_metadata` URL | URL uses `go.experimental.etendo.cloud` | `www-authenticate: ... resource_metadata="https://go.experimental.etendo.cloud/etendo/sws/mcp/.well-known/oauth-protected-resource"` ✅ |
| 7 | `GET /etendo/org.openbravo.service.json.jsonrest/` returns 401 from Tomcat | `401`, not HTML from S3 | `401` (no `server: AmazonS3`) ✅ |
| 8 | `POST /etendo/sws/login` sets a session cookie scoped to the viewer host | `Set-Cookie: JSESSIONID=...; Path=/etendo; Secure; HttpOnly`, no `Domain` | `Set-Cookie: JSESSIONID=D208A3F32698AC29DF5FE8C4F3B14D80; Path=/etendo; Secure; HttpOnly` ✅ |
| 9 | `GET /etendo/webhooks/test` (no-op) returns Tomcat JSON, not S3 HTML | JSON 404 or similar from Tomcat | `404`, `content-type: application/json` ✅ |

### Browser smoke test — PENDING ⏳

Run these once a real Etendo user is available in the experimental env:

1. Open `https://go.experimental.etendo.cloud/` in an incognito / clean browser profile.
2. DevTools → Network tab → enable "Preserve log".
3. Log in with a valid user.
   - ✅ `POST /etendo/sws/login` → `200` with JSON body, sets `JSESSIONID`
   - ✅ No CORS errors in the Console
4. After login, navigate to at least three windows that hit different endpoints (e.g. Sales Order, Business Partner, Dashboard).
   - ✅ All `GET /etendo/meta/...` return 200 with JSON
   - ✅ All `GET /etendo/org.openbravo.*` or `/etendo/sws/neo/*` return 200 with data
   - ✅ No `server: AmazonS3` anywhere in the `/etendo/*` responses
   - ✅ Windows render data, not empty states
5. If the build exposes an MCP client, trigger it and confirm the OAuth2 discovery + SSE connection establish. Look for `GET /etendo/sws/mcp/.well-known/oauth-protected-resource` returning 200 with JSON (not HTML).
6. Refresh the browser. Session should persist (cookie round-trip works).
7. Sign out. Cookie should be cleared. Re-login should work.

## Rollback

If anything goes wrong, restore the snapshot from step 1.

```bash
# Get current ETag (it changed after the update)
aws cloudfront get-distribution-config --id E2KW4F1IFBTHJY \
  > /tmp/cf-runbook/exp-current.json
CURRENT_ETAG=$(jq -r '.ETag' /tmp/cf-runbook/exp-current.json)

# Extract the original DistributionConfig from the snapshot
jq '.DistributionConfig' /tmp/cf-runbook/exp-before.json \
  > /tmp/cf-runbook/exp-rollback.json

# Apply
aws cloudfront update-distribution \
  --id E2KW4F1IFBTHJY \
  --if-match "$CURRENT_ETAG" \
  --distribution-config file:///tmp/cf-runbook/exp-rollback.json

# Wait for Deployed
while true; do
  st=$(aws cloudfront get-distribution --id E2KW4F1IFBTHJY --query 'Distribution.Status' --output text)
  echo "$(date +%H:%M:%S) status=$st"
  [ "$st" = "Deployed" ] && break
  sleep 20
done
```

Rollback puts us back to the broken state (three narrow behaviors, everything else falling to S3). Only use if the new config causes a regression we can't quickly diagnose.

## Staging replication (BLOCKED on full experimental browser smoke test)

**Do not run** until every item in the browser smoke test on experimental is ticked.

The change is identical except for a few substitutions. Nothing else varies — the managed policy IDs are the same across distributions.

### Substitutions

| Placeholder | Experimental value | Staging value |
|---|---|---|
| Distribution ID | `E2KW4F1IFBTHJY` | `E2XAO6Y99940X9` |
| Target origin id | `alb-etendo-experimental` | `alb-etendo-staging` |
| Target group (pre-flight check) | `etendo-core-experimental-tg` | `etendo-core-tg` |
| Viewer domain (verification) | `go.experimental.etendo.cloud` | `go.staging.etendo.cloud` |

### Staging-specific notes

1. **Staging has an extra `/jsreport/*` behavior** routing to `jsreport-tg`. It's independent of `/etendo/*` and must be preserved. The runbook below does that automatically by only replacing the `/etendo/*` behaviors.
2. **Staging ALB HTTP :80 listener** routes by default to `etendo-core-tg`. No host-header rules on :80. Behavior is symmetric with experimental.
3. **Staging ALB :443 listener** has a `host=reports.staging.etendo.cloud → jsreport-tg` rule and a default to `etendo-core-tg`. CloudFront talks to :80 not :443, so those rules don't interfere.

### Staging runbook (run after experimental is fully verified)

```bash
export AWS_PROFILE=go
export AWS_REGION=eu-west-3

# Pre-flight
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:eu-west-3:278186107973:targetgroup/etendo-core-tg/06d412ceb0efa6ca \
  --query 'TargetHealthDescriptions[*].TargetHealth.State' --output text
# Expected: healthy

mkdir -p /tmp/cf-runbook
aws cloudfront get-distribution-config --id E2XAO6Y99940X9 \
  > /tmp/cf-runbook/stg-before.json
jq -r '.ETag' /tmp/cf-runbook/stg-before.json > /tmp/cf-runbook/stg-etag.txt

# Build new config: remove /etendo/etendo_sf/*, /etendo/sws/*, /etendo/webhooks/* — keep everything else (/jsreport/* stays) — add /etendo/* at the end.
jq '
  .DistributionConfig.CacheBehaviors.Items = (
    (.DistributionConfig.CacheBehaviors.Items
      | map(select(.PathPattern != "/etendo/etendo_sf/*"
                and .PathPattern != "/etendo/sws/*"
                and .PathPattern != "/etendo/webhooks/*")))
    + [{
        "PathPattern": "/etendo/*",
        "TargetOriginId": "alb-etendo-staging",
        "TrustedSigners": { "Enabled": false, "Quantity": 0 },
        "TrustedKeyGroups": { "Enabled": false, "Quantity": 0 },
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
          "Quantity": 7,
          "Items": ["HEAD","DELETE","POST","GET","OPTIONS","PUT","PATCH"],
          "CachedMethods": { "Quantity": 2, "Items": ["HEAD","GET"] }
        },
        "SmoothStreaming": false,
        "Compress": false,
        "LambdaFunctionAssociations": { "Quantity": 0 },
        "FunctionAssociations": { "Quantity": 0 },
        "FieldLevelEncryptionId": "",
        "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
        "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3",
        "GrpcConfig": { "Enabled": false }
      }])
  | .DistributionConfig.CacheBehaviors.Quantity = (.DistributionConfig.CacheBehaviors.Items | length)
  | .DistributionConfig
' /tmp/cf-runbook/stg-before.json > /tmp/cf-runbook/stg-after.json

# Sanity: should show /jsreport/* first (if present), then /etendo/* last
jq -r '.CacheBehaviors.Items[].PathPattern' /tmp/cf-runbook/stg-after.json

# Apply
aws cloudfront update-distribution \
  --id E2XAO6Y99940X9 \
  --if-match "$(cat /tmp/cf-runbook/stg-etag.txt)" \
  --distribution-config file:///tmp/cf-runbook/stg-after.json \
  > /tmp/cf-runbook/stg-update-result.json

jq -r '.Distribution.Status' /tmp/cf-runbook/stg-update-result.json

# Wait for Deployed
while true; do
  st=$(aws cloudfront get-distribution --id E2XAO6Y99940X9 --query 'Distribution.Status' --output text)
  echo "$(date +%H:%M:%S) status=$st"
  [ "$st" = "Deployed" ] && break
  sleep 20
done

# Re-run the same 9 curl checks from the experimental verification section,
# swapping the hostname to go.staging.etendo.cloud.
```

Rollback for staging uses the same pattern as experimental: restore `stg-before.json`'s `DistributionConfig` with the current ETag.

## OAuth2 / MCP discovery — root URLs, CloudFront path rewrites

### Goal

From a client's point of view (Claude Desktop, any MCP / OAuth2 client, a human reading the runbook), the URLs that matter live at the **host root** of the viewer domain:

```
https://go.experimental.etendo.cloud/mcp                                    # MCP endpoint — what the user pastes into the agent
https://go.experimental.etendo.cloud/authorize                              # SPA consent page (React Router)
https://go.experimental.etendo.cloud/oauth2/token                           # OAuth2 token endpoint
https://go.experimental.etendo.cloud/oauth2/register                        # OAuth2 DCR endpoint
https://go.experimental.etendo.cloud/.well-known/oauth-protected-resource   # RFC 9728
https://go.experimental.etendo.cloud/.well-known/oauth-authorization-server # RFC 8414
https://go.experimental.etendo.cloud/.well-known/openid-configuration
```

None of these reference the Tomcat context path `/etendo`. That prefix is **backend config** (configurable via `bbdd.context` in Etendo), can vary per deployment, and must never leak into anything static that ships with the SPA or the discovery documents. Baking it in would couple every deploy to the backend context name and break the moment someone changes it.

### Edge layout

1. **Static discovery assets** — the SPA build emits three JSON files to `dist/.well-known/` with absolute URLs built from `VITE_PUBLIC_ORIGIN`. S3 serves them via the default `*` behavior.
2. **SPA routes** — `/authorize` is a React Router route inside the SPA, served by the default S3 behavior that falls back to `index.html`.
3. **Backend endpoints** — `/mcp` and `/oauth2/*` are CloudFront behaviors pointed at the ALB. A CloudFront Function running at viewer-request rewrites the URI to the real Tomcat path *after* the behavior has matched, so the backend sees its native `/etendo/sws/mcp` and `/etendo/oauth2/*` paths.

### Path rewrites (CloudFront Function)

**File:** `infra/cloudfront-functions/etendo-path-rewrite.js`

```js
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // /mcp  or  /mcp/anything  → /etendo/sws/mcp(/anything)
  if (uri === '/mcp' || uri.indexOf('/mcp/') === 0) {
    request.uri = '/etendo/sws' + uri;
    return request;
  }

  // /oauth2/*  → /etendo/oauth2/*
  if (uri.indexOf('/oauth2/') === 0) {
    request.uri = '/etendo' + uri;
    return request;
  }

  return request;
}
```

Attached to the `/mcp` and `/oauth2/*` behaviors on viewer-request. CloudFront Functions run in ~1ms with no cold start and cost ~$0.10 per million invocations — trivial compared to the alternatives (Lambda@Edge, an extra ALB listener rule per environment, or rebuilding the SPA with the backend context path baked in).

`/authorize` is **not** rewritten — it's an SPA route, served by the default behavior. React Router handles it client-side.

### Dev parity

In local dev the same mapping happens through Vite — `server.proxy` forwards `/oauth2` and `/sws` to `ETENDO_URL`, and the `mcp-retry-proxy` plugin handles `/mcp` → `/sws/mcp`. So the SPA can use the same root URLs everywhere without special-casing dev vs prod. `mcpWellKnownPlugin` uses the request `Host` header in dev middleware to build payloads against `http://localhost:3100`.

### `mcpWellKnownPlugin` → `buildWellKnownPayloads(base)`

Lives in `tools/app-shell/vite.config.js`. Single source of truth for the three discovery documents. Takes a `base` origin (e.g. `https://go.experimental.etendo.cloud`) and returns payloads where every URL is root-relative to that base. Used in two places:

- **Dev middleware** (`configureServer`) — answers `/.well-known/*` dynamically from the request `Host` header.
- **Build hook** (`generateBundle`) — emits static assets into `dist/.well-known/` using `process.env.VITE_PUBLIC_ORIGIN`. Fails the build with a clear error if `VITE_PUBLIC_ORIGIN` is not a valid absolute origin.

Key fields:

```jsonc
// oauth-protected-resource
{
  "resource":               "https://go.experimental.etendo.cloud/mcp",
  "authorization_servers": ["https://go.experimental.etendo.cloud"]
}

// oauth-authorization-server
{
  "issuer":                 "https://go.experimental.etendo.cloud",
  "authorization_endpoint": "https://go.experimental.etendo.cloud/authorize",  // SPA route
  "token_endpoint":         "https://go.experimental.etendo.cloud/oauth2/token",
  "registration_endpoint":  "https://go.experimental.etendo.cloud/oauth2/register"
}
```

### Deploy workflow

`.github/workflows/deploy-staging.yml` owns three things for discovery:

1. `target` step outputs `public_origin` per branch:
   - `develop` → `https://go.staging.etendo.cloud`
   - `epic/ETP-3504` → `https://go.experimental.etendo.cloud`
2. `Build app-shell` step exports `VITE_PUBLIC_ORIGIN` so the plugin can emit absolute URLs.
3. S3 sync now has a dedicated `.well-known/*` upload step:
   - The first `aws s3 sync` (immutable / long-cache) **excludes** `.well-known/*`. A rollback or endpoint change must not leave stale metadata pinned in edge caches for a year.
   - A third `aws s3 sync` uploads only `dist/.well-known/` to `s3://.../.well-known/` with `--cache-control "no-cache, no-store, must-revalidate"` and `--content-type "application/json"`. The content type is critical: these files have no extension, so without it S3 serves them as `application/octet-stream` and strict MCP / OAuth2 clients refuse to parse them.

### Codex adversarial review — findings resolved

An adversarial review of the first iteration (static assets + nested `/etendo/*` URLs in the payloads) flagged three issues. All three are resolved by the current design.

| # | Finding (first iteration) | Fix |
|---|---|---|
| 1 | [high] `authorization_endpoint` pointed to a non-existent backend path (`/etendo/oauth2/authorize`). Strict RFC 8414 clients would hit it and get whatever Tomcat decides, not the SPA consent screen. | `authorization_endpoint` now points to `/authorize`, which is a React Router route in the SPA (`AuthorizePage.jsx`) and served by the default S3 behavior. |
| 2 | [high] `.well-known/*` were covered by the long-cache `aws s3 sync` with `max-age=31536000, immutable`. Stale metadata would pin to CDN edges and clients for a year after any rollback. | First sync now `--exclude ".well-known/*"`. A dedicated third sync uploads them with `no-cache, no-store, must-revalidate` and explicit `application/json`. |
| 3 | [medium] Local dev discovery was broken — payloads advertised `/etendo/*` paths but Vite only proxies `/sws`, `/oauth2`, `/webhooks` at root (plus `mcp-retry-proxy` for `/mcp`). | Payloads now advertise root-relative URLs (`/mcp`, `/authorize`, `/oauth2/*`), which match the dev proxy exactly. Dev and prod use the same URL shape. |

### `oauth-discovery-war/` deleted

Removed the untracked Java WAR that was attempting to serve `.well-known/*` at Tomcat root context. Never committed, never deployed, and the static SPA asset path is simpler (no Tomcat, no extra CloudFront behavior, no Host-header gymnastics).

### Remaining backend follow-up

The `www-authenticate` header that the MCP server in `com.etendoerp.go` sends on 401 still points to the **nested** path (`resource_metadata="${base}/etendo/sws/mcp/.well-known/oauth-protected-resource"`). Per RFC 9728 it should point to the **root** URL now that we serve it there:

```
resource_metadata="${base}/.well-known/oauth-protected-resource"
```

Until that lands, clients that parse `resource_metadata` from the challenge will still hit the nested URL — which still works today because the backend also serves it at `/etendo/sws/mcp/.well-known/*`. So no client is broken, but strict RFC 9728 behavior is only achieved once the backend is updated.

### Verification after the SPA + CloudFront redeploy

```bash
# --- Root discovery assets: JSON from S3 with correct content type ---
curl -sI https://go.experimental.etendo.cloud/.well-known/oauth-protected-resource \
  | grep -iE 'HTTP|content-type|cache-control|server'
# Expected:
#   HTTP/2 200
#   content-type: application/json
#   cache-control: no-cache, no-store, must-revalidate
#   server: AmazonS3

curl -s https://go.experimental.etendo.cloud/.well-known/oauth-protected-resource | jq .
# Expected:
#   "resource": "https://go.experimental.etendo.cloud/mcp"
#   "authorization_servers": ["https://go.experimental.etendo.cloud"]

curl -s https://go.experimental.etendo.cloud/.well-known/oauth-authorization-server | jq .
# Expected:
#   "authorization_endpoint": "https://go.experimental.etendo.cloud/authorize"
#   "token_endpoint":         "https://go.experimental.etendo.cloud/oauth2/token"
#   "registration_endpoint":  "https://go.experimental.etendo.cloud/oauth2/register"

# --- Root MCP endpoint: routed through CloudFront Function to backend ---
curl -sI https://go.experimental.etendo.cloud/mcp \
  | grep -iE 'HTTP|www-authenticate|server'
# Expected: 401 from Tomcat (no server: AmazonS3), www-authenticate header present.

# --- Root OAuth2 endpoints: routed through CloudFront Function to backend ---
curl -sI https://go.experimental.etendo.cloud/oauth2/token | grep -iE 'HTTP|server'
# Expected: 4xx from Tomcat (method/params missing), no server: AmazonS3.

# --- SPA consent route still served from S3 ---
curl -sI https://go.experimental.etendo.cloud/authorize | grep -iE 'HTTP|content-type|server'
# Expected: 200, text/html, server: AmazonS3 (React Router picks it up client-side).
```

## Appendix A — Why Option A (same-origin), not Option B (cross-origin)

Option B was rejected because it required all of this extra work just to re-create same-origin semantics:

- A new DNS record for `etendo.experimental.etendo.cloud` (we don't have Route53 permissions on this profile).
- A new ALB listener rule with host-header match.
- A rebuild of the SPA with an absolute `VITE_API_BASE` (touching `.env.production` and `.github/workflows/deploy-staging.yml`, per-environment branching).
- A CORS filter in the Etendo Tomcat webapp with an explicit `Access-Control-Allow-Origin` (no wildcards, because the SPA uses `credentials: 'include'`).
- `SameSite=None; Secure` on `JSESSIONID` via Tomcat `context.xml` — requires a backend redeploy.
- Increased ALB idle timeout for MCP SSE streams.
- Preflight handling for every fetch with `Authorization` / `Content-Type: application/json`.

Option A as applied here needs: **one CloudFront behavior**. Zero backend changes. Zero SPA changes. Zero DNS changes. Zero CORS. Same-origin cookies.

## Appendix B — Files on disk after the rollout

Under `/tmp/cf-runbook/` on the machine that ran the change:

| File | Purpose |
|---|---|
| `exp-before.json` | Snapshot *before* any change — **rollback source** for experimental |
| `exp-etag.txt` | ETag at snapshot time |
| `exp-after.json` | Generated new `DistributionConfig` (single `/etendo/*` behavior) |
| `exp-update-result.json` | API response from the update call |

Equivalent `stg-*.json` files will exist after the staging replication.

## Change log

- **2026-04-10 14:42 UTC-3** — Applied to experimental `E2KW4F1IFBTHJY`. Initial plan was to add `/etendo/*` alongside the three existing behaviors. First iteration used `AllViewerExceptHostHeader` which exposed the Tomcat-absolute-URL issue (Location and MCP `resource_metadata` pointing to the ALB DNS). Switched the new behavior to `AllViewer` to forward Host — redirects fixed. Then collapsed the three pre-existing narrow behaviors into the single `/etendo/*` catch-all so Host forwarding applies uniformly — MCP `resource_metadata` URL now uses the correct viewer host. Automated curl checks green. Browser smoke test pending.
- **2026-04-10 (later)** — First iteration of root-level discovery: `mcpWellKnownPlugin` in `tools/app-shell/vite.config.js` got a `generateBundle` hook emitting static RFC 9728 / RFC 8414 docs to `dist/.well-known/` from `VITE_PUBLIC_ORIGIN`. Untracked `oauth-discovery-war/` deleted.
- **2026-04-10 (rework after Codex adversarial review)** — Three issues flagged and resolved:
  - Payloads reshaped to use **root URLs** with no `/etendo` prefix anywhere. The Tomcat context path is backend config and can change per deployment — it must never leak into static frontend files. `authorization_endpoint` now points to the SPA route `/authorize` (served by S3 + React Router), not a non-existent backend path.
  - New CloudFront Function `etendo-path-rewrite` at `infra/cloudfront-functions/etendo-path-rewrite.js` rewrites `/mcp` → `/etendo/sws/mcp` and `/oauth2/*` → `/etendo/oauth2/*` on viewer-request. Two new CloudFront behaviors (`/mcp`, `/oauth2/*`) attach it and point at the ALB. Same-origin mapping from dev (Vite proxy + `mcp-retry-proxy`) now matches prod exactly.
  - `.github/workflows/deploy-staging.yml`: the long-cache `aws s3 sync` now excludes `.well-known/*`, and a dedicated third sync uploads `.well-known/*` with `no-cache, no-store, must-revalidate` and `content-type: application/json`. Fixes both stale-metadata-pinning and the missing JSON content type on extensionless files.
  - Backend follow-up (not blocking this repo): `com.etendoerp.go` MCP server should eventually emit the root-level `resource_metadata` URL in `www-authenticate` challenges.
- **Staging replication:** blocked pending browser smoke test on experimental *and* the same CloudFront Function + new behaviors being applied there. See staging section for the updated command set.
