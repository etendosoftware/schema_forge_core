# Schema Forge Onboarding Dataset — Design Document

**Date:** 2026-04-14
**Status:** Approved
**Decision maker:** Sebastian Barrozo

## Problem

Schema Forge onboarding currently creates a new Etendo environment by calling `InitialClientSetup.createClient(...)` and `InitialOrgSetup.createOrganization(...)` from `EtendoGoJwtServlet.handleOnboarding(...)`. It does not import any curated business dataset afterward.

The module already contains sample client data under `etendo_core/modules/com.etendoerp.go/referencedata/sampledata/GOClient/`, but those files are not safe to import directly during onboarding:

- They contain hardcoded client, organization, user, role, warehouse, and locator IDs from the source tenant.
- They include bootstrap entities already created by onboarding (`AD_CLIENT`, `AD_ORG`, `AD_USER`, `AD_ROLE`, trees, sequences, and related metadata).
- They include source-side `AD_REF_DATA_LOADED` rows, which must never be copied into another client as-is.
- They include transactional/demo records in addition to master data, making repeated runtime imports harder to keep deterministic.

We need a repeatable way to reuse that source material while allowing onboarding to reinsert the dataset many times without ID collisions or bootstrap conflicts.

## Solution

Treat `referencedata/sampledata/GOClient/` as the source of truth for demo content, but do not import it directly at runtime.

Instead, introduce a curated onboarding dataset flow:

1. Normalize the sampledata source into a dedicated onboarding dataset artifact.
2. Exclude bootstrap and tenant-identity tables from that artifact.
3. Import the curated dataset explicitly after client and organization creation.
4. Let Etendo's standard reference-data importer create fresh `AD_REF_DATA_LOADED` mappings per target client and organization.

This keeps the existing source data useful while moving runtime onboarding onto the import path that is already designed to remap generic IDs to client-specific IDs.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime input | Curated onboarding dataset, not raw `sampledata/GOClient` | Raw sampledata contains bootstrap rows and source-specific identity data |
| Import mechanism | `InitialSetupUtility.insertReferenceData(...)` / `DataImportService.importDataFromXML(...)` | Existing Etendo path already persists `AD_REF_DATA_LOADED` for the destination tenant |
| Onboarding hook | Explicit post-org-import step in `EtendoGoJwtServlet` | Avoids coupling onboarding to all module datasets through `strModules` |
| Scope of first iteration | Foundation seed only | Lower risk than importing full demo transactions during tenant creation |
| Source-to-runtime mapping | Generic IDs kept in dataset; destination-specific IDs created by import | Matches Etendo reference-data model |
| `AD_REF_DATA_LOADED` handling | Never copy source rows; regenerate on import | Source mappings are invalid outside the origin tenant |

## Dataset Scope

### Included in the first iteration

The first iteration should only import business foundation data that is useful immediately after onboarding and can be reinserted safely:

- Warehouses and locators
- Price lists and price list versions
- Product categories
- Tax categories and tax rates
- Products and product prices
- Business partner categories
- Payment methods and financial-account related setup
- Fiscal calendar and periods if they are not already created elsewhere in onboarding

The exact table list will be finalized during implementation, but the rule is: include reusable operating data, exclude tenant identity and user security bootstrap.

### Explicitly excluded

The curated onboarding dataset must exclude, at minimum:

- `AD_CLIENT`
- `AD_ORG`
- `AD_CLIENTINFO`
- `AD_ORGINFO`
- `AD_USER`
- `AD_ROLE`
- `AD_USER_ROLES`
- `AD_ROLE_ORGACCESS`
- `AD_CLIENTMODULE`
- `AD_ORGMODULE`
- `AD_REF_DATA_LOADED`
- `AD_SEQUENCE`
- Trees and nodes created automatically by `InitialClientSetup` / `InitialOrgSetup`

If any foundation table still carries references into one of these bootstrap entities, the normalizer must either:

- rewrite that reference to the runtime-created object, or
- drop the dependent row from the curated dataset.

## Import Strategy

### Why standard reference-data import is the right mechanism

`InitialSetupUtility.insertReferenceData(...)` loads dataset XML and delegates to `DataImportService.importDataFromXML(...)`.

That path is important because it:

- imports against a concrete destination client and organization,
- resolves references through Etendo's reference-data machinery,
- persists fresh `AD_REF_DATA_LOADED` rows for inserted records,
- supports repeated imports by keeping a mapping from the generic dataset ID to the specific inserted record ID.

This is the behavior needed for “insert this many times into newly created tenants”.

### Why full client import is not the preferred path

`DataImportService.importClientData(...)` plus `ClientImportProcessor` is built for importing a full exported client XML, including client-level identity objects.

That does not fit the onboarding architecture because onboarding already creates the tenant using `InitialClientSetup` and `InitialOrgSetup`. Re-importing client bootstrap data would duplicate responsibilities and increase collision risk for usernames, roles, and client naming.

## Normalization Pipeline

A dedicated normalization step will produce the onboarding dataset artifact from the existing sampledata source.

### Inputs

- Source folder: `etendo_core/modules/com.etendoerp.go/referencedata/sampledata/GOClient/`

### Outputs

- Curated onboarding dataset XML in standard reference-data format
- Optional machine-readable manifest describing:
  - included tables,
  - excluded tables,
  - runtime substitutions,
  - validation warnings

### Required transformations

1. Remove source `AD_REF_DATA_LOADED` content entirely.
2. Remove bootstrap/security rows not safe for multi-tenant reinsertion.
3. Keep only rows whose references remain valid after exclusion.
4. Rewrite references that must point to runtime-created tenant objects.
5. Validate that the resulting dataset can be imported into a newly created client/org without introducing global uniqueness collisions.

## Runtime Flow

The onboarding flow becomes:

1. Validate request
2. Create client
3. Create organization
4. Resolve runtime admin/client/org context
5. Import curated onboarding dataset into that client/org
6. Finalize organization readiness
7. Return success

The dataset import must be explicit and visible in onboarding progress reporting so failures are attributable to the right stage.

## Failure Semantics

If dataset import fails:

- onboarding must return a failed final result,
- the progress stream must identify the dataset stage as the source of failure,
- the transaction must not pretend the environment is ready,
- the error should include the underlying import error messages from the Etendo importer.

This is important because a half-created tenant with missing master data is more dangerous than a clean onboarding failure.

## Testing Strategy

### Unit/integration coverage required

1. Normalizer test: bootstrap tables are excluded from the generated onboarding dataset.
2. Normalizer test: source `AD_REF_DATA_LOADED` is not present in the generated artifact.
3. Import test: curated dataset imports successfully into a freshly created client/org.
4. Repeatability test: importing the curated dataset into two different clients succeeds and produces different specific IDs per client.
5. Idempotency-style test: re-import into the same client does not create obvious duplicate foundation rows when the reference-data mapping is present.
6. Onboarding integration test: servlet progress includes the dataset stage and surfaces importer failures.

## Files Expected to Change

- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/rest/EtendoGoJwtServlet.java`
- New Java classes under `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/onboarding/` for dataset normalization/import orchestration
- New tests under `etendo_core/modules/com.etendoerp.go/src-test/src/com/etendoerp/go/`
- New curated dataset artifact under the module referencedata structure

## Open Boundaries Chosen for Implementation

The first implementation intentionally does not attempt to import the full transactional demo contained in `sampledata/GOClient`.

That data can be added later as a second dataset layer once the foundation import is stable and repeatable. The first slice optimizes for safe tenant creation, not for maximizing demo richness.
