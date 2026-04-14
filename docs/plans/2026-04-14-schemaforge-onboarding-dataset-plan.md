# Schema Forge Onboarding Dataset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse `referencedata/sampledata/GOClient` in Schema Forge onboarding by generating a curated onboarding dataset and importing it safely into each newly created tenant.

**Architecture:** Keep the existing sampledata folder as the editable source, add a normalization layer that strips bootstrap rows and produces a curated onboarding dataset, then import that dataset explicitly after client and organization creation. The runtime import must use Etendo's standard reference-data importer so each destination client/org receives fresh `AD_REF_DATA_LOADED` mappings instead of reusing source-side IDs.

**Tech Stack:** Java, Etendo/Openbravo DAL, `InitialSetupUtility`, `DataImportService`, referencedata XML, JUnit module tests

---

## File Structure

### Existing files to modify

- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/rest/EtendoGoJwtServlet.java`
  - Add an explicit onboarding dataset import stage after org creation and before finalization.
- `etendo_core/modules/com.etendoerp.go/src-test/src/com/etendoerp/go/...`
  - Add tests for the normalizer/import service and onboarding integration behavior.
- `docs/index.md`
  - Register the new design and plan documents.

### New files to create

- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/onboarding/OnboardingDatasetDefinition.java`
  - Central definition of included/excluded tables and source paths.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/onboarding/OnboardingDatasetNormalizer.java`
  - Builds curated dataset XML from `sampledata/GOClient`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/onboarding/OnboardingDatasetImportService.java`
  - Imports curated dataset XML into the target client/org using Etendo reference-data APIs.
- `etendo_core/modules/com.etendoerp.go/src-test/src/com/etendoerp/go/onboarding/OnboardingDatasetNormalizerTest.java`
  - Verifies normalization rules.
- `etendo_core/modules/com.etendoerp.go/src-test/src/com/etendoerp/go/onboarding/OnboardingDatasetImportServiceTest.java`
  - Verifies import behavior and repeatability assumptions.
- Optional generated artifact path under module referencedata if implementation chooses to persist the normalized dataset rather than keeping it fully in-memory.

---

### Task 1: Lock dataset scope and bootstrap exclusions

**Files:**
- Create: `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/onboarding/OnboardingDatasetDefinition.java`
- Test: `etendo_core/modules/com.etendoerp.go/src-test/src/com/etendoerp/go/onboarding/OnboardingDatasetNormalizerTest.java`

- [ ] **Step 1: Write the failing test for excluded tables**

```java
@Test
public void excludesBootstrapTablesFromOnboardingDataset() {
  assertTrue(OnboardingDatasetDefinition.getExcludedTables().contains("AD_CLIENT"));
  assertTrue(OnboardingDatasetDefinition.getExcludedTables().contains("AD_ORG"));
  assertTrue(OnboardingDatasetDefinition.getExcludedTables().contains("AD_USER"));
  assertTrue(OnboardingDatasetDefinition.getExcludedTables().contains("AD_ROLE"));
  assertTrue(OnboardingDatasetDefinition.getExcludedTables().contains("AD_REF_DATA_LOADED"));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `gradle test --tests com.etendoerp.go.onboarding.OnboardingDatasetNormalizerTest`

Expected: FAIL because `OnboardingDatasetDefinition` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```java
package com.etendoerp.go.onboarding;

import java.util.Set;

public final class OnboardingDatasetDefinition {
  private static final Set<String> EXCLUDED_TABLES = Set.of(
      "AD_CLIENT",
      "AD_ORG",
      "AD_CLIENTINFO",
      "AD_ORGINFO",
      "AD_USER",
      "AD_ROLE",
      "AD_USER_ROLES",
      "AD_ROLE_ORGACCESS",
      "AD_CLIENTMODULE",
      "AD_ORGMODULE",
      "AD_REF_DATA_LOADED",
      "AD_SEQUENCE"
  );

  private OnboardingDatasetDefinition() {
  }

  public static Set<String> getExcludedTables() {
    return EXCLUDED_TABLES;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `gradle test --tests com.etendoerp.go.onboarding.OnboardingDatasetNormalizerTest`

Expected: PASS.

- [ ] **Step 5: Refactor scope into included foundation tables if needed**

Add a second immutable set for the initial foundation scope once the concrete table list is finalized from sampledata dependency analysis.

- [ ] **Step 6: Commit**

```bash
git add etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/onboarding/OnboardingDatasetDefinition.java \
        etendo_core/modules/com.etendoerp.go/src-test/src/com/etendoerp/go/onboarding/OnboardingDatasetNormalizerTest.java
git commit -m "Feature ETP-0000: Define onboarding dataset scope"
```

### Task 2: Build the dataset normalizer from sampledata source

**Files:**
- Create: `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/onboarding/OnboardingDatasetNormalizer.java`
- Test: `etendo_core/modules/com.etendoerp.go/src-test/src/com/etendoerp/go/onboarding/OnboardingDatasetNormalizerTest.java`

- [ ] **Step 1: Write the failing test for removing source-side reference mappings**

```java
@Test
public void removesAdRefDataLoadedFromNormalizedDataset() throws Exception {
  String xml = new OnboardingDatasetNormalizer().buildDatasetXml();

  assertFalse(xml.contains("<AD_REF_DATA_LOADED>"));
}
```

- [ ] **Step 2: Write the failing test for preserving included business tables**

```java
@Test
public void keepsFoundationBusinessTablesInNormalizedDataset() throws Exception {
  String xml = new OnboardingDatasetNormalizer().buildDatasetXml();

  assertTrue(xml.contains("<M_PRODUCT>"));
  assertTrue(xml.contains("<M_LOCATOR>"));
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `gradle test --tests com.etendoerp.go.onboarding.OnboardingDatasetNormalizerTest`

Expected: FAIL because the normalizer does not exist yet.

- [ ] **Step 4: Write minimal implementation that reads sampledata files and filters by table**

Implementation requirements:
- Read XML files from `referencedata/sampledata/GOClient/`
- Parse per-file root entries
- Skip files whose table name is excluded by `OnboardingDatasetDefinition`
- Concatenate remaining table entries into one `<data>...</data>` XML payload
- Preserve original entry order within each source file

Skeleton:

```java
public class OnboardingDatasetNormalizer {
  public String buildDatasetXml() throws Exception {
    StringBuilder xml = new StringBuilder("<?xml version='1.0' encoding='UTF-8'?>\n<data>\n");
    for (Path sourceFile : listSourceFiles()) {
      String tableName = tableName(sourceFile);
      if (OnboardingDatasetDefinition.getExcludedTables().contains(tableName)) {
        continue;
      }
      xml.append(extractTableEntries(Files.readString(sourceFile, StandardCharsets.UTF_8)));
    }
    xml.append("</data>\n");
    return xml.toString();
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `gradle test --tests com.etendoerp.go.onboarding.OnboardingDatasetNormalizerTest`

Expected: PASS.

- [ ] **Step 6: Add a failing test for rejecting unresolved bootstrap references**

```java
@Test
public void doesNotEmitBootstrapTablesEvenWhenReferencedBySourceRows() throws Exception {
  String xml = new OnboardingDatasetNormalizer().buildDatasetXml();

  assertFalse(xml.contains("<AD_USER>"));
  assertFalse(xml.contains("<AD_ROLE>"));
}
```

- [ ] **Step 7: Add the minimal filtering/ref-rewrite logic required to keep the dataset importable**

At this step, if an included business table still references excluded bootstrap objects, either:
- drop that row, or
- rewrite the field later during import using runtime context.

Document the chosen rule in code comments.

- [ ] **Step 8: Run the full normalizer test class**

Run: `gradle test --tests com.etendoerp.go.onboarding.OnboardingDatasetNormalizerTest`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/onboarding/OnboardingDatasetNormalizer.java \
        etendo_core/modules/com.etendoerp.go/src-test/src/com/etendoerp/go/onboarding/OnboardingDatasetNormalizerTest.java
git commit -m "Feature ETP-0000: Normalize onboarding sample dataset"
```

### Task 3: Import curated dataset into a destination client/org

**Files:**
- Create: `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/onboarding/OnboardingDatasetImportService.java`
- Test: `etendo_core/modules/com.etendoerp.go/src-test/src/com/etendoerp/go/onboarding/OnboardingDatasetImportServiceTest.java`

- [ ] **Step 1: Write the failing test for successful dataset import**

```java
@Test
public void importsNormalizedDatasetIntoTargetClientAndOrg() throws Exception {
  ImportResult result = importService.importDataset(targetClientId, targetOrgId);

  assertFalse(result.hasErrorOccured());
  assertFalse(result.getInsertedObjects().isEmpty());
}
```

- [ ] **Step 2: Write the failing test for regenerated reference mappings**

```java
@Test
public void createsReferenceDataStoreRowsForImportedObjects() throws Exception {
  importService.importDataset(targetClientId, targetOrgId);

  long mappingCount = countReferenceMappingsForClient(targetClientId);
  assertTrue(mappingCount > 0L);
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `gradle test --tests com.etendoerp.go.onboarding.OnboardingDatasetImportServiceTest`

Expected: FAIL because the import service does not exist yet.

- [ ] **Step 4: Write minimal import service using the standard Etendo importer**

Implementation requirements:
- Resolve destination `Client` and `Organization` via DAL
- Build normalized XML using `OnboardingDatasetNormalizer`
- Call `DataImportService.getInstance().importDataFromXML(client, org, xml, null)`
- If `ImportResult` has errors, throw an exception with importer details

Skeleton:

```java
public class OnboardingDatasetImportService {
  public ImportResult importDataset(String clientId, String orgId) throws Exception {
    Client client = OBDal.getInstance().get(Client.class, clientId);
    Organization org = OBDal.getInstance().get(Organization.class, orgId);
    String xml = new OnboardingDatasetNormalizer().buildDatasetXml();
    ImportResult result = DataImportService.getInstance().importDataFromXML(client, org, xml, null);
    if (result.hasErrorOccured()) {
      throw new OBException(result.getErrorMessages());
    }
    return result;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `gradle test --tests com.etendoerp.go.onboarding.OnboardingDatasetImportServiceTest`

Expected: PASS.

- [ ] **Step 6: Add a failing repeatability test across two clients**

```java
@Test
public void importsIntoDifferentClientsWithoutReusingSpecificIds() throws Exception {
  ImportResult first = importService.importDataset(firstClientId, firstOrgId);
  ImportResult second = importService.importDataset(secondClientId, secondOrgId);

  assertFalse(first.hasErrorOccured());
  assertFalse(second.hasErrorOccured());
  assertNotEquals(first.getInsertedObjects().get(0).getId(), second.getInsertedObjects().get(0).getId());
}
```

- [ ] **Step 7: Fix any client/org resolution or context issues revealed by the repeatability test**

Expected changes may include:
- enforcing admin mode during import,
- flushing after import,
- counting mappings by target client,
- improving importer error propagation.

- [ ] **Step 8: Run the import-service test class**

Run: `gradle test --tests com.etendoerp.go.onboarding.OnboardingDatasetImportServiceTest`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/onboarding/OnboardingDatasetImportService.java \
        etendo_core/modules/com.etendoerp.go/src-test/src/com/etendoerp/go/onboarding/OnboardingDatasetImportServiceTest.java
git commit -m "Feature ETP-0000: Import curated onboarding dataset"
```

### Task 4: Wire dataset import into Schema Forge onboarding

**Files:**
- Modify: `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/rest/EtendoGoJwtServlet.java`
- Test: `etendo_core/modules/com.etendoerp.go/src-test/src/com/etendoerp/go/rest/...` or onboarding integration test location used by the module

- [ ] **Step 1: Write the failing test for progress reporting of the dataset stage**

```java
@Test
public void onboardingStreamsDatasetStageBetweenOrganizationAndFinalize() {
  // invoke onboarding flow in test harness
  // assert progress events include: setup -> client -> organization -> dataset -> finalize
}
```

- [ ] **Step 2: Write the failing test for surfacing importer failures**

```java
@Test
public void onboardingFailsWhenDatasetImportFails() {
  // force import service failure
  // assert final result is success=false and message contains dataset import error
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `gradle test --tests com.etendoerp.go.rest.*Onboarding*`

Expected: FAIL because onboarding does not yet call the import service.

- [ ] **Step 4: Add explicit dataset import stage to `handleOnboarding(...)`**

Implementation shape:
- After `ensureOrganization(...)` succeeds, resolve the destination org ID if needed
- Send progress: `dataset` / `in_progress`
- Call `OnboardingDatasetImportService.importDataset(clientId, orgId)`
- On success, send progress: `dataset` / `done`
- On failure, send progress: `dataset` / `error` and final result with importer message

Pseudocode:

```java
sendProgress(writer, "dataset", PROGRESS_IN_PROGRESS, "Importing onboarding dataset...");
new OnboardingDatasetImportService().importDataset(clientId, organizationId);
sendProgress(writer, "dataset", "done", "Onboarding dataset imported");
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `gradle test --tests com.etendoerp.go.rest.*Onboarding*`

Expected: PASS.

- [ ] **Step 6: Run focused module tests covering both new services and onboarding flow**

Run: `gradle test --tests com.etendoerp.go.onboarding.OnboardingDatasetNormalizerTest --tests com.etendoerp.go.onboarding.OnboardingDatasetImportServiceTest --tests com.etendoerp.go.rest.*Onboarding*`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/rest/EtendoGoJwtServlet.java \
        etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/onboarding/*.java \
        etendo_core/modules/com.etendoerp.go/src-test/src/com/etendoerp/go/onboarding/*.java \
        etendo_core/modules/com.etendoerp.go/src-test/src/com/etendoerp/go/rest/*.java
git commit -m "Feature ETP-0000: Import onboarding dataset after tenant creation"
```

### Task 5: Register the documentation

**Files:**
- Modify: `docs/index.md`
- Create/keep: `docs/plans/2026-04-14-schemaforge-onboarding-dataset-design.md`
- Create/keep: `docs/plans/2026-04-14-schemaforge-onboarding-dataset-plan.md`

- [ ] **Step 1: Add both new documents to the plans section of `docs/index.md`**

Use entries matching the existing table style, one for the design document and one for the implementation plan.

- [ ] **Step 2: Review the wording for consistency with existing docs index language**

Confirm the entries describe:
- the design document as the architectural decision record,
- the implementation plan as the execution sequence.

- [ ] **Step 3: Commit**

```bash
git add docs/index.md \
        docs/plans/2026-04-14-schemaforge-onboarding-dataset-design.md \
        docs/plans/2026-04-14-schemaforge-onboarding-dataset-plan.md
git commit -m "Feature ETP-0000: Document onboarding dataset design and plan"
```

---

## Self-Review

### Spec coverage

This plan covers:
- dataset normalization from `sampledata/GOClient`,
- bootstrap exclusion rules,
- runtime import into a target client/org,
- onboarding servlet integration,
- repeatability checks,
- documentation registration.

### Placeholder scan

There are no `TODO`/`TBD` placeholders. The only open implementation choice left intentionally flexible is the exact foundation table allowlist, which must be derived from the real sampledata dependency graph during Task 1 and Task 2.

### Type consistency

The plan uses the same proposed class names throughout:
- `OnboardingDatasetDefinition`
- `OnboardingDatasetNormalizer`
- `OnboardingDatasetImportService`

### Expected acceptance commands

Run from module root:

```bash
gradle test --tests com.etendoerp.go.onboarding.OnboardingDatasetNormalizerTest \
            --tests com.etendoerp.go.onboarding.OnboardingDatasetImportServiceTest \
            --tests com.etendoerp.go.rest.*Onboarding*
```
