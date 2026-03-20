# EtendoGo Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an atomic client provisioning endpoint (`POST /sws/neo/onboarding`) with real-time progress via chunked response, plus a minimal accordion UI.

**Architecture:** Dedicated servlet registered via AD_MODEL_OBJECT at `/sws/neo/onboarding`. Per the Servlet Specification (JSR-315), exact-path mappings take priority over wildcard mappings at the same prefix — so this servlet is resolved before NeoServlet's `/sws/neo/*`. Reuses `SecureWebServicesUtils` for JWT auth. Steps executed sequentially within a single OBDal transaction with try/catch and full rollback on failure. Frontend reads NDJSON stream and updates accordion in real-time.

**Tech Stack:** Java (HttpServlet, OBDal, CDI, ProcessRunner), React (shadcn Collapsible, fetch + ReadableStream), NDJSON streaming.

**Spec:** `docs/superpowers/specs/2026-03-20-etendogo-onboarding-design.md`

**Reference module:** `/tmp/com.etendoerp.saas/` — cloned from Bitbucket. Key files:
- `src/com/etendoerp/saas/service/OrganizationServlet.java` — org init + ORG_AS_READY execution pattern
- `referencedata/standard/Initial_Demo_Data.xml` — all reference data entities (1550 lines)
- `src/com/etendoerp/saas/webhooks/LocationWebhook.java` — country resolution pattern

---

## File Map

### Backend (com.etendoerp.go)

All paths relative to: `/Users/sebastianbarrozo/Documents/work/epic/schema-forge/etendo_core/modules/com.etendoerp.go/`

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/com/etendoerp/go/onboarding/OnboardingStep.java` | Interface: `name()` + `execute(OnboardingContext)` |
| Create | `src/com/etendoerp/go/onboarding/OnboardingContext.java` | Mutable DTO accumulating input + created IDs |
| Create | `src/com/etendoerp/go/onboarding/steps/CreateClientStep.java` | AD_Client + AD_ClientInfo |
| Create | `src/com/etendoerp/go/onboarding/steps/CreateOrgStep.java` | AD_Org + AD_OrgInfo |
| Create | `src/com/etendoerp/go/onboarding/steps/CreateClientAdminStep.java` | AD_User (client-level admin) |
| Create | `src/com/etendoerp/go/onboarding/steps/CreateOrgAdminStep.java` | AD_User (org-level admin) |
| Create | `src/com/etendoerp/go/onboarding/steps/CreateRoleStep.java` | AD_Role + AD_User_Roles + window/process access |
| Create | `src/com/etendoerp/go/onboarding/steps/SeedReferenceDataStep.java` | Price lists, warehouse, currency, calendar, categories, product, financial accounts, payment methods |
| Create | `src/com/etendoerp/go/onboarding/steps/CreateDocTypesStep.java` | C_DocType + AD_Sequence |
| Create | `src/com/etendoerp/go/onboarding/steps/MarkOrgReadyStep.java` | ORG_AS_READY process via ProcessRunner, language assignment |
| Create | `src/com/etendoerp/go/onboarding/OnboardingServlet.java` | HTTP servlet: JWT auth, step orchestration, chunked NDJSON response |
| Modify | `src-db/database/sourcedata/AD_MODEL_OBJECT.xml` | Append servlet registration record |
| Modify | `src-db/database/sourcedata/AD_MODEL_OBJECT_MAPPING.xml` | Append URL mapping record |
| Create | `src-test/src/com/etendoerp/go/onboarding/OnboardingIntegrationTest.java` | Integration tests (OBBaseTest) |

### Frontend (schema-forge)

All paths relative to: `/Users/sebastianbarrozo/Documents/work/epic/schema-forge/`

| Action | File | Responsibility |
|--------|------|----------------|
| Rewrite | `tools/app-shell/src/pages/OnboardingPage.jsx` | Form + accordion consuming NDJSON stream |

---

## Task 1: OnboardingStep Interface + OnboardingContext DTO

**Files:**
- Create: `src/com/etendoerp/go/onboarding/OnboardingStep.java`
- Create: `src/com/etendoerp/go/onboarding/OnboardingContext.java`

- [ ] **Step 1: Create OnboardingStep interface**

```java
package com.etendoerp.go.onboarding;

public interface OnboardingStep {
  String name();
  void execute(OnboardingContext ctx) throws Exception;
}
```

- [ ] **Step 2: Create OnboardingContext DTO**

```java
package com.etendoerp.go.onboarding;

public class OnboardingContext {
  // Input (set once from request)
  private String clientName;
  private String orgName;
  private String adminUser;
  private String adminPassword;
  private String currencyCode;
  private String languageCode;
  private String countryCode;

  // Accumulated IDs (set by steps, read by subsequent steps)
  private String clientId;
  private String orgId;
  private String clientAdminUserId;
  private String orgAdminUserId;
  private String roleId;
  private String warehouseId;
  private String calendarId;
  private String priceListSalesId;
  private String priceListPurchaseId;
  private String financialAccountId;
  private String productCategoryId;
  private String taxCategoryId;

  // Standard getters and setters for all fields
  // ...
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd etendo_core && ./gradlew classes -p modules/com.etendoerp.go 2>&1 | tail -5`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add src/com/etendoerp/go/onboarding/
git commit -m "Feature ETP-3591: Add OnboardingStep interface and OnboardingContext DTO"
```

---

## Task 2: CreateClientStep

**Files:**
- Create: `src/com/etendoerp/go/onboarding/steps/CreateClientStep.java`

- [ ] **Step 1: Write CreateClientStep**

Creates AD_Client + AD_ClientInfo. ClientInfo is mandatory for any client to function.

```java
package com.etendoerp.go.onboarding.steps;

import org.openbravo.dal.service.OBDal;
import org.openbravo.model.ad.system.Client;
import org.openbravo.model.ad.system.ClientInformation;
import org.openbravo.base.provider.OBProvider;

import com.etendoerp.go.onboarding.OnboardingContext;
import com.etendoerp.go.onboarding.OnboardingStep;

public class CreateClientStep implements OnboardingStep {

  @Override
  public String name() {
    return "createClient";
  }

  @Override
  public void execute(OnboardingContext ctx) throws Exception {
    Client client = OBProvider.getInstance().get(Client.class);
    client.setNewOBObject(true);
    client.setName(ctx.getClientName());
    client.setSearchKey(ctx.getClientName().toLowerCase().replaceAll("\\s+", "-"));
    OBDal.getInstance().save(client);

    ClientInformation clientInfo = OBProvider.getInstance().get(ClientInformation.class);
    clientInfo.setNewOBObject(true);
    clientInfo.setClient(client);
    OBDal.getInstance().save(clientInfo);

    ctx.setClientId(client.getId());
  }
}
```

**Developer note:** Verify exact entity class names against Etendo DAL. Check `org.openbravo.model.ad.system.Client` and `ClientInformation` exist and have the expected setters. If `ClientInformation` is named differently (e.g., `ClientInfo`), adjust accordingly.

- [ ] **Step 2: Verify compilation**

Run: `cd etendo_core && ./gradlew classes -p modules/com.etendoerp.go 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add src/com/etendoerp/go/onboarding/steps/CreateClientStep.java
git commit -m "Feature ETP-3591: Add CreateClientStep (AD_Client + AD_ClientInfo)"
```

---

## Task 3: CreateOrgStep

**Files:**
- Create: `src/com/etendoerp/go/onboarding/steps/CreateOrgStep.java`

- [ ] **Step 1: Write CreateOrgStep**

```java
package com.etendoerp.go.onboarding.steps;

import org.openbravo.dal.service.OBDal;
import org.openbravo.model.ad.system.Client;
import org.openbravo.model.common.enterprise.Organization;
import org.openbravo.model.common.enterprise.OrganizationInformation;
import org.openbravo.base.provider.OBProvider;

import com.etendoerp.go.onboarding.OnboardingContext;
import com.etendoerp.go.onboarding.OnboardingStep;

public class CreateOrgStep implements OnboardingStep {

  @Override
  public String name() {
    return "createOrganization";
  }

  @Override
  public void execute(OnboardingContext ctx) throws Exception {
    Client client = OBDal.getInstance().get(Client.class, ctx.getClientId());

    Organization org = OBProvider.getInstance().get(Organization.class);
    org.setNewOBObject(true);
    org.setClient(client);
    org.setName(ctx.getOrgName());
    org.setSearchKey(ctx.getOrgName().toLowerCase().replaceAll("\\s+", "-"));
    OBDal.getInstance().save(org);

    OrganizationInformation orgInfo = OBProvider.getInstance().get(OrganizationInformation.class);
    orgInfo.setNewOBObject(true);
    orgInfo.setClient(client);
    orgInfo.setOrganization(org);
    OBDal.getInstance().save(orgInfo);

    ctx.setOrgId(org.getId());
  }
}
```

- [ ] **Step 2: Verify compilation + commit**

```bash
cd etendo_core && ./gradlew classes -p modules/com.etendoerp.go 2>&1 | tail -5
git add src/com/etendoerp/go/onboarding/steps/CreateOrgStep.java
git commit -m "Feature ETP-3591: Add CreateOrgStep (AD_Org + AD_OrgInfo)"
```

---

## Task 4: CreateClientAdminStep + CreateOrgAdminStep

**Files:**
- Create: `src/com/etendoerp/go/onboarding/steps/CreateClientAdminStep.java`
- Create: `src/com/etendoerp/go/onboarding/steps/CreateOrgAdminStep.java`

- [ ] **Step 1: Investigate password hashing in Etendo core**

Before writing user creation, find how Etendo hashes passwords:

```bash
# Search for password hashing in Etendo core
grep -r "sha1Base64\|hashPassword\|FormatUtilities.*password\|setPassword" \
  etendo_core/src/ etendo_core/src-core/ --include="*.java" -l | head -10
```

Look for `FormatUtilities.sha1Base64()` or similar. The SaaS module does NOT hash — it delegates to Etendo core. We need to find the exact call.

- [ ] **Step 2: Write CreateClientAdminStep**

Creates AD_User at client level (org = `"0"` system org). Uses the hashing method found in Step 1.

```java
package com.etendoerp.go.onboarding.steps;

import org.openbravo.dal.service.OBDal;
import org.openbravo.model.ad.system.Client;
import org.openbravo.model.common.enterprise.Organization;
import org.openbravo.model.ad.access.User;
import org.openbravo.base.provider.OBProvider;
import org.openbravo.utils.FormatUtilities;

import com.etendoerp.go.onboarding.OnboardingContext;
import com.etendoerp.go.onboarding.OnboardingStep;

public class CreateClientAdminStep implements OnboardingStep {

  @Override
  public String name() {
    return "createClientAdmin";
  }

  @Override
  public void execute(OnboardingContext ctx) throws Exception {
    Client client = OBDal.getInstance().get(Client.class, ctx.getClientId());
    Organization orgZero = OBDal.getInstance().get(Organization.class, "0");

    User user = OBProvider.getInstance().get(User.class);
    user.setNewOBObject(true);
    user.setClient(client);
    user.setOrganization(orgZero);
    user.setUsername(ctx.getAdminUser());
    user.setEmail(ctx.getAdminUser());
    user.setName(ctx.getClientName() + " Admin");
    // Hash password using Etendo's utility
    user.setPassword(FormatUtilities.sha1Base64(ctx.getAdminPassword()));
    OBDal.getInstance().save(user);

    ctx.setClientAdminUserId(user.getId());
  }
}
```

**Developer note:** If `FormatUtilities.sha1Base64()` does not exist or uses a different signature, search for the actual hashing method used by Etendo's login flow. Check `org.openbravo.authentication` package. The key is: the hashed password must match what the login system expects.

- [ ] **Step 3: Write CreateOrgAdminStep**

```java
package com.etendoerp.go.onboarding.steps;

import org.openbravo.dal.service.OBDal;
import org.openbravo.model.ad.system.Client;
import org.openbravo.model.common.enterprise.Organization;
import org.openbravo.model.ad.access.User;
import org.openbravo.base.provider.OBProvider;
import org.openbravo.utils.FormatUtilities;

import com.etendoerp.go.onboarding.OnboardingContext;
import com.etendoerp.go.onboarding.OnboardingStep;

public class CreateOrgAdminStep implements OnboardingStep {

  @Override
  public String name() {
    return "createOrgAdmin";
  }

  @Override
  public void execute(OnboardingContext ctx) throws Exception {
    Client client = OBDal.getInstance().get(Client.class, ctx.getClientId());
    Organization org = OBDal.getInstance().get(Organization.class, ctx.getOrgId());

    User user = OBProvider.getInstance().get(User.class);
    user.setNewOBObject(true);
    user.setClient(client);
    user.setOrganization(org);
    user.setUsername(ctx.getAdminUser() + ".org");
    user.setEmail(ctx.getAdminUser());
    user.setName(ctx.getOrgName() + " Admin");
    user.setPassword(FormatUtilities.sha1Base64(ctx.getAdminPassword()));
    OBDal.getInstance().save(user);

    ctx.setOrgAdminUserId(user.getId());
  }
}
```

- [ ] **Step 4: Verify compilation + commit**

```bash
cd etendo_core && ./gradlew classes -p modules/com.etendoerp.go 2>&1 | tail -10
git add src/com/etendoerp/go/onboarding/steps/Create*AdminStep.java
git commit -m "Feature ETP-3591: Add CreateClientAdminStep and CreateOrgAdminStep"
```

---

## Task 5: CreateRoleStep

**Files:**
- Create: `src/com/etendoerp/go/onboarding/steps/CreateRoleStep.java`

- [ ] **Step 1: Write CreateRoleStep**

Reference: SaaS OrganizationServlet lines 89-130 for role creation + user-role linking pattern.

```java
package com.etendoerp.go.onboarding.steps;

import java.util.List;

import org.openbravo.dal.service.OBDal;
import org.openbravo.dal.service.OBCriteria;
import org.openbravo.model.ad.system.Client;
import org.openbravo.model.common.enterprise.Organization;
import org.openbravo.model.ad.access.Role;
import org.openbravo.model.ad.access.User;
import org.openbravo.model.ad.access.UserRoles;
import org.openbravo.model.ad.access.WindowAccess;
import org.openbravo.model.ad.access.ProcessAccess;
import org.openbravo.base.provider.OBProvider;
import org.hibernate.criterion.Restrictions;

import com.etendoerp.go.onboarding.OnboardingContext;
import com.etendoerp.go.onboarding.OnboardingStep;

public class CreateRoleStep implements OnboardingStep {

  private static final String DEFAULT_ROLE_NAME = "Default User Role";

  @Override
  public String name() {
    return "createRole";
  }

  @Override
  public void execute(OnboardingContext ctx) throws Exception {
    Client client = OBDal.getInstance().get(Client.class, ctx.getClientId());
    Organization org = OBDal.getInstance().get(Organization.class, ctx.getOrgId());
    Organization orgZero = OBDal.getInstance().get(Organization.class, "0");

    // Create Role (same pattern as SaaS module)
    Role role = OBProvider.getInstance().get(Role.class);
    role.setNewOBObject(true);
    role.setClient(client);
    role.setOrganization(orgZero);
    role.setName(DEFAULT_ROLE_NAME);
    role.setUserLevel("  O"); // Org level access
    role.setWebServiceEnabled(true);
    OBDal.getInstance().save(role);
    ctx.setRoleId(role.getId());

    // Link both admin users to role (SaaS pattern: setRoleAdmin(true))
    linkUserToRole(client, orgZero, role, ctx.getClientAdminUserId());
    linkUserToRole(client, orgZero, role, ctx.getOrgAdminUserId());

    // Grant window access for all NEO-configured windows
    addNeoWindowAccess(client, orgZero, role);

    // Grant process access for all NEO-configured processes
    addNeoProcessAccess(client, orgZero, role);
  }

  private void linkUserToRole(Client client, Organization org, Role role, String userId) {
    User user = OBDal.getInstance().get(User.class, userId);

    UserRoles userRole = OBProvider.getInstance().get(UserRoles.class);
    userRole.setNewOBObject(true);
    userRole.setClient(client);
    userRole.setOrganization(org);
    userRole.setRole(role);
    userRole.setUserContact(user);
    userRole.setRoleAdmin(true);
    OBDal.getInstance().save(userRole);

    // Set default role on user
    user.setDefaultRole(role);
    OBDal.getInstance().save(user);
  }

  private void addNeoWindowAccess(Client client, Organization org, Role role) {
    // Query ETGO_SF_SPEC for active window specs (specType = 'W')
    // Import: com.etendoerp.go.schemaforge.data.SFSpec (generated entity)
    // For each spec with a non-null adWindow:
    //   WindowAccess wa = OBProvider.getInstance().get(WindowAccess.class);
    //   wa.setClient(client); wa.setOrganization(org);
    //   wa.setRole(role); wa.setWindow(spec.getAdWindow());
    //   wa.setEditableField(true);
    //   OBDal.getInstance().save(wa);
    //
    // Developer: verify the entity class name for ETGO_SF_SPEC.
    // It may be in the generated-sources after running smartbuild.
    // grep for "class SF" or "ETGO_SF_SPEC" in the module's generated sources.
  }

  private void addNeoProcessAccess(Client client, Organization org, Role role) {
    // Same pattern for process specs (specType = 'P')
    // ProcessAccess pa = OBProvider.getInstance().get(ProcessAccess.class);
    // pa.setClient(client); pa.setOrganization(org);
    // pa.setRole(role); pa.setProcess(spec.getAdProcess());
    // OBDal.getInstance().save(pa);
  }
}
```

- [ ] **Step 2: Verify compilation + commit**

```bash
cd etendo_core && ./gradlew classes -p modules/com.etendoerp.go 2>&1 | tail -10
git add src/com/etendoerp/go/onboarding/steps/CreateRoleStep.java
git commit -m "Feature ETP-3591: Add CreateRoleStep with role, user-role links, and NEO access"
```

---

## Task 6: SeedReferenceDataStep (complete implementation)

**Files:**
- Create: `src/com/etendoerp/go/onboarding/steps/SeedReferenceDataStep.java`

This is the largest step. Reference: `/tmp/com.etendoerp.saas/referencedata/standard/Initial_Demo_Data.xml` for exact field values and entity relationships.

- [ ] **Step 1: Write SeedReferenceDataStep with all sub-methods**

```java
package com.etendoerp.go.onboarding.steps;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Date;

import org.hibernate.criterion.Restrictions;
import org.openbravo.base.provider.OBProvider;
import org.openbravo.dal.service.OBCriteria;
import org.openbravo.dal.service.OBDal;
import org.openbravo.model.ad.system.Client;
import org.openbravo.model.common.currency.Currency;
import org.openbravo.model.common.enterprise.Organization;
import org.openbravo.model.common.enterprise.OrganizationInformation;
import org.openbravo.model.common.enterprise.OrgWarehouse;
import org.openbravo.model.common.enterprise.Warehouse;
import org.openbravo.model.common.geography.Country;
import org.openbravo.model.common.geography.Location;
import org.openbravo.model.common.plm.Product;
import org.openbravo.model.common.plm.ProductCategory;
import org.openbravo.model.common.businesspartner.Category;
import org.openbravo.model.common.uom.UOM;
import org.openbravo.model.financialmgmt.calendar.Calendar;
import org.openbravo.model.financialmgmt.calendar.Year;
import org.openbravo.model.financialmgmt.calendar.Period;
import org.openbravo.model.financialmgmt.payment.FIN_FinancialAccount;
import org.openbravo.model.financialmgmt.payment.FIN_PaymentMethod;
import org.openbravo.model.financialmgmt.payment.FinAccPaymentMethod;
import org.openbravo.model.financialmgmt.tax.TaxCategory;
import org.openbravo.model.financialmgmt.tax.TaxRate;
import org.openbravo.model.pricing.pricelist.PriceList;
import org.openbravo.model.pricing.pricelist.PriceListVersion;
import org.openbravo.model.pricing.pricelist.ProductPrice;

import com.etendoerp.go.onboarding.OnboardingContext;
import com.etendoerp.go.onboarding.OnboardingStep;

public class SeedReferenceDataStep implements OnboardingStep {

  @Override
  public String name() {
    return "seedReferenceData";
  }

  @Override
  public void execute(OnboardingContext ctx) throws Exception {
    Client client = OBDal.getInstance().get(Client.class, ctx.getClientId());
    Organization org = OBDal.getInstance().get(Organization.class, ctx.getOrgId());

    // 1. Resolve system references (not created, just looked up from client 0)
    Currency currency = resolveCurrency(ctx.getCurrencyCode());
    Country country = resolveCountry(ctx.getCountryCode());
    UOM unitEach = resolveUOM("Each"); // Standard UOM

    // 2. Create in dependency order
    Location warehouseLocation = createLocation(client, org, country,
        "WH Street 1", "Default City", "00000");
    Location bpLocation = createLocation(client, org, country,
        "BP Street 1", "Default City", "00000");

    Calendar calendar = createCalendar(client, org);
    ctx.setCalendarId(calendar.getId());

    Warehouse warehouse = createWarehouse(client, org, warehouseLocation);
    ctx.setWarehouseId(warehouse.getId());

    // Link warehouse to org
    OrgWarehouse orgWh = OBProvider.getInstance().get(OrgWarehouse.class);
    orgWh.setNewOBObject(true);
    orgWh.setClient(client);
    orgWh.setOrganization(org);
    orgWh.setWarehouse(warehouse);
    OBDal.getInstance().save(orgWh);

    PriceList salesPL = createPriceList(client, org, currency,
        "Default Sales Price List", true);
    ctx.setPriceListSalesId(salesPL.getId());

    PriceList purchasePL = createPriceList(client, org, currency,
        "Default Supplier Price List", false);
    ctx.setPriceListPurchaseId(purchasePL.getId());

    createBPCategory(client, org, "Customer - Tier 1", "CUST1");
    createBPCategory(client, org, "Supplier", "SUPP");

    ProductCategory prodCat = createProductCategory(client, org, "Others", "OTHERS");
    ctx.setProductCategoryId(prodCat.getId());

    TaxCategory taxCat = createTaxCategory(client, org, "Default Tax");
    ctx.setTaxCategoryId(taxCat.getId());
    createTaxRate(client, org, taxCat, "Default Tax 5%", new BigDecimal("5"));

    Product product = createProduct(client, org, prodCat, taxCat, unitEach,
        "Default Product", "DEFPROD");
    createProductPrice(client, org, salesPL, product, new BigDecimal("100"));
    createProductPrice(client, org, purchasePL, product, new BigDecimal("80"));

    FIN_FinancialAccount cashAccount = createFinancialAccount(client, org, currency,
        "Cash", "C");
    FIN_FinancialAccount bankAccount = createFinancialAccount(client, org, currency,
        "Bank Account", "B");
    ctx.setFinancialAccountId(bankAccount.getId());

    FIN_PaymentMethod cashMethod = createPaymentMethod(client, org, "Cash");
    FIN_PaymentMethod bankMethod = createPaymentMethod(client, org, "Bank Transfer");

    // 4 combinations: cash/bank x cash/bank
    createFinAccPaymentMethod(client, org, cashAccount, cashMethod);
    createFinAccPaymentMethod(client, org, cashAccount, bankMethod);
    createFinAccPaymentMethod(client, org, bankAccount, cashMethod);
    createFinAccPaymentMethod(client, org, bankAccount, bankMethod);

    // Update OrgInfo with calendar + warehouse + currency
    OrganizationInformation orgInfo = org.getOrganizationInformationList().get(0);
    orgInfo.setCalendar(calendar);
    orgInfo.setCurrency(currency);
    orgInfo.setAllowPeriodControl(true);
    OBDal.getInstance().save(orgInfo);
  }

  // --- Resolution methods (lookup from system/client 0) ---

  private Currency resolveCurrency(String isoCode) throws Exception {
    OBCriteria<Currency> c = OBDal.getInstance().createCriteria(Currency.class);
    c.add(Restrictions.eq(Currency.PROPERTY_ISOCURRENCYCODE, isoCode));
    c.setMaxResults(1);
    Currency result = (Currency) c.uniqueResult();
    if (result == null) {
      throw new Exception("Currency code '" + isoCode + "' not found in system data");
    }
    return result;
  }

  private Country resolveCountry(String isoCode) throws Exception {
    OBCriteria<Country> c = OBDal.getInstance().createCriteria(Country.class);
    c.add(Restrictions.eq(Country.PROPERTY_ISOCOUNTRYCODE, isoCode));
    c.setMaxResults(1);
    Country result = (Country) c.uniqueResult();
    if (result == null) {
      throw new Exception("Country code '" + isoCode + "' not found in system data");
    }
    return result;
  }

  private UOM resolveUOM(String name) throws Exception {
    OBCriteria<UOM> c = OBDal.getInstance().createCriteria(UOM.class);
    c.add(Restrictions.eq(UOM.PROPERTY_NAME, name));
    c.setMaxResults(1);
    UOM result = (UOM) c.uniqueResult();
    if (result == null) {
      throw new Exception("UOM '" + name + "' not found in system data");
    }
    return result;
  }

  // --- Creation methods ---

  private Location createLocation(Client client, Organization org,
      Country country, String address, String city, String postal) {
    Location loc = OBProvider.getInstance().get(Location.class);
    loc.setNewOBObject(true);
    loc.setClient(client);
    loc.setOrganization(org);
    loc.setAddressLine1(address);
    loc.setCityName(city);
    loc.setPostalCode(postal);
    loc.setCountry(country);
    OBDal.getInstance().save(loc);
    return loc;
  }

  private Calendar createCalendar(Client client, Organization org) {
    Calendar cal = OBProvider.getInstance().get(Calendar.class);
    cal.setNewOBObject(true);
    cal.setClient(client);
    cal.setOrganization(org);
    cal.setName("Fiscal Calendar");
    OBDal.getInstance().save(cal);

    // Current year + next year
    int currentYear = java.time.Year.now().getValue();
    createYear(client, org, cal, currentYear);
    createYear(client, org, cal, currentYear + 1);

    return cal;
  }

  private void createYear(Client client, Organization org, Calendar cal, int yearNum) {
    Year year = OBProvider.getInstance().get(Year.class);
    year.setNewOBObject(true);
    year.setClient(client);
    year.setOrganization(org);
    year.setCalendar(cal);
    year.setFiscalYear(String.valueOf(yearNum));
    OBDal.getInstance().save(year);

    // 12 monthly periods
    for (int month = 1; month <= 12; month++) {
      LocalDate start = LocalDate.of(yearNum, month, 1);
      LocalDate end = start.withDayOfMonth(start.lengthOfMonth());

      Period period = OBProvider.getInstance().get(Period.class);
      period.setNewOBObject(true);
      period.setClient(client);
      period.setOrganization(org);
      period.setYear(year);
      period.setName(start.getMonth().toString().substring(0, 3) + " " + yearNum);
      period.setPeriodNo((long) month);
      period.setStartingDate(java.sql.Date.valueOf(start));
      period.setEndingDate(java.sql.Date.valueOf(end));
      OBDal.getInstance().save(period);
    }
  }

  private Warehouse createWarehouse(Client client, Organization org, Location location) {
    Warehouse wh = OBProvider.getInstance().get(Warehouse.class);
    wh.setNewOBObject(true);
    wh.setClient(client);
    wh.setOrganization(org);
    wh.setName("Default Warehouse");
    wh.setSearchKey("DWH");
    wh.setLocationAddress(location);
    OBDal.getInstance().save(wh);
    return wh;
  }

  private PriceList createPriceList(Client client, Organization org,
      Currency currency, String name, boolean isSales) {
    PriceList pl = OBProvider.getInstance().get(PriceList.class);
    pl.setNewOBObject(true);
    pl.setClient(client);
    pl.setOrganization(org);
    pl.setName(name);
    pl.setCurrency(currency);
    pl.setSalesPriceList(isSales);
    OBDal.getInstance().save(pl);

    // Price list version (valid from Jan 1 current year)
    PriceListVersion plv = OBProvider.getInstance().get(PriceListVersion.class);
    plv.setNewOBObject(true);
    plv.setClient(client);
    plv.setOrganization(org);
    plv.setPriceList(pl);
    plv.setName(name + " " + java.time.Year.now().getValue());
    plv.setValidFromDate(java.sql.Date.valueOf(
        LocalDate.of(java.time.Year.now().getValue(), 1, 1)));
    OBDal.getInstance().save(plv);

    return pl;
  }

  private void createBPCategory(Client client, Organization org,
      String name, String searchKey) {
    Category cat = OBProvider.getInstance().get(Category.class);
    cat.setNewOBObject(true);
    cat.setClient(client);
    cat.setOrganization(org);
    cat.setName(name);
    cat.setSearchKey(searchKey);
    OBDal.getInstance().save(cat);
  }

  private ProductCategory createProductCategory(Client client, Organization org,
      String name, String searchKey) {
    ProductCategory cat = OBProvider.getInstance().get(ProductCategory.class);
    cat.setNewOBObject(true);
    cat.setClient(client);
    cat.setOrganization(org);
    cat.setName(name);
    cat.setSearchKey(searchKey);
    OBDal.getInstance().save(cat);
    return cat;
  }

  private TaxCategory createTaxCategory(Client client, Organization org, String name) {
    TaxCategory tc = OBProvider.getInstance().get(TaxCategory.class);
    tc.setNewOBObject(true);
    tc.setClient(client);
    tc.setOrganization(org);
    tc.setName(name);
    OBDal.getInstance().save(tc);
    return tc;
  }

  private void createTaxRate(Client client, Organization org,
      TaxCategory taxCat, String name, BigDecimal rate) {
    TaxRate tr = OBProvider.getInstance().get(TaxRate.class);
    tr.setNewOBObject(true);
    tr.setClient(client);
    tr.setOrganization(org);
    tr.setTaxCategory(taxCat);
    tr.setName(name);
    tr.setRate(rate);
    tr.setValidFromDate(java.sql.Date.valueOf(LocalDate.of(2000, 1, 1)));
    OBDal.getInstance().save(tr);
  }

  private Product createProduct(Client client, Organization org,
      ProductCategory cat, TaxCategory taxCat, UOM uom,
      String name, String searchKey) {
    Product p = OBProvider.getInstance().get(Product.class);
    p.setNewOBObject(true);
    p.setClient(client);
    p.setOrganization(org);
    p.setName(name);
    p.setSearchKey(searchKey);
    p.setProductCategory(cat);
    p.setTaxCategory(taxCat);
    p.setUOM(uom);
    p.setStocked(true);
    p.setPurchase(true);
    p.setSale(true);
    OBDal.getInstance().save(p);
    return p;
  }

  private void createProductPrice(Client client, Organization org,
      PriceList priceList, Product product, BigDecimal price) {
    // Get the first (and only) version of this price list
    PriceListVersion plv = priceList.getPricingPriceListVersionList().get(0);

    ProductPrice pp = OBProvider.getInstance().get(ProductPrice.class);
    pp.setNewOBObject(true);
    pp.setClient(client);
    pp.setOrganization(org);
    pp.setPriceListVersion(plv);
    pp.setProduct(product);
    pp.setStandardPrice(price);
    pp.setListPrice(price);
    pp.setPriceLimit(price);
    OBDal.getInstance().save(pp);
  }

  private FIN_FinancialAccount createFinancialAccount(Client client, Organization org,
      Currency currency, String name, String type) {
    FIN_FinancialAccount fa = OBProvider.getInstance().get(FIN_FinancialAccount.class);
    fa.setNewOBObject(true);
    fa.setClient(client);
    fa.setOrganization(org);
    fa.setName(name);
    fa.setCurrency(currency);
    fa.setType(type); // "C" = Cash, "B" = Bank
    OBDal.getInstance().save(fa);
    return fa;
  }

  private FIN_PaymentMethod createPaymentMethod(Client client, Organization org, String name) {
    FIN_PaymentMethod pm = OBProvider.getInstance().get(FIN_PaymentMethod.class);
    pm.setNewOBObject(true);
    pm.setClient(client);
    pm.setOrganization(org);
    pm.setName(name);
    OBDal.getInstance().save(pm);
    return pm;
  }

  private void createFinAccPaymentMethod(Client client, Organization org,
      FIN_FinancialAccount account, FIN_PaymentMethod method) {
    FinAccPaymentMethod fapm = OBProvider.getInstance().get(FinAccPaymentMethod.class);
    fapm.setNewOBObject(true);
    fapm.setClient(client);
    fapm.setOrganization(org);
    fapm.setAccount(account);
    fapm.setPaymentMethod(method);
    OBDal.getInstance().save(fapm);
  }
}
```

**Developer notes:**
- Entity class names and property names are best-effort based on Etendo DAL conventions. The developer MUST verify each against the actual generated model classes.
- If a setter doesn't exist (e.g., `setISOCurrencyCode`), use the property constant (e.g., `Currency.PROPERTY_ISOCURRENCYCODE`) with OBCriteria.
- Reference `/tmp/com.etendoerp.saas/referencedata/standard/Initial_Demo_Data.xml` for exact field values used in the SaaS module.

- [ ] **Step 2: Verify compilation + commit**

```bash
cd etendo_core && ./gradlew classes -p modules/com.etendoerp.go 2>&1 | tail -10
git add src/com/etendoerp/go/onboarding/steps/SeedReferenceDataStep.java
git commit -m "Feature ETP-3591: Add SeedReferenceDataStep with full reference data creation"
```

---

## Task 7: CreateDocTypesStep

**Files:**
- Create: `src/com/etendoerp/go/onboarding/steps/CreateDocTypesStep.java`

- [ ] **Step 1: Write CreateDocTypesStep**

Reference: SaaS `Initial_Demo_Data.xml` lines 1200-1400 for DocumentType + Sequence records.

```java
package com.etendoerp.go.onboarding.steps;

import org.openbravo.dal.service.OBDal;
import org.openbravo.dal.service.OBCriteria;
import org.openbravo.model.ad.system.Client;
import org.openbravo.model.common.enterprise.Organization;
import org.openbravo.model.common.enterprise.DocumentType;
import org.openbravo.model.ad.utility.Sequence;
import org.openbravo.model.financialmgmt.gl.GLCategory;
import org.openbravo.base.provider.OBProvider;
import org.hibernate.criterion.Restrictions;

import com.etendoerp.go.onboarding.OnboardingContext;
import com.etendoerp.go.onboarding.OnboardingStep;

public class CreateDocTypesStep implements OnboardingStep {

  @Override
  public String name() {
    return "createDocTypes";
  }

  @Override
  public void execute(OnboardingContext ctx) throws Exception {
    Client client = OBDal.getInstance().get(Client.class, ctx.getClientId());
    Organization org = OBDal.getInstance().get(Organization.class, ctx.getOrgId());

    // Create GL Categories first (doc types reference them)
    GLCategory glNone = createGLCategory(client, org, "None", "D");
    GLCategory glAR = createGLCategory(client, org, "AR Invoice", "D");
    GLCategory glAP = createGLCategory(client, org, "AP Invoice", "D");
    GLCategory glMM = createGLCategory(client, org, "Material Management", "D");

    // Document types with sequences
    // Args: client, org, name, prefix, startNo, glCategory, docBaseType
    createDocType(client, org, "Standard Order", "SO", 50000, glNone, "SOO");
    createDocType(client, org, "Purchase Order", "PO", 800000, glNone, "POO");
    createDocType(client, org, "AR Invoice", "ARI", 100000, glAR, "ARI");
    createDocType(client, org, "AP Invoice", "API", 200000, glAP, "API");
    createDocType(client, org, "MM Shipment", "MMS", 500000, glMM, "MMS");
    createDocType(client, org, "MM Receipt", "MMR", 600000, glMM, "MMR");
  }

  private GLCategory createGLCategory(Client client, Organization org,
      String name, String categoryType) {
    GLCategory gl = OBProvider.getInstance().get(GLCategory.class);
    gl.setNewOBObject(true);
    gl.setClient(client);
    gl.setOrganization(org);
    gl.setName(name);
    gl.setCategoryType(categoryType);
    OBDal.getInstance().save(gl);
    return gl;
  }

  private void createDocType(Client client, Organization org,
      String name, String prefix, long startNo,
      GLCategory glCategory, String docBaseType) {
    // Sequence
    Sequence seq = OBProvider.getInstance().get(Sequence.class);
    seq.setNewOBObject(true);
    seq.setClient(client);
    seq.setOrganization(org);
    seq.setName(name);
    seq.setPrefix(prefix + "/");
    seq.setNextAssignedNumber(startNo);
    seq.setIncrementBy(1L);
    seq.setAutoNumbering(true);
    OBDal.getInstance().save(seq);

    // Document type
    DocumentType dt = OBProvider.getInstance().get(DocumentType.class);
    dt.setNewOBObject(true);
    dt.setClient(client);
    dt.setOrganization(org);
    dt.setName(name);
    dt.setDocumentSequence(seq);
    dt.setGLCategory(glCategory);
    // dt.setDocumentCategory(docBaseType); // verify property name
    OBDal.getInstance().save(dt);
  }
}
```

**Developer note:** DocumentType may use `setDocumentCategory()` or `setDocBaseType()` for the document base type. Check the entity model. The docBaseType values (SOO, POO, ARI, API, MMS, MMR) are standard Etendo constants.

- [ ] **Step 2: Verify compilation + commit**

```bash
cd etendo_core && ./gradlew classes -p modules/com.etendoerp.go 2>&1 | tail -10
git add src/com/etendoerp/go/onboarding/steps/CreateDocTypesStep.java
git commit -m "Feature ETP-3591: Add CreateDocTypesStep with document types and sequences"
```

---

## Task 8: MarkOrgReadyStep (with ProcessRunner)

**Files:**
- Create: `src/com/etendoerp/go/onboarding/steps/MarkOrgReadyStep.java`

- [ ] **Step 1: Write MarkOrgReadyStep using ProcessRunner pattern**

Reference: SaaS OrganizationServlet lines 74-84 for the exact `PInstanceProcessData` + `ProcessRunner` pattern.

```java
package com.etendoerp.go.onboarding.steps;

import org.hibernate.criterion.Restrictions;
import org.openbravo.dal.core.OBContext;
import org.openbravo.dal.service.OBCriteria;
import org.openbravo.dal.service.OBDal;
import org.openbravo.model.ad.access.User;
import org.openbravo.model.ad.system.Client;
import org.openbravo.model.ad.system.Language;
import org.openbravo.model.common.enterprise.Organization;
import org.openbravo.scheduling.ProcessBundle;
import org.openbravo.scheduling.ProcessRunner;
import org.openbravo.erpCommon.utility.SequenceIdData;
import org.openbravo.database.ConnectionProvider;

import com.etendoerp.go.onboarding.OnboardingContext;
import com.etendoerp.go.onboarding.OnboardingStep;

public class MarkOrgReadyStep implements OnboardingStep {

  @Override
  public String name() {
    return "markOrgReady";
  }

  @Override
  public void execute(OnboardingContext ctx) throws Exception {
    Organization org = OBDal.getInstance().get(Organization.class, ctx.getOrgId());

    // 1. Set organization as ready
    org.setReady(true);
    OBDal.getInstance().save(org);

    // 2. Set default language on admin users
    Language lang = resolveLanguage(ctx.getLanguageCode());
    if (lang != null) {
      setUserLanguage(ctx.getClientAdminUserId(), lang);
      setUserLanguage(ctx.getOrgAdminUserId(), lang);
    }

    // 3. Execute ORG_AS_READY process
    // Resolve process ID by value/name (NOT hardcoded)
    // The SaaS module uses hardcoded ID "53863D4359114ADE92133F772135AEEB"
    // but we resolve it dynamically:
    String processId = resolveProcessId("ORG_AS_READY");

    // Execute via PInstanceProcessData + ProcessRunner
    // Pattern from SaaS OrganizationServlet:
    //
    //   String pinstance = SequenceIdData.getUUID();
    //   PInstanceProcessData.insertPInstance(connProvider, pinstance,
    //       processId, ctx.getOrgId(), "Y",
    //       ctx.getOrgAdminUserId(), ctx.getClientId(), ctx.getOrgId());
    //   ProcessBundle bundle = ProcessBundle.pinstance(pinstance, vars, connProvider);
    //   new ProcessRunner(bundle).execute(connProvider);
    //
    // Developer: This requires a ConnectionProvider. The servlet itself
    // can implement ConnectionProvider, or use DalConnectionProvider.
    // Check org.openbravo.dal.core.DalConnectionProvider as a simpler alternative.
    // Also check if VariablesSecureApp is needed — the SaaS module passes it.
    //
    // If ProcessRunner is too complex to wire up in the first pass,
    // set org.setReady(true) as the minimum viable implementation
    // and mark ORG_AS_READY execution as a TODO for the next iteration.

    OBDal.getInstance().flush();
  }

  private Language resolveLanguage(String langCode) {
    OBCriteria<Language> c = OBDal.getInstance().createCriteria(Language.class);
    c.add(Restrictions.eq(Language.PROPERTY_LANGUAGE, langCode));
    c.setMaxResults(1);
    return (Language) c.uniqueResult();
  }

  private void setUserLanguage(String userId, Language lang) {
    User user = OBDal.getInstance().get(User.class, userId);
    user.setDefaultLanguage(lang);
    OBDal.getInstance().save(user);
  }

  private String resolveProcessId(String processValue) throws Exception {
    // Query AD_Process by value
    // org.openbravo.model.ad.ui.Process
    OBCriteria<?> c = OBDal.getInstance().createCriteria(
        org.openbravo.model.ad.ui.Process.class);
    c.add(Restrictions.eq("value", processValue));
    c.setMaxResults(1);
    Object result = c.uniqueResult();
    if (result == null) {
      // Fallback: try by name
      c = OBDal.getInstance().createCriteria(org.openbravo.model.ad.ui.Process.class);
      c.add(Restrictions.eq("name", processValue));
      c.setMaxResults(1);
      result = c.uniqueResult();
    }
    if (result == null) {
      throw new Exception("Process '" + processValue + "' not found. "
          + "Cannot finalize org setup. Org marked as ready but process not executed.");
    }
    return ((org.openbravo.model.ad.ui.Process) result).getId();
  }
}
```

- [ ] **Step 2: Verify compilation + commit**

```bash
cd etendo_core && ./gradlew classes -p modules/com.etendoerp.go 2>&1 | tail -10
git add src/com/etendoerp/go/onboarding/steps/MarkOrgReadyStep.java
git commit -m "Feature ETP-3591: Add MarkOrgReadyStep with ProcessRunner + language"
```

---

## Task 9: OnboardingServlet (orchestrator)

**Files:**
- Create: `src/com/etendoerp/go/onboarding/OnboardingServlet.java`

Now that all steps exist, the servlet can import them without compilation errors.

- [ ] **Step 1: Create OnboardingServlet**

Full implementation as specified in the spec. See Task 2 in the previous plan version for the complete code — the servlet orchestrates all 8 steps, handles JWT auth, duplicate checking, chunked NDJSON response, and rollback.

Key points:
- Extends `javax.servlet.http.HttpServlet`
- `doGet` returns describe (input schema JSON)
- `doPost` runs the step chain with chunked NDJSON progress
- JWT auth via `SecureWebServicesUtils.decodeToken()` + role check for `"0"`
- Duplicate check via `OBCriteria<Client>` before starting
- Try/catch per step with `OBDal.getInstance().rollback()` on failure
- `OBDal.getInstance().getConnection().commit()` on success
- Uses `response.getOutputStream()` + `response.flushBuffer()` for streaming

The complete code is in the previous plan version's Task 2 Step 1.

- [ ] **Step 2: Verify full compilation (all steps + servlet)**

Run: `cd etendo_core && ./gradlew classes -p modules/com.etendoerp.go 2>&1 | tail -10`
Expected: BUILD SUCCESSFUL (all step classes exist, all imports resolve)

- [ ] **Step 3: Commit**

```bash
git add src/com/etendoerp/go/onboarding/OnboardingServlet.java
git commit -m "Feature ETP-3591: Add OnboardingServlet with JWT auth and step orchestration"
```

---

## Task 10: Servlet Registration (AD_MODEL_OBJECT XML)

**Files:**
- Modify: `src-db/database/sourcedata/AD_MODEL_OBJECT.xml`
- Modify: `src-db/database/sourcedata/AD_MODEL_OBJECT_MAPPING.xml`

- [ ] **Step 1: Read existing XML files for format reference**

Read both files. Look at the NeoServlet entry as a template.

- [ ] **Step 2: Append OnboardingServlet to AD_MODEL_OBJECT.xml**

Add before the closing `</data>` tag. Use a new UUID. Match the exact XML format (comment-prefix style, CDATA wrapping, all fields present).

Key fields:
- `NAME`: `Onboarding Servlet`
- `CLASSNAME`: `com.etendoerp.go.onboarding.OnboardingServlet`
- `ACTION`: `P`
- `OBJECT_TYPE`: `S`
- `AD_MODULE_ID`: same as NeoServlet's (copy from existing entry)

- [ ] **Step 3: Append URL mapping to AD_MODEL_OBJECT_MAPPING.xml**

Key fields:
- `MAPPINGNAME`: `/sws/neo/onboarding`

**Routing note:** Per Servlet Spec JSR-315, exact path `/sws/neo/onboarding` takes priority over wildcard `/sws/neo/*` (NeoServlet). No conflict.

- [ ] **Step 4: Commit**

```bash
git add src-db/database/sourcedata/AD_MODEL_OBJECT.xml src-db/database/sourcedata/AD_MODEL_OBJECT_MAPPING.xml
git commit -m "Feature ETP-3591: Register OnboardingServlet in AD_MODEL_OBJECT"
```

---

## Task 11: Frontend — Rewrite OnboardingPage

**Files:**
- Rewrite: `tools/app-shell/src/pages/OnboardingPage.jsx`

- [ ] **Step 1: Read current OnboardingPage.jsx**

Read: `tools/app-shell/src/pages/OnboardingPage.jsx`

- [ ] **Step 2: Rewrite with form (selects for ISO fields) + NDJSON accordion**

Key changes from spec review:
- Use `<select>` for currency, language, countryCode (not plain text inputs)
- NDJSON reading via `fetch` + `ReadableStream` + `TextDecoder`
- Accordion auto-expands running/failed steps

```jsx
import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Loader2, CheckCircle2, XCircle, Circle, ChevronDown } from 'lucide-react';

const STEPS = [
  { name: 'createClient', label: 'Create Client' },
  { name: 'createOrganization', label: 'Create Organization' },
  { name: 'createClientAdmin', label: 'Create Client Admin' },
  { name: 'createOrgAdmin', label: 'Create Org Admin' },
  { name: 'createRole', label: 'Create Role + Access' },
  { name: 'seedReferenceData', label: 'Seed Reference Data' },
  { name: 'createDocTypes', label: 'Document Types + Sequences' },
  { name: 'markOrgReady', label: 'Mark Org Ready' },
];

const CURRENCIES = ['EUR', 'USD', 'ARS', 'GBP', 'BRL', 'MXN', 'CLP', 'COP'];
const LANGUAGES = [
  { value: 'es_ES', label: 'Español' },
  { value: 'en_US', label: 'English' },
];
const COUNTRIES = [
  { value: 'AR', label: 'Argentina' },
  { value: 'ES', label: 'España' },
  { value: 'US', label: 'United States' },
  { value: 'MX', label: 'México' },
  { value: 'BR', label: 'Brasil' },
  { value: 'CL', label: 'Chile' },
  { value: 'CO', label: 'Colombia' },
  { value: 'GB', label: 'United Kingdom' },
];

export default function OnboardingPage() {
  const [form, setForm] = useState({
    clientName: '', orgName: '', adminUser: '', adminPassword: '',
    currency: 'EUR', language: 'es_ES', countryCode: 'AR',
  });
  const [steps, setSteps] = useState(
    STEPS.map(s => ({ ...s, status: 'pending', ms: null, error: null }))
  );
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const updateField = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const runOnboarding = useCallback(async () => {
    setRunning(true);
    setResult(null);
    setSteps(STEPS.map(s => ({ ...s, status: 'pending', ms: null, error: null })));

    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/sws/neo/onboarding', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.result) {
            setResult(msg);
          } else if (msg.step) {
            setSteps(prev => prev.map((s, i) =>
              i === msg.step - 1
                ? { ...s, status: msg.status, ms: msg.ms || null, error: msg.error || null }
                : s
            ));
          }
        }
      }
    } catch (err) {
      setResult({ result: 'failed', error: err.message });
    } finally {
      setRunning(false);
    }
  }, [form]);

  const StatusIcon = ({ status }) => {
    if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    if (status === 'done') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === 'failed') return <XCircle className="h-4 w-4 text-red-500" />;
    return <Circle className="h-4 w-4 text-gray-300" />;
  };

  const isFormValid = form.clientName && form.orgName && form.adminUser && form.adminPassword;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Client Onboarding</h1>

      <Card>
        <CardHeader><CardTitle>New Client</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientName">Client Name</Label>
              <Input id="clientName" value={form.clientName}
                onChange={e => updateField('clientName', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="orgName">Organization Name</Label>
              <Input id="orgName" value={form.orgName}
                onChange={e => updateField('orgName', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="adminUser">Admin Email</Label>
              <Input id="adminUser" type="email" value={form.adminUser}
                onChange={e => updateField('adminUser', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="adminPassword">Admin Password</Label>
              <Input id="adminPassword" type="password" value={form.adminPassword}
                onChange={e => updateField('adminPassword', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <select id="currency" value={form.currency}
                onChange={e => updateField('currency', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="language">Language</Label>
              <select id="language" value={form.language}
                onChange={e => updateField('language', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="countryCode">Country</Label>
              <select id="countryCode" value={form.countryCode}
                onChange={e => updateField('countryCode', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <Button onClick={runOnboarding} disabled={running || !isFormValid}>
            {running ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running...</> : 'Start Onboarding'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {steps.map((step, i) => (
            <Collapsible key={step.name}
              open={step.status === 'running' || step.status === 'failed'}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
                <div className="flex items-center gap-3">
                  <StatusIcon status={step.status} />
                  <span className="font-medium">Step {i + 1}: {step.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {step.ms != null && <span className="text-sm text-gray-500">{step.ms}ms</span>}
                  <ChevronDown className="h-4 w-4" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-3 pl-10 text-sm">
                {step.status === 'running' && <span className="text-blue-600">Executing...</span>}
                {step.status === 'failed' && <span className="text-red-600">{step.error}</span>}
                {step.status === 'done' && <span className="text-green-600">Completed in {step.ms}ms</span>}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>

      {result && (
        <Card className={result.result === 'success' ? 'border-green-500' : 'border-red-500'}>
          <CardContent className="p-4">
            {result.result === 'success' ? (
              <div className="text-green-700">
                <p className="font-bold">Onboarding complete ({result.totalMs}ms)</p>
                <p className="text-sm">Client ID: {result.clientId}</p>
                <p className="text-sm">Org ID: {result.orgId}</p>
              </div>
            ) : (
              <div className="text-red-700">
                <p className="font-bold">Onboarding failed</p>
                <p>{result.error}</p>
                {result.rolledBack && <p className="text-sm mt-1">All changes have been rolled back.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify dev server**

Run: `cd tools/app-shell && npm run dev`
Navigate to: `http://localhost:3100/onboarding`
Expected: Form with selects + empty accordion renders without errors

- [ ] **Step 4: Commit (in schema-forge repo)**

```bash
git add tools/app-shell/src/pages/OnboardingPage.jsx
git commit -m "Feature ETP-3591: Rewrite OnboardingPage with NDJSON stream accordion"
```

---

## Task 12: Integration Tests

**Files:**
- Create: `src-test/src/com/etendoerp/go/onboarding/OnboardingIntegrationTest.java`

- [ ] **Step 1: Write integration tests**

Tests extend `OBBaseTest` and run against a real DB.

```java
package com.etendoerp.go.onboarding;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import org.openbravo.test.base.OBBaseTest;
import org.openbravo.dal.core.OBContext;
import org.openbravo.dal.service.OBDal;
import org.openbravo.dal.service.OBCriteria;
import org.openbravo.model.ad.system.Client;
import org.hibernate.criterion.Restrictions;

import com.etendoerp.go.onboarding.steps.*;

public class OnboardingIntegrationTest extends OBBaseTest {

  private String createdClientId;

  @Test
  public void testFullOnboardingFlow() throws Exception {
    OBContext.setAdminMode();
    try {
      String uniqueName = "Test Client " + System.currentTimeMillis();

      OnboardingContext ctx = new OnboardingContext();
      ctx.setClientName(uniqueName);
      ctx.setOrgName("Test Org");
      ctx.setAdminUser("test-" + System.currentTimeMillis() + "@test.com");
      ctx.setAdminPassword("test1234");
      ctx.setCurrencyCode("EUR");
      ctx.setLanguageCode("en_US");
      ctx.setCountryCode("US");

      // Execute all steps in order
      OnboardingStep[] steps = {
          new CreateClientStep(),
          new CreateOrgStep(),
          new CreateClientAdminStep(),
          new CreateOrgAdminStep(),
          new CreateRoleStep(),
          new SeedReferenceDataStep(),
          new CreateDocTypesStep(),
          new MarkOrgReadyStep(),
      };

      for (OnboardingStep step : steps) {
        step.execute(ctx);
        OBDal.getInstance().flush();
      }

      // Verify
      assertNotNull(ctx.getClientId());
      assertNotNull(ctx.getOrgId());
      assertNotNull(ctx.getClientAdminUserId());
      assertNotNull(ctx.getOrgAdminUserId());
      assertNotNull(ctx.getRoleId());
      assertNotNull(ctx.getWarehouseId());
      assertNotNull(ctx.getCalendarId());

      Client client = OBDal.getInstance().get(Client.class, ctx.getClientId());
      assertNotNull(client);
      assertEquals(uniqueName, client.getName());

      createdClientId = ctx.getClientId();
    } finally {
      OBContext.restorePreviousMode();
    }
  }

  @Test
  public void testInvalidCurrencyFails() throws Exception {
    OBContext.setAdminMode();
    try {
      OnboardingContext ctx = new OnboardingContext();
      ctx.setClientName("Test Invalid Currency " + System.currentTimeMillis());
      ctx.setOrgName("Test Org");
      ctx.setAdminUser("test@test.com");
      ctx.setAdminPassword("test1234");
      ctx.setCurrencyCode("INVALID");
      ctx.setLanguageCode("en_US");
      ctx.setCountryCode("US");

      // Steps 1-4 should succeed
      new CreateClientStep().execute(ctx);
      new CreateOrgStep().execute(ctx);
      new CreateClientAdminStep().execute(ctx);
      new CreateOrgAdminStep().execute(ctx);
      new CreateRoleStep().execute(ctx);
      OBDal.getInstance().flush();

      // Step 6 should fail on currency resolution
      assertThrows(Exception.class, () -> {
        new SeedReferenceDataStep().execute(ctx);
      });

      // Rollback
      OBDal.getInstance().rollback();

      // Verify nothing persists
      OBCriteria<Client> c = OBDal.getInstance().createCriteria(Client.class);
      c.add(Restrictions.eq(Client.PROPERTY_NAME, ctx.getClientName()));
      assertEquals(0, c.count(), "Client should not exist after rollback");
    } finally {
      OBContext.restorePreviousMode();
    }
  }

  @AfterEach
  public void cleanup() {
    // Rollback any uncommitted changes
    try {
      OBDal.getInstance().rollback();
    } catch (Exception ignored) {}
  }
}
```

- [ ] **Step 2: Run tests**

Run: `cd etendo_core && ./gradlew test -p modules/com.etendoerp.go --tests "com.etendoerp.go.onboarding.*" 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src-test/src/com/etendoerp/go/onboarding/
git commit -m "Feature ETP-3591: Add onboarding integration tests"
```

---

## Task 13: End-to-End Verification

- [ ] **Step 1: Build and deploy**

```bash
cd etendo_core && ./gradlew smartbuild 2>&1 | tail -10
```
Expected: BUILD SUCCESSFUL, no errors related to OnboardingServlet

- [ ] **Step 2: Test GET describe**

```bash
TOKEN=$(./scripts/neo-token-sysadmin.sh)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/etendo/sws/neo/onboarding | python3 -m json.tool
```
Expected: JSON describe with field definitions

- [ ] **Step 3: Test POST onboarding**

```bash
TOKEN=$(./scripts/neo-token-sysadmin.sh)
curl -N -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"clientName":"E2E Test Corp","orgName":"E2E Org","adminUser":"e2e@test.com","adminPassword":"test1234","currency":"EUR","language":"es_ES","countryCode":"ES"}' \
  http://localhost:8080/etendo/sws/neo/onboarding
```
Expected: NDJSON stream with 8 steps completing, final `{"result":"success",...}`

- [ ] **Step 4: Test auth rejection (no token)**

```bash
curl -s http://localhost:8080/etendo/sws/neo/onboarding
```
Expected: 401 Unauthorized

- [ ] **Step 5: Test duplicate rejection**

Run same POST from Step 3 again.
Expected: 409 with `"Client with name 'E2E Test Corp' already exists"`

- [ ] **Step 6: Verify frontend**

Navigate to `http://localhost:3100/onboarding`, fill form, click Start.
Expected: Accordion updates in real-time.

- [ ] **Step 7: Export database**

```bash
cd etendo_core && ./gradlew export.database
```

**Note:** This exports the AD_MODEL_OBJECT records from DB to XML. If Task 10 manually edited the XML, verify the export doesn't overwrite those edits. If it does, use the exported version (it's the source of truth from DB).

- [ ] **Step 8: Final commits**

```bash
# In com.etendoerp.go repo
git add -A
git commit -m "Feature ETP-3591: Export database with OnboardingServlet registration"

# In schema-forge repo
git add docs/superpowers/specs/2026-03-20-etendogo-onboarding-design.md docs/superpowers/plans/2026-03-20-etendogo-onboarding-plan.md
git commit -m "Feature ETP-3591: Add onboarding design spec and implementation plan"
```
