# Tenant data-fixes catalog

Corrective `.sql` data-fixes for existing Etendo GO tenants. Each file is one
fix; the runner (`../run.js`) applies them Flyway-style and records state in the
System-owned ledger `ETGO_DATA_FIX_HISTORY`.

## File naming

`<YYYYMMDDThhmmssZ>__<slug>.sql` — the UTC timestamp prefix makes a lexical
sort equal to chronological execution order. The `fix_id` is the file name
without `.sql`. Known onboarding-gap fixes carry their `Rn` label in `@id`,
e.g. `20260611T143000Z__R3-periodcontrol.sql`.

## File format

```sql
-- @id: R3-periodcontrol
-- @gap: C2
-- @risk: medium
-- @type: sql                 (default; or "webhook")
-- @description: one-line human description

-- @check
-- Returns >=1 row when the fix IS needed. 0 rows => SKIPPED_NOT_NEEDED.
SELECT 1 FROM ad_org o
WHERE o.ad_client_id = :client_id
  AND NOT EXISTS (SELECT 1 FROM c_periodcontrol pc WHERE pc.ad_org_id = o.ad_org_id);

-- @apply
INSERT INTO c_periodcontrol (...)
SELECT ... FROM ad_org o
WHERE o.ad_client_id = :client_id
  AND NOT EXISTS (SELECT 1 FROM c_periodcontrol pc WHERE pc.ad_org_id = o.ad_org_id);
```

For `@type: webhook`, add a `-- @webhook: <Name>` header instead of `@apply`;
the webhook MUST be atomic on its own (the runner cannot wrap it in a SQL tx).

## Mandatory rules

1. **Tenant scope is `:client_id` — non-negotiable.** Every statement in both
   `@check` and `@apply` MUST filter `ad_client_id = :client_id`. `:org_id` is
   secondary/optional. (The runner inlines these as validated AD-id literals so
   multi-statement `@apply` bodies work.)
2. **Two-layer idempotency.** `@check` decides whether to run at all; `@apply`
   is ALSO defensively guarded (`WHERE NOT EXISTS`) so partial/concurrent state
   is safe.
3. **Applied fixes are immutable.** Never rename or edit an applied `.sql`.

See `../../../.claude/agents/tenant-fixer.md` for the full runner design.
