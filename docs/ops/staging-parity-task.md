# Task: Make staging CloudFront match experimental (Ansible-ready)

> **Status:** PROPOSED — awaiting review.
> **Goal:** Bring CloudFront distribution `E2XAO6Y99940X9` (staging, viewer `go.staging.etendo.cloud`) to functional parity with `E2KW4F1IFBTHJY` (experimental, viewer `go.experimental.etendo.cloud`).
> **Reference design doc:** `docs/ops/cloudfront-alb-routing.md` (Option A, same-origin).
> **Last updated:** 2026-04-16

## 1. Why this task exists

Experimental already runs the "Option A / same-origin" routing end-to-end (applied 2026-04-10). Staging still has the legacy narrow behaviors (`/etendo/etendo_sf/*`, `/etendo/sws/*`, `/etendo/webhooks/*`) and is missing the new ones (`/mcp`, `/oauth2/*`, `/.well-known/*`, `/etendo/*` catch-all). That means:

- Login, metadata, OAuth2, MCP discovery, REST datasources, and legacy assets are **silently broken** on staging (S3 serves `index.html` for paths that should hit Tomcat).
- The SPA cannot talk to the backend on staging.
- The discovery docs already shipped to `s3://etendo-go-staging-ui/.well-known/` (2026-04-16 15:32 UTC) are not reachable because staging has no behavior for them.

The design decisions, caveats, and rollback story already live in `cloudfront-alb-routing.md`. This task is the operational spec to close the gap.

## 2. Environment inventory (constants)

Hardcoded values the Ansible playbook will reference:

```yaml
# Shared
aws_region: eu-west-3
aws_account: "278186107973"
aws_profile: go

# Managed CloudFront policies (same IDs in every account)
cache_policy_caching_disabled: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad
cache_policy_caching_optimized: 658327ea-f89d-4fab-a63d-7e88639e58f6
origin_request_policy_all_viewer: 216adef6-5c7f-47e4-b989-5492eafa07d3
origin_request_policy_all_viewer_except_host: b689b0a8-53d0-40ab-baf2-68738e2966ac

# Target (staging) — what we are changing
staging:
  distribution_id: E2XAO6Y99940X9
  viewer_domain: go.staging.etendo.cloud
  s3_origin_id: s3-etendo-go-staging-ui
  alb_origin_id: alb-etendo-staging
  alb_target_group_core: etendo-core-tg
  alb_target_group_core_arn: arn:aws:elasticloadbalancing:eu-west-3:278186107973:targetgroup/etendo-core-tg/06d412ceb0efa6ca
  cloudfront_function_rewrite_name: etendo-path-rewrite-staging

# Reference (experimental) — what we are copying from
experimental:
  distribution_id: E2KW4F1IFBTHJY
  viewer_domain: go.experimental.etendo.cloud
  cloudfront_function_rewrite_name: etendo-path-rewrite-experimental
  cloudfront_function_rewrite_source: infra/cloudfront-functions/etendo-path-rewrite.js
```

## 3. Current state vs desired state

### 3.1 CloudFront behaviors on `E2XAO6Y99940X9`

Legend: ✅ keep, ➕ add, ❌ remove, 🔄 modify.

| # | PathPattern | Current (staging) | Desired (match experimental) | Action |
|---|---|---|---|---|
| 1 | `/api/reports/*` | ALB, CachingDisabled, AllViewerExceptHost, no fn | (same) | ✅ keep |
| 2 | `/api/report-selectors/*` | ALB, CachingDisabled, AllViewerExceptHost, no fn | (same) | ✅ keep |
| 3 | `/jsreport/*` | ALB, CachingDisabled, AllViewerExceptHost, fn `jsreport-path-rewrite` | (same — function name mismatch with experimental is cosmetic) | ✅ keep |
| 4 | `/.well-known/*` | — (missing) | S3, CachingDisabled, no origin request policy, no fn, GET/HEAD only | ➕ add |
| 5 | `/mcp` | — (missing) | ALB, CachingDisabled, AllViewer, fn `etendo-path-rewrite-staging`, all methods | ➕ add |
| 6 | `/oauth2/*` | — (missing) | ALB, CachingDisabled, AllViewer, fn `etendo-path-rewrite-staging`, all methods | ➕ add |
| 7 | `/etendo/etendo_sf/*` | ALB, AllViewerExceptHost | — (absorbed by `/etendo/*`) | ❌ remove |
| 8 | `/etendo/sws/*` | ALB, AllViewerExceptHost | — (absorbed by `/etendo/*`) | ❌ remove |
| 9 | `/etendo/webhooks/*` | ALB, AllViewerExceptHost | — (absorbed by `/etendo/*`) | ❌ remove |
| 10 | `/etendo/*` | — (missing) | ALB, CachingDisabled, **AllViewer** (forwards Host), no fn, all methods | ➕ add |
| — | default `*` | S3, CachingOptimized, fn `etendo-go-spa-router` | (same) | ✅ keep |

**Final ordered list after change (7 behaviors + default):**

```
1. /api/reports/*            → alb-etendo-staging  (AllViewerExceptHost)
2. /api/report-selectors/*   → alb-etendo-staging  (AllViewerExceptHost)
3. /jsreport/*               → alb-etendo-staging  (AllViewerExceptHost) + jsreport-path-rewrite
4. /.well-known/*            → s3-etendo-go-staging-ui  (no origin req policy)
5. /mcp                      → alb-etendo-staging  (AllViewer) + etendo-path-rewrite-staging
6. /oauth2/*                 → alb-etendo-staging  (AllViewer) + etendo-path-rewrite-staging
7. /etendo/*                 → alb-etendo-staging  (AllViewer)
default /*                   → s3-etendo-go-staging-ui  (CachingOptimized) + etendo-go-spa-router
```

Order between items only matters when two patterns could match the same request. CloudFront evaluates by longest-prefix / specificity, not list order, so practically any grouping works; the list above mirrors experimental for readability.

### 3.2 CloudFront Function

| Resource | Current | Desired | Action |
|---|---|---|---|
| Function `etendo-path-rewrite-staging` | not present | Created, stage=LIVE, associated to `/mcp` and `/oauth2/*` | ➕ create + publish |

**Source code:** bit-for-bit identical to experimental. Single source of truth in repo: `infra/cloudfront-functions/etendo-path-rewrite.js`. The function name differs per environment because CloudFront Functions don't support resource tags (convention from `cloudfront-alb-routing.md` §"Function naming convention").

Minified payload (what gets uploaded; the JS fits in one CloudFront Function):

```js
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri === '/mcp' || uri.indexOf('/mcp/') === 0) {
    request.uri = '/etendo/sws' + uri;
    return request;
  }
  if (uri.indexOf('/oauth2/') === 0) {
    request.uri = '/etendo' + uri;
    return request;
  }
  return request;
}
```

Runtime: `cloudfront-js-2.0`. Comment: `"Rewrite /mcp and /oauth2/* to Etendo context path (staging)"`.

### 3.3 What is NOT touched

- **ALB `etendo-staging-alb`** — listener rules stay as they are. CloudFront hits the ALB :80 listener, which has no host rules (default → `etendo-core-tg`). The :443 rules (`reports.staging.etendo.cloud → jsreport-tg`, and the `/api/reports/*`/`/api/report-selectors/*` → `report-server-staging-tg` rules applied 2026-04-16) are reached only by direct ALB clients, not by CloudFront. No change needed.
- **Target groups** — `etendo-go-staging-tg` is intentionally NOT created. The equivalent `go.experimental.*` host rule on experimental points at an empty target group and the "Go" traffic actually flows through the `/etendo/*` catch-all to `etendo-core-tg`. Staging replicates that pattern.
- **S3 bucket `etendo-go-staging-ui`** — contents already correct (SPA + `.well-known/*` uploaded today by `deploy-staging.yml`). No changes to bucket policy, CORS, or objects.
- **ACM certificates** — staging ALB and CloudFront already have valid certs for `*.staging.etendo.cloud`. No changes.
- **Route53 / DNS** — no records change. `go.staging.etendo.cloud` already points at the CloudFront distribution.

## 4. Pre-flight checks (Ansible `pre_tasks` or a dedicated play)

All must pass before proceeding:

```yaml
- name: "Preflight: target group etendo-core-tg has at least one healthy target"
  # aws_region: eu-west-3, profile: go
  # expected: healthy count >= 1
  # aws cli equivalent:
  #   aws elbv2 describe-target-health \
  #     --target-group-arn arn:aws:elasticloadbalancing:eu-west-3:278186107973:targetgroup/etendo-core-tg/06d412ceb0efa6ca \
  #     --query 'length(TargetHealthDescriptions[?TargetHealth.State==`healthy`])'

- name: "Preflight: staging distribution is Deployed (not InProgress)"
  # aws cloudfront get-distribution --id E2XAO6Y99940X9 --query 'Distribution.Status'
  # expected: "Deployed"

- name: "Preflight: .well-known assets exist in staging S3 bucket"
  # aws s3 ls s3://etendo-go-staging-ui/.well-known/
  # expected: 3 files (oauth-authorization-server, oauth-protected-resource, openid-configuration)

- name: "Preflight: browser smoke test on experimental is signed off"
  # human gate — see section 8
```

If any of the above fails, abort with a clear message and do not touch CloudFront.

## 5. Execution plan

### 5.1 Suggested Ansible module layout

```
roles/cloudfront_staging_parity/
  defaults/main.yml       # all constants from §2
  tasks/
    main.yml              # orchestrates preflight + steps
    preflight.yml         # §4 checks
    cf_function.yml       # create + publish etendo-path-rewrite-staging
    cf_distribution.yml   # update behaviors on E2XAO6Y99940X9
    verify.yml            # §6
    rollback.yml          # §7 (manual trigger only)
  files/
    etendo-path-rewrite.js   # symlink or copy of infra/cloudfront-functions/etendo-path-rewrite.js
  vars/
    experimental.yml      # current experimental config snapshot (read-only reference)
```

Recommended Ansible modules:
- `community.aws.cloudfront_distribution` for the distribution update. Limitation: at time of writing it does not cover CloudFront Functions — use `community.aws.cloudfront_response_headers_policy` is unrelated; for Functions fall back to `command: aws cloudfront ...` or `community.general.aws_api` if available in the target environment.
- `amazon.aws.aws_s3_bucket_info` for the `.well-known` preflight.
- `amazon.aws.elb_target_group_info` for the target-group preflight.
- `community.aws.cloudfront_distribution_info` to fetch the current config (used in verify + rollback snapshotting).

### 5.2 Step-by-step

**Step A — Create CloudFront Function `etendo-path-rewrite-staging`.**

Idempotency: check `aws cloudfront describe-function --name etendo-path-rewrite-staging`. If it exists with `Status: DEPLOYED` and identical body, skip. Otherwise create/update + publish.

```
aws cloudfront create-function \
  --name etendo-path-rewrite-staging \
  --function-config 'Comment="Rewrite /mcp and /oauth2/* to Etendo context path (staging)",Runtime=cloudfront-js-2.0' \
  --function-code fileb://infra/cloudfront-functions/etendo-path-rewrite.js

# capture ETag from response, then:
aws cloudfront publish-function \
  --name etendo-path-rewrite-staging \
  --if-match <ETag>
```

After publish the function's `Stage: LIVE` ARN is:
`arn:aws:cloudfront::278186107973:function/etendo-path-rewrite-staging`

**Step B — Snapshot current distribution config (rollback source).**

```
aws cloudfront get-distribution-config --id E2XAO6Y99940X9 \
  > /tmp/cf-runbook/stg-before.json
jq -r '.ETag' /tmp/cf-runbook/stg-before.json > /tmp/cf-runbook/stg-etag.txt
```

Store both files as Ansible facts or on disk under a timestamped directory so rollback can replay them without re-fetching.

**Step C — Build the new DistributionConfig.**

Transformation from `stg-before.json`:

1. From `DistributionConfig.CacheBehaviors.Items`, **remove** any element where `PathPattern` ∈ `{"/etendo/etendo_sf/*", "/etendo/sws/*", "/etendo/webhooks/*"}`.
2. **Append** four new elements (see §5.3 for the full JSON of each).
3. Recompute `DistributionConfig.CacheBehaviors.Quantity = |Items|` (should be 7 after the change).
4. Leave `DefaultCacheBehavior`, `Origins`, `Aliases`, `ViewerCertificate`, `CustomErrorResponses`, `Restrictions`, and every other field untouched.

**Step D — Apply the update.**

```
aws cloudfront update-distribution \
  --id E2XAO6Y99940X9 \
  --if-match "$(cat /tmp/cf-runbook/stg-etag.txt)" \
  --distribution-config file:///tmp/cf-runbook/stg-after.json
```

Poll `Distribution.Status` until `Deployed` (typical: 1–3 min on staging).

**Step E — Invalidate cache** (optional but cheap — the new behaviors use CachingDisabled, but older cached responses for `/etendo/*` via the default-S3 fallback may still be around):

```
aws cloudfront create-invalidation \
  --distribution-id E2XAO6Y99940X9 \
  --paths "/etendo/*" "/.well-known/*" "/mcp" "/oauth2/*"
```

### 5.3 Exact JSON for each added behavior

Paste these into `CacheBehaviors.Items` in the order shown.

**4. `/.well-known/*` → S3** (no origin request policy; purely a static-serve with CachingDisabled so discovery docs never get pinned):

```json
{
  "PathPattern": "/.well-known/*",
  "TargetOriginId": "s3-etendo-go-staging-ui",
  "TrustedSigners": { "Enabled": false, "Quantity": 0 },
  "TrustedKeyGroups": { "Enabled": false, "Quantity": 0 },
  "ViewerProtocolPolicy": "redirect-to-https",
  "AllowedMethods": {
    "Quantity": 2,
    "Items": ["HEAD", "GET"],
    "CachedMethods": { "Quantity": 2, "Items": ["HEAD", "GET"] }
  },
  "SmoothStreaming": false,
  "Compress": true,
  "LambdaFunctionAssociations": { "Quantity": 0 },
  "FunctionAssociations": { "Quantity": 0 },
  "FieldLevelEncryptionId": "",
  "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
  "GrpcConfig": { "Enabled": false }
}
```

**5. `/mcp` → ALB + rewrite fn**:

```json
{
  "PathPattern": "/mcp",
  "TargetOriginId": "alb-etendo-staging",
  "TrustedSigners": { "Enabled": false, "Quantity": 0 },
  "TrustedKeyGroups": { "Enabled": false, "Quantity": 0 },
  "ViewerProtocolPolicy": "redirect-to-https",
  "AllowedMethods": {
    "Quantity": 7,
    "Items": ["HEAD", "DELETE", "POST", "GET", "OPTIONS", "PUT", "PATCH"],
    "CachedMethods": { "Quantity": 2, "Items": ["HEAD", "GET"] }
  },
  "SmoothStreaming": false,
  "Compress": false,
  "LambdaFunctionAssociations": { "Quantity": 0 },
  "FunctionAssociations": {
    "Quantity": 1,
    "Items": [{
      "FunctionARN": "arn:aws:cloudfront::278186107973:function/etendo-path-rewrite-staging",
      "EventType": "viewer-request"
    }]
  },
  "FieldLevelEncryptionId": "",
  "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
  "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3",
  "GrpcConfig": { "Enabled": false }
}
```

**6. `/oauth2/*` → ALB + rewrite fn** (identical to `/mcp` except `PathPattern`):

```json
{
  "PathPattern": "/oauth2/*",
  "TargetOriginId": "alb-etendo-staging",
  "TrustedSigners": { "Enabled": false, "Quantity": 0 },
  "TrustedKeyGroups": { "Enabled": false, "Quantity": 0 },
  "ViewerProtocolPolicy": "redirect-to-https",
  "AllowedMethods": {
    "Quantity": 7,
    "Items": ["HEAD", "DELETE", "POST", "GET", "OPTIONS", "PUT", "PATCH"],
    "CachedMethods": { "Quantity": 2, "Items": ["HEAD", "GET"] }
  },
  "SmoothStreaming": false,
  "Compress": false,
  "LambdaFunctionAssociations": { "Quantity": 0 },
  "FunctionAssociations": {
    "Quantity": 1,
    "Items": [{
      "FunctionARN": "arn:aws:cloudfront::278186107973:function/etendo-path-rewrite-staging",
      "EventType": "viewer-request"
    }]
  },
  "FieldLevelEncryptionId": "",
  "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
  "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3",
  "GrpcConfig": { "Enabled": false }
}
```

**7. `/etendo/*` → ALB catch-all** (AllViewer so Host reaches Tomcat; no fn):

```json
{
  "PathPattern": "/etendo/*",
  "TargetOriginId": "alb-etendo-staging",
  "TrustedSigners": { "Enabled": false, "Quantity": 0 },
  "TrustedKeyGroups": { "Enabled": false, "Quantity": 0 },
  "ViewerProtocolPolicy": "redirect-to-https",
  "AllowedMethods": {
    "Quantity": 7,
    "Items": ["HEAD", "DELETE", "POST", "GET", "OPTIONS", "PUT", "PATCH"],
    "CachedMethods": { "Quantity": 2, "Items": ["HEAD", "GET"] }
  },
  "SmoothStreaming": false,
  "Compress": false,
  "LambdaFunctionAssociations": { "Quantity": 0 },
  "FunctionAssociations": { "Quantity": 0 },
  "FieldLevelEncryptionId": "",
  "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
  "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3",
  "GrpcConfig": { "Enabled": false }
}
```

## 6. Verification (post-apply, automated)

Run all curl checks against `https://go.staging.etendo.cloud`. Every row must match the expected column.

| # | Check | Command | Expected |
|---|---|---|---|
| 1 | Root SPA still served from S3 | `curl -sI https://go.staging.etendo.cloud/` | `200`, `server: AmazonS3` |
| 2 | Client-side SPA route still served from S3 | `curl -sI https://go.staging.etendo.cloud/sales-order` | `200`, `server: AmazonS3` |
| 3 | `/etendo/` redirects to Tomcat login on viewer host | `curl -sI https://go.staging.etendo.cloud/etendo/` | `302`, `location: https://go.staging.etendo.cloud:443/etendo/security/Login` |
| 4 | Tomcat HTML login page reaches viewer | `curl -sI https://go.staging.etendo.cloud/etendo/security/Login` | `200`, `content-type: text/html;charset=UTF-8`, no `server: AmazonS3` |
| 5 | JSON login with bad creds returns Tomcat error | `curl -s -X POST https://go.staging.etendo.cloud/etendo/sws/login -H 'content-type: application/json' -d '{"username":"x","password":"x"}'` | JSON body `{"status":"error",...}` |
| 6 | MCP endpoint reaches Tomcat via CloudFront Function | `curl -sI https://go.staging.etendo.cloud/mcp` | `401`, `www-authenticate` header mentions `go.staging.etendo.cloud`, no `server: AmazonS3` |
| 7 | REST datasource reaches Tomcat | `curl -sI https://go.staging.etendo.cloud/etendo/org.openbravo.service.json.jsonrest/` | `401` or similar from Tomcat, not HTML from S3 |
| 8 | Session cookie scoped to viewer host (no `Domain=`) | header inspection on login response | `Set-Cookie: JSESSIONID=...; Path=/etendo; Secure; HttpOnly` |
| 9 | Webhook still routes to Tomcat | `curl -sI https://go.staging.etendo.cloud/etendo/webhooks/test` | Tomcat JSON 404, `content-type: application/json` |
| 10 | OAuth2 token endpoint routes via fn rewrite | `curl -sI https://go.staging.etendo.cloud/oauth2/token` | 4xx from Tomcat (missing params), no `server: AmazonS3` |
| 11 | `.well-known/oauth-protected-resource` served with JSON content type | `curl -sI https://go.staging.etendo.cloud/.well-known/oauth-protected-resource` | `200`, `content-type: application/json`, `cache-control: no-cache, no-store, must-revalidate`, `server: AmazonS3` |
| 12 | `.well-known` body points at staging viewer host | `curl -s https://go.staging.etendo.cloud/.well-known/oauth-protected-resource \| jq .resource` | `"https://go.staging.etendo.cloud/mcp"` |

Plus the manual browser smoke test mirroring `cloudfront-alb-routing.md` §"Browser smoke test", substituting `go.staging.etendo.cloud` for the experimental host.

## 7. Rollback

If any verification check fails and the cause is not obvious:

```
# 1. Re-fetch current ETag (it changed on successful apply)
aws cloudfront get-distribution-config --id E2XAO6Y99940X9 \
  > /tmp/cf-runbook/stg-current.json
CURRENT_ETAG=$(jq -r '.ETag' /tmp/cf-runbook/stg-current.json)

# 2. Restore snapshot
jq '.DistributionConfig' /tmp/cf-runbook/stg-before.json \
  > /tmp/cf-runbook/stg-rollback.json

aws cloudfront update-distribution \
  --id E2XAO6Y99940X9 \
  --if-match "$CURRENT_ETAG" \
  --distribution-config file:///tmp/cf-runbook/stg-rollback.json

# 3. Wait for Deployed
```

The CloudFront Function `etendo-path-rewrite-staging` can stay (unused) after rollback; removing it is optional and non-urgent. If you want to remove it:

```
aws cloudfront delete-function \
  --name etendo-path-rewrite-staging \
  --if-match <ETag from describe-function>
```

## 8. Gate: experimental browser smoke test

`cloudfront-alb-routing.md` §"Browser smoke test — PENDING" lists the exact manual checks that must be green on experimental before this task runs. This is **not** a CloudFront-technical gate — the curl suite already passes on experimental. It exists to catch real SPA-level regressions (CORS, cookie handling, MCP SSE streaming) that only surface in a browser with a real Etendo user.

**Required sign-off** from the person who runs it — record the date and user in the PR that merges the Ansible role.

## 9. Out of scope (explicit)

- Creating `etendo-go-staging-tg` or registering an Etendo Go instance in staging.
- Any change to the ALB listener rules on `etendo-staging-alb`.
- Any change to Route53.
- Renaming `jsreport-path-rewrite` to `jsreport-path-rewrite-staging` for naming consistency. Nice-to-have, cosmetic only; keep current function to avoid touching the `/jsreport/*` behavior in this task.
- Deleting the CloudFront Function `jsreport-path-rewrite` from the account inventory (unused cleanup).

## 10. Risk summary

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Host-forwarding (`AllViewer`) unexpectedly trips an ALB listener rule | Low | High (routing breaks) | ALB :80 has no host rules (verified). CloudFront always uses :80. |
| `/mcp` or `/oauth2/*` function rewrite sends an unexpected URI to Tomcat | Low | High | Code is bit-identical to experimental where it has run for 6 days. Verification step 6 + 10 catches regressions. |
| Deleting `/etendo/sws/*` breaks in-flight requests | Very low | Transient | CloudFront propagation is atomic per edge; the replacement `/etendo/*` catches the same traffic. |
| Cache staleness after flip | Low | Medium | Explicit invalidation in step E. New behaviors use CachingDisabled. |
| Ansible `community.aws.cloudfront_distribution` drift on re-run | Medium | Low | Verify idempotency on a dry-run; if drift is unacceptable, guard the task with a fact check against `CacheBehaviors.Quantity == 7` and the presence of `/etendo/*`. |

## 11. Deliverable checklist for the devops PR

- [ ] Ansible role `cloudfront_staging_parity` covering §5 (Create fn, Snapshot, Update, Invalidate).
- [ ] Pre-flight play covering §4.
- [ ] Verify play covering §6 curl checks (failing play on any miss).
- [ ] Rollback play matching §7.
- [ ] Dry-run artifact showing the computed `stg-after.json` diff against live state.
- [ ] Run log from the real apply, attached to the PR.
- [ ] Manual browser smoke sign-off line in the PR body (§8).
- [ ] `docs/ops/cloudfront-alb-routing.md` "Staging /etendo/* replication" section updated to `APPLIED YYYY-MM-DD` (same commit as the Ansible role merge).

## 12. Open questions

1. Does devops want the `.well-known/*` behavior to use `AllViewerExceptHost` instead of no origin request policy? Experimental uses none; both work because S3 ignores Host. No functional difference — defaulting to "no policy" matches experimental exactly.
2. Should the Ansible role delete the orphan `jsreport-path-rewrite` function after the rename to `-experimental`? Out of scope here; flag as follow-up.
3. Infrastructure-as-code home: is there an existing Ansible repo for this account, or does this role need a new repo? (If new, the role above is self-contained.)
