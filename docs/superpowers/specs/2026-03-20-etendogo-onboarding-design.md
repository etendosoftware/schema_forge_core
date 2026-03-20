# EtendoGo Onboarding — Design Spec

**Date:** 2026-03-20
**Status:** Approved
**Module:** com.etendoerp.go
**Reference:** com.etendoerp.saas (Bitbucket)

## Summary

On-demand client provisioning for EtendoGo. A dedicated servlet creates a fully operational Etendo client with organization, admin users, roles, and all reference data — atomically, with real-time progress visibility via chunked HTTP response.

## Goals

1. **Atomic** — all-or-nothing. No half-created clients. Full rollback on any failure.
2. **Progress visibility** — caller sees each step complete in real-time via chunked response.
3. **Speed** — minimize DB round-trips, batch where possible.
4. **Stability** — try/catch per step with full rollback on error, precise failure diagnosis.
5. **API first** — programmatic callers and UI consume the same endpoint.

## Endpoint

```
POST /sws/neo/onboarding
GET  /sws/neo/onboarding          (describe — returns input schema for the form)
Authorization: Bearer <jwt>        (System Administrator role required)
Content-Type: application/json
```

**Why a dedicated servlet, not NeoHandler:** NeoHandler returns a single `NeoResponse` object — it cannot produce chunked/streaming output. The onboarding servlet registers at the same URL prefix (`/sws/neo/`) for consistency but handles its own response lifecycle. JWT auth is validated manually using the same token parsing logic as NeoServlet.

### Request Body

```json
{
  "clientName": "Acme Corp",
  "orgName": "Acme Argentina",
  "adminUser": "admin@acme.com",
  "adminPassword": "securePass123",
  "currency": "EUR",
  "language": "es_ES",
  "countryCode": "AR"
}
```

All fields required. `currency` is ISO 4217 code (resolved against existing `C_Currency` in client 0). `language` is Etendo language code. `countryCode` is ISO 3166-1 alpha-2.

### Duplicate Protection

Before starting the step chain, the servlet checks if an `AD_Client` with the same `name` already exists. If it does, the request fails immediately with a clear error — no steps are executed.

### Response (chunked, Transfer-Encoding: chunked, Content-Type: application/x-ndjson)

Uses NDJSON (newline-delimited JSON) format — one JSON object per line.

**Success:**
```json
{"step": 1, "total": 8, "name": "createClient", "status": "running"}
{"step": 1, "total": 8, "name": "createClient", "status": "done", "ms": 120}
{"step": 2, "total": 8, "name": "createOrganization", "status": "running"}
{"step": 2, "total": 8, "name": "createOrganization", "status": "done", "ms": 95}
...
{"step": 8, "total": 8, "name": "markOrgReady", "status": "done", "ms": 45}
{"result": "success", "clientId": "ABC123", "orgId": "DEF456", "clientAdminUserId": "U1", "orgAdminUserId": "U2", "totalMs": 2340}
```

**Failure:**
```json
{"step": 4, "total": 8, "name": "createRole", "status": "failed", "error": "Role name already exists"}
{"result": "failed", "failedStep": 4, "failedName": "createRole", "error": "Role name already exists", "rolledBack": true}
```

HTTP status: 200 for the chunked stream (success/failure indicated in the final JSON line). This is a deliberate trade-off — chunked responses commit the status code at the start. Callers must read the `result` field in the last line. Documented for API consumers.

## Architecture

### Transaction Strategy

Single OBDal transaction with try/catch per step and full rollback on any failure.

```
BEGIN TRANSACTION (OBDal managed)
  try Step 1: Create Client        → flush, report progress
  try Step 2: Create Organization  → flush, report progress
  try Step 3: Create Client Admin  → flush, report progress
  try Step 4: Create Org Admin     → flush, report progress
  try Step 5: Create Role + Access → flush, report progress
  try Step 6: Seed Reference Data  → flush, report progress
  try Step 7: Document Types       → flush, report progress
  try Step 8: Mark Org Ready       → flush, report progress
  COMMIT
catch ANY step failure:
  ROLLBACK (full)
  report failure with step name + error
```

Each step calls `OBDal.getInstance().flush()` after creating entities to detect constraint violations early. The progress chunk is written and flushed to the HTTP response after each successful flush.

**Savepoints (v2):** JDBC savepoints behind Hibernate are risky (cache inconsistency). Deferred to v2 after investigation. For v1, full rollback is sufficient — the operation is fast enough that re-running is trivial.

### Data Access

All steps use OBDal exclusively — no raw JDBC. The `OnboardingStep` interface does not receive a `Connection`:

```java
public interface OnboardingStep {
    String name();
    void execute(OnboardingContext ctx) throws Exception;
}
```

This keeps everything within Hibernate's session cache, avoiding mixed-mode inconsistencies.

### Components

```
com.etendoerp.go/src/.../onboarding/
├── OnboardingServlet.java          Servlet — JWT auth, orchestrates steps, chunked response
├── OnboardingContext.java          DTO accumulating created IDs across steps
├── OnboardingStep.java             Interface: name() + execute(OnboardingContext)
├── steps/
│   ├── CreateClientStep.java       AD_Client + AD_ClientInfo
│   ├── CreateOrgStep.java          AD_Org + AD_OrgInfo
│   ├── CreateClientAdminStep.java  AD_User (client-level admin, legacy behavior)
│   ├── CreateOrgAdminStep.java     AD_User (org-level admin, legacy behavior)
│   ├── CreateRoleStep.java         AD_Role, AD_User_Roles, AD_Window_Access, AD_Process_Access
│   ├── SeedReferenceDataStep.java  Price lists, warehouse, currency, calendar, categories, product, financial accounts, payment methods
│   ├── CreateDocTypesStep.java     C_DocType + AD_Sequence
│   └── MarkOrgReadyStep.java       ORG_AS_READY process (resolved by name, not hardcoded ID), language assignment
```

Package: `com.etendoerp.go.onboarding` within the existing `com.etendoerp.go` module.

### OnboardingContext

```java
public class OnboardingContext {
    // Input
    String clientName, orgName, adminUser, adminPassword;
    String currencyCode, languageCode, countryCode;

    // Accumulated IDs (set by steps, read by subsequent steps)
    String clientId, orgId;
    String clientAdminUserId, orgAdminUserId;
    String roleId, warehouseId, calendarId;
    String priceListSalesId, priceListPurchaseId;
    String financialAccountId;
}
```

## Steps Detail

### Step 1: Create Client
- Insert `AD_Client` with clientName and generated search key
- Insert `AD_ClientInfo` with default settings (required by Etendo core)
- Store `clientId` in context

### Step 2: Create Organization
- Insert `AD_Org` linked to clientId
- Insert `AD_OrgInfo` with default settings (currency, calendar references filled by later steps)
- Store `orgId` in context

### Step 3: Create Client Admin (legacy)
- Insert `AD_User` with email as username, hashed password (same algorithm as Etendo core)
- Link to clientId, org 0 (client-level scope)
- Store `clientAdminUserId` in context

> **Legacy note:** The SaaS module creates a separate client admin and org admin. This is confusing UX (two admin accounts). Kept for backward compatibility in v1. v2 should unify into a single admin user with appropriate role scoping.

### Step 4: Create Org Admin (legacy)
- Insert `AD_User` with same or different credentials
- Link to clientId + orgId
- Store `orgAdminUserId` in context

> **Legacy note:** Same as Step 3 — dual admin pattern preserved for now.

### Step 5: Create Role + Access
- Insert `AD_Role` ("Default User Role") with WebService enabled
- Insert `AD_User_Roles` linking both admin users to role
- Insert `AD_Window_Access` for NEO-configured windows (query `ETGO_SF_SPEC` for active specs)
- Insert `AD_Process_Access` for NEO-configured processes
- Set role admin flag on user-role link
- Store `roleId` in context

### Step 6: Seed Reference Data
Based on com.etendoerp.saas Initial_Demo_Data.xml. Order matters — entities listed in dependency order:

| Order | Entity | Records | Details | Depends On |
|-------|--------|---------|---------|------------|
| 1 | `C_Currency` resolution | 0 (lookup) | Resolve ISO code against existing `C_Currency` in client 0 | — |
| 2 | `C_Location` | 2 | Warehouse location + default BP address | Country resolved from `countryCode` |
| 3 | `C_Calendar` + `C_Year` + `C_Period` | 1 + 2 + 24 | Fiscal calendar, current + next year, 12 periods each | Client, Org |
| 4 | `M_Warehouse` | 1 | Default Warehouse linked to location | Org, Location |
| 5 | `M_PriceList` + `M_PriceList_Version` | 2 + 2 | Default Sales + Default Supplier | Currency |
| 6 | `C_BPartner_Category` | 2 | Customer Tier 1, Supplier | Client, Org |
| 7 | `M_Product_Category` | 1 | Others | Client, Org |
| 8 | `M_Product` + price entries | 1 + 2 | Default Product + price list version entries | Product Category, Price Lists |
| 9 | `FIN_Financial_Account` | 1 | Default financial account | Org, Currency |
| 10 | `FIN_PaymentMethod` | 2 | Cash, Bank Transfer | Client, Org |
| 11 | `FIN_FinAcc_PaymentMethod` | 4 | Cash/Bank x Cash/Bank combinations | Financial Account, Payment Methods |

Update `AD_OrgInfo` with resolved calendar and warehouse references.

### Step 7: Document Types + Sequences
- `C_DocType` for: AR Invoice, AP Invoice, Standard Order, Purchase Order, MM Shipment, MM Receipt
- `AD_Sequence` with auto-numbering for each doc type
- Each doc type linked to the org and appropriate GL category

### Step 8: Mark Org Ready
- Resolve `ORG_AS_READY` process by `value` column (NOT hardcoded ID)
- Execute the process programmatically
- Set default language on org
- Assign default role to admin users
- Final validation that org is operational

## Frontend (Minimal, not definitive)

**Route:** `/onboarding` in app-shell (http://localhost:3100/onboarding)

**Layout:** Form on top, accordion below.

**Form inputs:**
- clientName (text, required)
- orgName (text, required)
- adminUser (email, required)
- adminPassword (password, required)
- currency (select — EUR, USD, ARS, etc.)
- language (select — es_ES, en_US, etc.)
- countryCode (select — AR, ES, US, etc.)

**Accordion (8 sections, one per step):**

States: `○` pending → `⏳` running → `✅` done (with ms) → `❌` failed (with error)

Frontend reads the NDJSON response line by line (`fetch` + `ReadableStream` + `TextDecoder`) and updates accordion state in real-time. On failure, the failed step expands showing the error message.

**No design system commitment** — this is functional scaffolding. The definitive UI will be designed later.

## Security

- **Auth:** JWT with System Administrator role (role ID "0"). Reject all other roles with 403.
- **Password:** Hashed before storage using Etendo core's hashing algorithm.
- **Input validation:** All fields required, email format for adminUser, ISO codes validated against DB before starting steps.
- **Duplicate check:** Fail fast if client name already exists.
- **Rate limiting:** Consider in v2 (not critical for admin-only endpoint).

## Known Legacy Issues (improve in v2)

1. **Dual admin users** — Client admin + Org admin is confusing. Should be a single admin user with role-based scoping. Kept for backward compatibility with SaaS module patterns.
2. **Hardcoded reference data** — Price lists, doc types, and product categories are fixed. v2 should support templates or configuration-driven seeding.
3. **Single org per request** — Creating multiple orgs for a client requires multiple API calls. v2 could support batching.

## Out of Scope (v2)

- Bulk import of products/BPs via CSV
- Async job-based execution
- JDBC savepoints for partial rollback / step retry
- Custom reference data templates
- Multi-org creation in single request
- Copilot AI guided setup (like SaaS module's assistants)
- Unified single admin user

## Testing Strategy

- **Integration test:** Full onboarding flow extending OBBaseTest — create client, verify all entities exist, verify org is operational, cleanup after test
- **Rollback test:** Force failure at each step (e.g., invalid currency code at step 6), verify nothing persists in DB
- **Contract test:** Validate NDJSON response format — step progression, final result line, failure format
- **Duplicate test:** Call onboarding twice with same client name, verify second call fails fast
- **Auth test:** Call without JWT, with non-admin JWT — verify 401/403
