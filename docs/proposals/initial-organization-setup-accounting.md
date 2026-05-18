# Initial Organization Setup with Automatic Accounting

## Context

This document validates the proposed hybrid approach for `Initial Organization Setup` against the current Etendo source code in this repository.

The product decision for this iteration is:

- use one global accounting package for now
- keep a clean seam to resolve a package by localization/template later
- run onboarding with currency selected in the flow; current target currency is `EUR`
- require `AD_ORG.C_ACCTSCHEMA_ID` to be populated in the final state

## Objective

Make a newly onboarded organization end in a source-valid accounting state without manual follow-up:

- organization type `Legal with Accounting`
- `AD_ORG.C_ACCTSCHEMA_ID` assigned
- `AD_ORG_ACCTSCHEMA` consistent with that schema
- fiscal calendar available
- years and periods available
- base taxes available
- `Allow Period Control = Y`
- `Ready = Y` only after the standard setup validation passes

## What the code confirms

### 1. The resolver/apply split fits the current flow

The current entrypoint is:

- `etendo_core/src/org/openbravo/erpCommon/ad_forms/InitialOrgSetup.java`
- `etendo_core/src/org/openbravo/erpCommon/businessUtility/InitialOrgSetup.java`

`ad_forms.InitialOrgSetup` only collects form inputs and delegates everything to `businessUtility.InitialOrgSetup.createOrganization(...)`.

Inside `createOrganization(...)`, the clean seams are:

1. after duplicate validation and before `insertOrganization(...)` -> resolve which accounting package to use
2. after the organization exists and before accounting/reference-data logic -> apply package wiring to the new org

### 2. `Ready` must remain owned by `AD_Org_Ready`

Current source behavior:

- `AD_ORG.ISREADY` defaults to `N`
- `InitialOrgSetup.createOrganization(...)` does not set `Ready`
- `AD_ORG_READY` performs the standard validation and rolls back on failure

Relevant sources:

- `etendo_core/src-db/database/model/tables/AD_ORG.xml`
- `etendo_core/src-db/database/model/functions/AD_ORG_READY.xml`
- `etendo_core/src-db/database/model/functions/AD_ORG_CHK_READY.xml`
- `etendo_core/src-db/database/model/functions/AD_ORG_CHK_SCHEMAS.xml`
- `etendo_core/src-db/database/model/functions/AD_ORG_CHK_CALENDAR.xml`

This means the onboarding must never force `Ready` with a direct update.

### 3. The current accounting path is creation-first, not reuse-first

The existing `boCreateAccounting` path is implemented through `COAUtility`.

Relevant source:

- `etendo_core/src/org/openbravo/erpCommon/businessUtility/COAUtility.java`

For initial organization setup, `COAUtility` explicitly skips calendar/year creation for org setup, but it still creates a fresh:

- `C_ELEMENT`
- `C_ACCTSCHEMA`
- `C_ELEMENTVALUE`
- `C_ACCTSCHEMA_GL`
- `C_ACCTSCHEMA_DEFAULT`
- `AD_ORG_ACCTSCHEMA`

Therefore the current path cannot be reused as the implementation for a shared global accounting package.

### 4. Organization-level dataset import is not a shared-package mechanism

Relevant sources:

- `etendo_core/src/org/openbravo/erpCommon/businessUtility/InitialSetupUtility.java`
- `etendo_core/src/org/openbravo/service/db/DataImportService.java`
- `etendo_core/src/org/openbravo/dal/xml/EntityResolver.java`

`InitialSetupUtility.insertReferenceData(...)` imports XML using the target organization context. For organization-enabled tables, `EntityResolver.setClientOrganization(...)` assigns the imported rows to the target organization.

This is appropriate for org-scoped reference data, but it is not appropriate for a single reusable package that must be shared instead of cloned on every onboarding.

### 5. The shipped sample data proves the target end state is native

Relevant sample data:

- `etendo_core/referencedata/sampledata/F_B_International_Group/AD_ORG.xml`
- `etendo_core/referencedata/sampledata/F_B_International_Group/AD_ORG_ACCTSCHEMA.xml`
- `etendo_core/referencedata/sampledata/F_B_International_Group/C_ACCTSCHEMA.xml`
- `etendo_core/referencedata/sampledata/F_B_International_Group/C_CALENDAR.xml`
- `etendo_core/referencedata/sampledata/F_B_International_Group/C_YEAR.xml`
- `etendo_core/referencedata/sampledata/F_B_International_Group/C_PERIOD.xml`
- `etendo_core/referencedata/sampledata/F_B_International_Group/C_PERIODCONTROL.xml`
- `etendo_core/referencedata/sampledata/F_B_International_Group/C_TAX.xml`
- `etendo_core/referencedata/sampledata/F_B_International_Group/C_TAXCATEGORY.xml`
- `etendo_core/referencedata/sampledata/F_B_International_Group/C_TAX_ACCT.xml`

The sample shows:

- legal entities with accounting are type `1`
- they own calendars
- they allow period control
- they are ready
- descendant orgs inherit calendar/period-control semantics from the legal entity

This validates the target business state itself.

## Final design decision

## Package model

For this iteration, the accounting package must be treated as a pre-seeded global package, not as org-by-org imported dataset content during onboarding.

The package can still originate from dataset-managed content operationally, but by the time onboarding runs it must already exist once in the client and be resolvable as a reusable source package.

## Resolver responsibility

Introduce an explicit resolver responsibility:

- `resolveAccountingPackage(onboardingContext) -> AccountingPackage`

For this iteration, the resolver returns the single global package and validates that the requested onboarding currency is supported.

Future evolution changes only this resolver layer:

- localization
- country
- template
- equivalent product configuration key

The wiring layer remains unchanged.

## Wiring responsibility

Introduce a separate wiring responsibility:

- `applyAccountingPackageWiring(newOrg, package, onboardingContext)`

The wiring step must:

1. set organization type to `Legal with Accounting`
2. set onboarding currency on the organization
3. set `Allow Period Control = Y`
4. assign `AD_ORG.C_ACCTSCHEMA_ID`
5. guarantee a consistent `AD_ORG_ACCTSCHEMA` row
6. associate the correct fiscal calendar owner path
7. prepare the org so that `AD_Org_Ready` can perform the final standard validation

The derived persist-info fields remain the responsibility of `AD_Org_Ready`:

- `AD_PERIODCONTROLALLOWED_ORG_ID`
- `AD_CALENDAROWNER_ORG_ID`
- `AD_LEGALENTITY_ORG_ID`
- `AD_INHERITEDCALENDAR_ID`
- `AD_BUSINESSUNIT_ORG_ID`

## Validation before `AD_Org_Ready`

The standard ready process is necessary but not sufficient for the business promise of automatic accounting.

Before calling `AD_Org_Ready`, onboarding must validate that the resolved package is complete enough to satisfy the product contract.

### Required package contents

Minimum required:

- `C_ACCTSCHEMA`
- `C_ELEMENT`
- `C_ELEMENTVALUE`
- `C_CALENDAR`
- `C_YEAR`
- `C_PERIOD`
- `C_TAX`

Required consistency companions:

- `AD_ORG_ACCTSCHEMA`
- `C_ACCTSCHEMA_DEFAULT`
- `C_ACCTSCHEMA_ELEMENT`
- `C_ACCTSCHEMA_GL`
- `C_ACCTSCHEMA_TABLE`
- `C_TAXCATEGORY`
- `C_TAX_ACCT`

Optional / not central:

- `C_VALIDCOMBINATION` may exist as derived support data, but it must not be the center of onboarding design

### Period control rule

`C_PERIODCONTROL` for the newly onboarded organization must not be pre-materialized by onboarding.

Reason:

- `AD_ORG_READY` already creates `C_PERIODCONTROL` rows when `Allow Period Control = Y`
- pre-inserting them for the same org risks duplication and breaks the clean lifecycle

Therefore:

- the package must provide calendar + years + periods
- `AD_Org_Ready` must materialize `C_PERIODCONTROL` for the new org

## Proposed flow

1. validate onboarding inputs
2. resolve accounting package from onboarding context
3. create the new organization
4. apply accounting wiring to the new organization
5. validate package completeness for the selected package
6. call the standard `AD_Org_Ready` process
7. commit only if the ready process succeeds

## Source-grounded risks to avoid

### Reusing `COAUtility` as-is

Not valid for this design.

`COAUtility` creates a new schema instead of linking an existing package.

### Importing the package as org-level reference data during onboarding

Not valid for this design.

The current dataset import path assigns organization-enabled rows to the target org and behaves like cloning, not shared reuse.

### Marking `Ready` before wiring is complete

Not valid for this design.

Runtime code already treats `Ready` as a lifecycle gate.

### Using `C_VALIDCOMBINATION` as the core contract

Not valid for this design.

It can remain derived support data, but the org setup contract must be expressed in terms of schema, calendar, periods, taxes, and standard ready validation.

## Implementation seam in current code

Primary target:

- `etendo_core/src/org/openbravo/erpCommon/businessUtility/InitialOrgSetup.java`

Recommended internal split:

- `resolveAccountingPackage(...)`
- `applyAccountingPackageWiring(...)`
- `validateAccountingPackage(...)`
- existing final invocation of standard readiness logic

## Acceptance criteria

The design is considered correct when a new organization created through onboarding:

- ends as `Legal with Accounting`
- has `AD_ORG.C_ACCTSCHEMA_ID` populated
- has a consistent `AD_ORG_ACCTSCHEMA` linkage
- has a usable fiscal calendar
- has years and periods available
- has base taxes available
- has `Allow Period Control = Y`
- reaches `Ready = Y` only through the standard ready process, with no manual post-setup steps

## Status

Validated against current source with product decisions resolved on 2026-04-21.

Ready to be converted into an implementation plan.