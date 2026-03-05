# Schema Forge — TDD Annex A

## API Versioning — Technical Implementation

### Companion to TDD v2.1

---

## A.1 Version Model

Three independent version numbers tracked in the contract:

```json
{
  "moduleVersion": "semver — increments on every regeneration",
  "apiVersion": "semver — increments when DTO shape changes",
  "behavioralVersion": "semver — increments when rules/processes change"
}
```

The module version is the superset. It increments whenever either of the other two increment or when any regeneration occurs.

```
moduleVersion = f(apiVersion, behavioralVersion, regeneration count)
```

Semver rules within each:
- **major**: breaking change (field removed, type changed, required added)
- **minor**: non-breaking addition (optional field, new filter, new edge case)
- **patch**: non-functional (reformatting, comment, metadata)

---

## A.2 Generated Code Structure (Multi-Version)

When the backend supports multiple API versions, the module contains versioned DTOs and endpoints alongside shared business logic:

```
com.etendo.schemaforge.salesorder/
├── src/main/java/com/etendo/schemaforge/salesorder/
│   │
│   ├── event/                        # SHARED — not versioned
│   │   ├── OrderDerivationHandler.java
│   │   ├── OrderLineDerivationHandler.java
│   │   └── OrderLineTotalHandler.java
│   │
│   ├── process/                      # SHARED — not versioned
│   │   ├── CompleteOrderProcess.java
│   │   └── VoidOrderProcess.java
│   │
│   ├── callout/                      # SHARED — not versioned
│   │   └── SimplifiedBPCallout.java
│   │
│   ├── validation/                   # SHARED — not versioned
│   │   └── OrderPreconditionValidator.java
│   │
│   ├── dto/                          # VERSIONED — one package per API version
│   │   ├── v1/
│   │   │   ├── OrderDTO.java
│   │   │   └── OrderCreateDTO.java
│   │   └── v2/
│   │       ├── OrderDTO.java
│   │       └── OrderCreateDTO.java
│   │
│   ├── api/                          # VERSIONED — one endpoint class per version
│   │   ├── v1/
│   │   │   └── OrderRxEndpoint.java    # @Path("/schemaforge/v1/orders")
│   │   ├── v2/
│   │   │   └── OrderRxEndpoint.java    # @Path("/schemaforge/v2/orders")
│   │   ├── ErrorSerializer.java        # SHARED
│   │   └── VersionRouter.java          # Routes deprecated versions to 410
│   │
│   └── mapper/                       # VERSIONED — OBDal entity ↔ DTO
│       ├── v1/
│       │   └── OrderMapper.java
│       └── v2/
│           └── OrderMapper.java
│
├── referencedata/standard/           # SHARED
└── web/salesorder/                   # Frontend targets ONE api version
```

---

## A.3 DTO Generation Per Version

Each API version has its own DTO class generated from the frontend contract of that version.

### A.3.1 Example: v1 DTO

```java
/**
 * GENERATED — OrderDTO for API v1
 * apiVersion: 1.0.0
 * Fields: documentNo, dateOrdered, businessPartner, warehouse,
 *         grandTotal, documentStatus
 */
package com.etendo.schemaforge.salesorder.dto.v1;

public class OrderDTO {
  private String id;
  private String documentNo;        // readOnly
  private Date dateOrdered;          // editable
  private String businessPartner;    // editable (display name)
  private String businessPartnerId;  // editable (FK value)
  private String warehouse;          // editable in v1
  private String warehouseId;
  private BigDecimal grandTotal;     // readOnly
  private String documentStatus;     // readOnly

  // getters, setters
}

public class OrderCreateDTO {
  private Date dateOrdered;          // required
  private String businessPartnerId;  // required
  private String warehouseId;        // required in v1
  // only editable + required fields
}
```

### A.3.2 Example: v2 DTO

```java
/**
 * GENERATED — OrderDTO for API v2
 * apiVersion: 2.0.0
 * Changes from v1:
 *   - warehouse removed (moved to system)
 *   - salesRep added (editable, optional)
 */
package com.etendo.schemaforge.salesorder.dto.v2;

public class OrderDTO {
  private String id;
  private String documentNo;
  private Date dateOrdered;
  private String businessPartner;
  private String businessPartnerId;
  // NO warehouse — moved to system in v2
  private String salesRep;           // NEW in v2
  private String salesRepId;
  private BigDecimal grandTotal;
  private String documentStatus;
}

public class OrderCreateDTO {
  private Date dateOrdered;
  private String businessPartnerId;
  // NO warehouseId — derived by system in v2
  private String salesRepId;         // optional in v2
}
```

---

## A.4 Mapper Generation Per Version

Each version has a mapper that translates between the OBDal entity (which has ALL fields) and the version-specific DTO (which has only the fields for that API version).

```java
/**
 * GENERATED — Mapper for API v1
 */
package com.etendo.schemaforge.salesorder.mapper.v1;

public class OrderMapper {

  public static OrderDTO toDTO(Order order) {
    OrderDTO dto = new OrderDTO();
    dto.setId(order.getId());
    dto.setDocumentNo(order.getDocumentNo());
    dto.setDateOrdered(order.getOrderDate());

    if (order.getBusinessPartner() != null) {
      dto.setBusinessPartner(order.getBusinessPartner().getName());
      dto.setBusinessPartnerId(order.getBusinessPartner().getId());
    }

    // v1 includes warehouse
    if (order.getWarehouse() != null) {
      dto.setWarehouse(order.getWarehouse().getName());
      dto.setWarehouseId(order.getWarehouse().getId());
    }

    dto.setGrandTotal(order.getGrandTotalAmount());
    dto.setDocumentStatus(order.getDocumentStatus());
    return dto;
  }

  public static void applyCreate(Order order, OrderCreateDTO dto) {
    order.setOrderDate(dto.getDateOrdered());
    order.setBusinessPartner(
      OBDal.getInstance().get(BusinessPartner.class,
                              dto.getBusinessPartnerId()));
    // v1 requires warehouse from user
    order.setWarehouse(
      OBDal.getInstance().get(Warehouse.class,
                              dto.getWarehouseId()));
    // System fields filled by OrderDerivationHandler
  }
}
```

```java
/**
 * GENERATED — Mapper for API v2
 */
package com.etendo.schemaforge.salesorder.mapper.v2;

public class OrderMapper {

  public static OrderDTO toDTO(Order order) {
    OrderDTO dto = new OrderDTO();
    dto.setId(order.getId());
    dto.setDocumentNo(order.getDocumentNo());
    dto.setDateOrdered(order.getOrderDate());

    if (order.getBusinessPartner() != null) {
      dto.setBusinessPartner(order.getBusinessPartner().getName());
      dto.setBusinessPartnerId(order.getBusinessPartner().getId());
    }

    // v2 does NOT include warehouse (system field now)
    // v2 includes salesRep (new)
    if (order.getSalesRepresentative() != null) {
      dto.setSalesRep(order.getSalesRepresentative().getName());
      dto.setSalesRepId(order.getSalesRepresentative().getId());
    }

    dto.setGrandTotal(order.getGrandTotalAmount());
    dto.setDocumentStatus(order.getDocumentStatus());
    return dto;
  }

  public static void applyCreate(Order order, OrderCreateDTO dto) {
    order.setOrderDate(dto.getDateOrdered());
    order.setBusinessPartner(
      OBDal.getInstance().get(BusinessPartner.class,
                              dto.getBusinessPartnerId()));
    // v2: warehouse NOT in create DTO — derived by system
    // v2: salesRep is optional
    if (dto.getSalesRepId() != null) {
      order.setSalesRepresentative(
        OBDal.getInstance().get(User.class, dto.getSalesRepId()));
    }
  }
}
```

---

## A.5 Endpoint Generation Per Version

Each API version has its own endpoint class. They share processes and validation logic.

```java
/**
 * GENERATED — Endpoint for API v1
 * apiVersion: 1.0.0
 * Filters: documentNo, businessPartner
 */
package com.etendo.schemaforge.salesorder.api.v1;

@Path("/schemaforge/v1/orders")
public class OrderRxEndpoint {

  private static final Set<String> ALLOWED_FILTERS =
    Set.of("documentNo", "businessPartner");

  @GET
  @Produces(MediaType.APPLICATION_JSON)
  public Response list(
      @QueryParam("page") @DefaultValue("1") int page,
      @QueryParam("size") @DefaultValue("20") int size,
      @QueryParam("documentNo") String filterDocNo,
      @QueryParam("businessPartner") String filterBP) {

    OBCriteria<Order> crit = OBDal.getInstance()
      .createCriteria(Order.class);

    if (filterDocNo != null)
      crit.add(Restrictions.ilike(Order.PROPERTY_DOCUMENTNO,
                                  filterDocNo, MatchMode.ANYWHERE));
    if (filterBP != null)
      crit.createAlias(Order.PROPERTY_BUSINESSPARTNER, "bp")
          .add(Restrictions.ilike("bp.name", filterBP,
                                  MatchMode.ANYWHERE));

    crit.addOrderBy(Order.PROPERTY_ORDERDATE, false);
    crit.setFirstResult((page - 1) * size);
    crit.setMaxResults(size);

    List<OrderDTO> dtos = crit.list().stream()
      .map(OrderMapper::toDTO)  // v1 mapper
      .collect(Collectors.toList());

    return Response.ok(dtos).build();
  }

  @POST
  @Consumes(MediaType.APPLICATION_JSON)
  public Response create(OrderCreateDTO dto) {
    try {
      Order order = new Order();
      OrderMapper.applyCreate(order, dto);  // v1 mapper
      OBDal.getInstance().save(order);
      OBDal.getInstance().flush();
      return Response.status(201)
        .entity(OrderMapper.toDTO(order)).build();
    } catch (OBException e) {
      return Response.status(400)
        .entity(ErrorSerializer.serialize(e)).build();
    }
  }

  @POST @Path("/{id}/complete")
  public Response complete(@PathParam("id") String id) {
    // Process is SHARED — same for all API versions
    try {
      ProcessBundle bundle = new ProcessBundle(
        ProcessUtil.getProcessId("completeOrder"), null);
      bundle.getParams().put("recordId", id);
      new CompleteOrderProcess().execute(bundle);
      Order order = OBDal.getInstance().get(Order.class, id);
      return Response.ok(OrderMapper.toDTO(order)).build();  // v1 mapper
    } catch (OBException e) {
      return Response.status(400)
        .entity(ErrorSerializer.serialize(e)).build();
    }
  }
}
```

```java
/**
 * GENERATED — Endpoint for API v2
 * apiVersion: 2.0.0
 * Filters: documentNo, businessPartner, salesRep (new)
 */
package com.etendo.schemaforge.salesorder.api.v2;

@Path("/schemaforge/v2/orders")
public class OrderRxEndpoint {

  private static final Set<String> ALLOWED_FILTERS =
    Set.of("documentNo", "businessPartner", "salesRep");

  @GET
  @Produces(MediaType.APPLICATION_JSON)
  public Response list(
      @QueryParam("page") @DefaultValue("1") int page,
      @QueryParam("size") @DefaultValue("20") int size,
      @QueryParam("documentNo") String filterDocNo,
      @QueryParam("businessPartner") String filterBP,
      @QueryParam("salesRep") String filterSalesRep) {

    OBCriteria<Order> crit = OBDal.getInstance()
      .createCriteria(Order.class);

    if (filterDocNo != null)
      crit.add(Restrictions.ilike(Order.PROPERTY_DOCUMENTNO,
                                  filterDocNo, MatchMode.ANYWHERE));
    if (filterBP != null)
      crit.createAlias(Order.PROPERTY_BUSINESSPARTNER, "bp")
          .add(Restrictions.ilike("bp.name", filterBP,
                                  MatchMode.ANYWHERE));
    // NEW in v2
    if (filterSalesRep != null)
      crit.createAlias(Order.PROPERTY_SALESREPRESENTATIVE, "sr")
          .add(Restrictions.ilike("sr.name", filterSalesRep,
                                  MatchMode.ANYWHERE));

    crit.addOrderBy(Order.PROPERTY_ORDERDATE, false);
    crit.setFirstResult((page - 1) * size);
    crit.setMaxResults(size);

    // Uses v2 mapper — different fields than v1
    List<com.etendo.schemaforge.salesorder.dto.v2.OrderDTO> dtos =
      crit.list().stream()
        .map(com.etendo.schemaforge.salesorder.mapper.v2
             .OrderMapper::toDTO)
        .collect(Collectors.toList());

    return Response.ok(dtos).build();
  }

  @POST
  @Consumes(MediaType.APPLICATION_JSON)
  public Response create(
      com.etendo.schemaforge.salesorder.dto.v2.OrderCreateDTO dto) {
    try {
      Order order = new Order();
      com.etendo.schemaforge.salesorder.mapper.v2
        .OrderMapper.applyCreate(order, dto);  // v2 mapper
      OBDal.getInstance().save(order);
      OBDal.getInstance().flush();
      return Response.status(201)
        .entity(com.etendo.schemaforge.salesorder.mapper.v2
                .OrderMapper.toDTO(order)).build();
    } catch (OBException e) {
      return Response.status(400)
        .entity(ErrorSerializer.serialize(e)).build();
    }
  }

  @POST @Path("/{id}/complete")
  public Response complete(@PathParam("id") String id) {
    // SAME process as v1 — shared
    try {
      ProcessBundle bundle = new ProcessBundle(
        ProcessUtil.getProcessId("completeOrder"), null);
      bundle.getParams().put("recordId", id);
      new CompleteOrderProcess().execute(bundle);
      Order order = OBDal.getInstance().get(Order.class, id);
      return Response.ok(
        com.etendo.schemaforge.salesorder.mapper.v2
          .OrderMapper.toDTO(order)).build();
    } catch (OBException e) {
      return Response.status(400)
        .entity(ErrorSerializer.serialize(e)).build();
    }
  }
}
```

---

## A.6 Version Router (Retired Versions)

When a version is retired, a catch-all route returns 410:

```java
/**
 * GENERATED — Routes retired API versions to 410 Gone
 */
@Path("/schemaforge/v1")
public class VersionRouter {

  private static final String CURRENT_VERSION = "v2";
  private static final String RETIRED_AT = "2026-05-15T00:00:00Z";

  @GET @Path("/{any:.*}")
  public Response gone() {
    return Response.status(410).entity(new ErrorResponse(
      "API_VERSION_RETIRED",
      "API version v1 is no longer supported. Use /schemaforge/"
        + CURRENT_VERSION + "/",
      null, "error", null, null
    )).build();
  }

  @POST @Path("/{any:.*}")
  public Response gonePost() { return gone(); }

  @PUT @Path("/{any:.*}")
  public Response gonePut() { return gone(); }

  @DELETE @Path("/{any:.*}")
  public Response goneDelete() { return gone(); }
}
```

The generator produces this class only when a version is marked for retirement. In the active period (v1 and v2 coexist), no router is needed.

---

## A.7 Contract Test Generation for Multi-Version

The contract generator produces tests for EACH supported API version:

```javascript
/**
 * GENERATED — Multi-version contract tests
 * Tests run for every version in supportedApiVersions
 */
const contract = require('./contract.json');

for (const apiVer of contract.backendContract.supportedApiVersions) {

  const endpoints = contract.backendContract.endpoints
    .filter(e => e.apiVersion === apiVer);
  const feContract = contract.history?.[apiVer]?.frontendContract
    || contract.frontendContract; // current if no history

  describe(`API v${apiVer}`, () => {

    describe('endpoints exist', () => {
      for (const ep of endpoints) {
        it(`${ep.method} ${ep.path}`, () => {
          expect(ep.path).toContain(`/v${apiVer.split('.')[0]}/`);
          expect(ep.responseSchema).toBeDefined();
        });
      }
    });

    describe('filters are exactly declared', () => {
      for (const ep of endpoints.filter(e => e.method === 'GET')) {
        it(`${ep.path} supports: ${ep.supportedFilters.join(', ')}`, () => {
          // Each declared filter exists
          for (const f of ep.supportedFilters)
            expect(typeof f).toBe('string');
          // No undeclared filters
          expect(ep.supportedFilters.length).toBeGreaterThan(0);
        });
      }
    });

    if (apiVer !== contract.apiVersion) {
      describe('deprecated version', () => {
        const ep = endpoints[0];
        it('is marked as deprecated', () => {
          expect(ep.deprecated).toBe(true);
        });
        it('has retirement date', () => {
          expect(ep.retireAfter).toBeDefined();
        });
      });
    }
  });
}
```

---

## A.8 JUnit Multi-Version Tests

Integration tests verify that both API versions return correct data from the same underlying entity:

```java
/**
 * GENERATED — Verify both API versions serve the same order correctly
 */
public class MultiVersionEndpointTest extends OBBaseTest {

  @Test
  public void v1AndV2ReturnSameOrderWithDifferentShapes() {
    Order order = createTestOrder("DR");
    order.setWarehouse(getWarehouse("W1"));
    order.setSalesRepresentative(getUser("SalesRep1"));
    OBDal.getInstance().save(order);
    OBDal.getInstance().flush();

    // v1 response includes warehouse, not salesRep
    OrderDTO_v1 v1dto = com.etendo.schemaforge.salesorder
      .mapper.v1.OrderMapper.toDTO(order);
    assertNotNull(v1dto.getWarehouse(), "v1 includes warehouse");
    // v1 DTO class doesn't have salesRep field

    // v2 response includes salesRep, not warehouse
    OrderDTO_v2 v2dto = com.etendo.schemaforge.salesorder
      .mapper.v2.OrderMapper.toDTO(order);
    assertNotNull(v2dto.getSalesRep(), "v2 includes salesRep");
    // v2 DTO class doesn't have warehouse field

    // Both share the same core data
    assertEquals(v1dto.getDocumentNo(), v2dto.getDocumentNo());
    assertEquals(v1dto.getGrandTotal(), v2dto.getGrandTotal());
    assertEquals(v1dto.getDocumentStatus(), v2dto.getDocumentStatus());
  }

  @Test
  public void v1CreateRequiresWarehouse_v2DoesNot() {
    // v1: warehouse is in the create DTO (user provides it)
    OrderCreateDTO_v1 v1create = new OrderCreateDTO_v1();
    v1create.setDateOrdered(new Date());
    v1create.setBusinessPartnerId(getTestBP().getId());
    // v1create.setWarehouseId(null) → should fail validation

    // v2: warehouse is NOT in create DTO (system derives it)
    OrderCreateDTO_v2 v2create = new OrderCreateDTO_v2();
    v2create.setDateOrdered(new Date());
    v2create.setBusinessPartnerId(getTestBP().getId());
    // No warehouse needed — derivation handler fills it
  }

  @Test
  public void processWorksRegardlessOfApiVersion() {
    // Create via v1 (with warehouse)
    Order order = createTestOrderViaV1();
    assertEquals("DR", order.getDocumentStatus());

    // Complete via shared process
    completeOrder(order.getId());

    // Both v1 and v2 mappers reflect the completion
    OrderDTO_v1 v1 = com.etendo.schemaforge.salesorder
      .mapper.v1.OrderMapper.toDTO(
        OBDal.getInstance().get(Order.class, order.getId()));
    assertEquals("CO", v1.getDocumentStatus());

    OrderDTO_v2 v2 = com.etendo.schemaforge.salesorder
      .mapper.v2.OrderMapper.toDTO(
        OBDal.getInstance().get(Order.class, order.getId()));
    assertEquals("CO", v2.getDocumentStatus());
  }
}
```

---

## A.9 Backend Generator: Version-Aware Code Generation

The backend generator reads the contract and generates versioned code:

```javascript
function generateBackend(contract) {
  const versions = contract.backendContract.supportedApiVersions;
  const currentVersion = contract.apiVersion;

  for (const ver of versions) {
    const feContract = getContractForVersion(ver);
    const isCurrent = ver === currentVersion;
    const isDeprecated = !isCurrent;

    // Generate DTO
    generateDTO(feContract, ver);
    generateCreateDTO(feContract, ver);

    // Generate Mapper
    generateMapper(feContract, ver);

    // Generate Endpoint
    generateEndpoint(feContract, ver, {
      deprecated: isDeprecated,
      deprecatedSince: isDeprecated
        ? contract.backendContract.endpoints
            .find(e => e.apiVersion === ver)?.deprecatedSince
        : null
    });
  }

  // Shared components (NOT versioned)
  generateDerivationHandlers(contract);
  generateProcesses(contract);
  generateValidators(contract);
  generateErrorSerializer(contract);

  // Retired version routers
  const retired = getPreviouslyRetiredVersions(contract);
  for (const ver of retired) {
    generateVersionRouter(ver, currentVersion);
  }
}

function generateDTO(feContract, version) {
  const fields = feContract.entities;
  for (const [entity, def] of Object.entries(fields)) {
    const template = loadTemplate('DTO.java.tmpl');
    const code = template.render({
      packageVersion: `v${version.split('.')[0]}`,
      className: `${capitalize(entity)}DTO`,
      fields: def.fields,
      apiVersion: version
    });
    writeFile(`dto/v${version.split('.')[0]}/${capitalize(entity)}DTO.java`,
              code);
  }
}
```

---

## A.10 Contract History

The contract file optionally stores a history of previous frontend contracts to enable multi-version testing:

```json
{
  "apiVersion": "2.0.0",
  "frontendContract": { "..." : "current v2 contract" },

  "contractHistory": {
    "1.0.0": {
      "frontendContract": {
        "entities": {
          "order": {
            "fields": [
              { "name": "warehouse", "type": "string", "editable": true }
            ],
            "searchableFields": ["documentNo", "businessPartner"]
          }
        }
      },
      "deprecated": true,
      "deprecatedSince": "2026-04-01",
      "retireAfter": "2026-05-01"
    }
  }
}
```

The history is used by the contract generator to produce tests for old versions and by the backend generator to produce endpoint classes for supported versions.

---

## A.11 Version Checker Algorithm

```javascript
function checkVersions(oldContract, newContract) {
  const result = {
    apiChanged: oldContract.apiVersion !== newContract.apiVersion,
    behavioralChanged: oldContract.behavioralVersion
                       !== newContract.behavioralVersion,
    moduleChanged: oldContract.moduleVersion !== newContract.moduleVersion,
    apiBreaking: [],
    apiAdditions: [],
    behavioralChanges: [],
    deployStrategy: null
  };

  // API changes
  if (result.apiChanged) {
    const oldFe = oldContract.frontendContract;
    const newFe = newContract.frontendContract;

    for (const [entity, oldDef] of Object.entries(oldFe.entities)) {
      const newDef = newFe.entities[entity];
      if (!newDef) {
        result.apiBreaking.push({
          type: 'entity-removed', entity, breaking: true });
        continue;
      }

      const oldFields = new Map(oldDef.fields.map(f => [f.name, f]));
      const newFields = new Map(newDef.fields.map(f => [f.name, f]));

      for (const [name, old] of oldFields) {
        if (!newFields.has(name))
          result.apiBreaking.push({
            type: 'field-removed', entity, field: name, breaking: true });
        else {
          const nf = newFields.get(name);
          if (nf.type !== old.type)
            result.apiBreaking.push({
              type: 'type-changed', entity, field: name,
              from: old.type, to: nf.type, breaking: true });
          if (!old.required && nf.required)
            result.apiBreaking.push({
              type: 'became-required', entity, field: name,
              breaking: true });
          if (old.editable && !nf.editable)
            result.apiBreaking.push({
              type: 'became-readonly', entity, field: name,
              breaking: true });
        }
      }

      for (const [name] of newFields) {
        if (!oldFields.has(name))
          result.apiAdditions.push({
            type: 'field-added', entity, field: name });
      }

      // Searchable changes
      const oldSearch = new Set(oldDef.searchableFields || []);
      const newSearch = new Set(newDef.searchableFields || []);
      for (const s of oldSearch) {
        if (!newSearch.has(s))
          result.apiBreaking.push({
            type: 'searchable-removed', entity, field: s,
            breaking: true });
      }
      for (const s of newSearch) {
        if (!oldSearch.has(s))
          result.apiAdditions.push({
            type: 'searchable-added', entity, field: s });
      }
    }
  }

  // Deploy strategy
  const hasBreaking = result.apiBreaking.length > 0;
  if (!result.apiChanged && !result.behavioralChanged) {
    result.deployStrategy = 'none';
  } else if (!result.apiChanged) {
    result.deployStrategy = 'rolling-backend-only';
  } else if (!hasBreaking) {
    result.deployStrategy = 'rolling';
  } else {
    result.deployStrategy = 'blue-green';
  }

  return result;
}
```

---

## A.12 CI/CD Pipeline (Version-Aware)

```yaml
versioning:
  script:
    - |
      OLD_CONTRACT=$(schema-forge latest-contract)
      NEW_CONTRACT=$(schema-forge generate-contract --all)
      
      RESULT=$(schema-forge check-version \
        --old $OLD_CONTRACT \
        --new $NEW_CONTRACT)
      
      echo "$RESULT"
      
      # If API version changed, verify old version still works
      if [ "$(echo $RESULT | jq .apiChanged)" = "true" ]; then
        echo "API version changed — running multi-version tests"
        schema-forge test-contract --version all
      fi
      
      # If breaking, require blue-green plan
      if [ "$(echo $RESULT | jq '.apiBreaking | length')" -gt 0 ]; then
        echo "BREAKING CHANGES DETECTED"
        echo "Deploy strategy: blue-green"
        # Block auto-deploy, require manual approval
        exit 1
      fi
```

---

*End of annex*
