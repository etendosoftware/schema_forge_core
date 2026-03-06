# Etendo OpenAPI Module (`com.etendoerp.openapi`)

> Reference documentation for Schema Forge integration planning.
> Source: `/modules/com.etendoerp.openapi/` — Version 2.5.0

## What It Does

Etendo's OpenAPI 3.0 specification generator and documentation system. It:
- Generates OpenAPI 3.0 JSON specs dynamically for Etendo REST endpoints
- Manages **API flows** (logical groupings of related endpoints)
- Discovers custom endpoint definitions via CDI at runtime
- Provides Swagger UI access at `/sws/openapi`

## Architecture: Plugin Discovery via CDI

**No annotations on endpoints.** Instead, modules implement an interface and are discovered at runtime:

```
OpenAPIController.doGet()
  -> getOpenAPIJson()
    -> applyEndpoints()
      -> WeldUtils.getInstances(OpenAPIEndpoint.class)
        -> Discovers ALL @ApplicationScoped beans implementing OpenAPIEndpoint
          -> endpoint.isValid(tag)
          -> endpoint.add(openAPI)   // programmatically adds paths to OpenAPI object
```

## Core Interface

```java
// com.etendoerp.openapi.model.OpenAPIEndpoint
public interface OpenAPIEndpoint {
  boolean isValid(String tag);   // filter by tag (null = include all)
  void add(OpenAPI openAPI);     // add paths/operations to the Swagger 3.0 object
}
```

## How to Register an Endpoint

### Option A: Direct Implementation (recommended for custom endpoints)

```java
@ApplicationScoped
public class MyEndpoint implements OpenAPIEndpoint {

  @Override
  public boolean isValid(String tag) {
    if (tag == null) return true;
    return List.of("MyTag").contains(tag);
  }

  @Override
  public void add(OpenAPI openAPI) {
    PathItem pathItem = new PathItem();
    Operation op = new Operation()
        .summary("My endpoint")
        .description("Does something");
    pathItem.post(op);
    openAPI.getPaths().addPathItem("/api/myendpoint", pathItem);
  }
}
```

### Option B: Extend `OpenAPIDefaultRequest` (database-driven flows)

```java
@ApplicationScoped
public class MyFlowEndpoint extends OpenAPIDefaultRequest {

  @Override
  protected Class<?>[] getClasses() {
    return new Class[] { MyHandler.class };
  }

  @Override
  protected String getEndpointPath() {
    return "/api/myflow";
  }

  @Override
  public Operation getPOSTEndpoint(OpenApiFlowPoint endpoint) { ... }
  @Override
  public Operation getGETEndpoint(OpenApiFlowPoint endpoint) { ... }
}
```

## Database Tables (Flow System)

Three tables organize endpoint documentation:

| Table | Entity | Purpose |
|-------|--------|---------|
| `ETAPI_OPENAPI_FLOW` | OpenApiFlow | Top-level flow container (groups endpoints) |
| `ETAPI_OPENAPI_REQ` | OpenAPIRequest | Request definition metadata (name, type, descriptions per HTTP method) |
| `ETAPI_OPENAPI_FLOWPOINT` | OpenApiFlowPoint | Junction: which HTTP methods (GET/POST/PUT) are enabled per request in a flow |

### OpenAPIRequest Fields
- `name` — endpoint identifier (alphabetic only, validated by event handler)
- `type` — `"DEF"` for default, others for custom
- `classname` — Java class this applies to
- `gETDescription`, `getbyidDescription`, `postDescription`, `pUTDescription` — per-method docs
- Relations: `OpenAPITab` (etendorx), `OpenAPIWebhook` (webhook events)

### OpenApiFlowPoint Fields
- `etapiOpenapiFlow` — FK to flow
- `etapiOpenapiReq` — FK to request
- `get`, `getbyid`, `post`, `put` — boolean flags (which HTTP methods are enabled)

## Integration Points

### SWS (Secure Web Services)
All hardcoded endpoints use the SWS path pattern:
```
/sws/com.smf.securewebservices.kernel/org.openbravo.client.kernel?_action=<HandlerClass>
```

Handlers include:
- `WindowSettingsActionHandler` — window settings
- `FormInitializationComponent` — form init + callouts
- `com.smf.jobs.defaults` — jobs and actions
- `BaseReportActionHandler` — reports

### Etendo RX
- `OpenAPIRequest` has FK relations to `com.etendoerp.etendorx.data.OpenAPITab`
- And to `com.etendoerp.webhookevents.data.OpenAPIWebhook`
- Endpoints are documented here but may be implemented in the etendorx module

### Security
Two schemes configured:
1. **basicAuth** — HTTP Basic
2. **bearerAuth** — JWT token from `/sws/login`

Default: bearerAuth required.

## Existing Endpoint Implementations

| Class | Tag | What it documents |
|-------|-----|-------------------|
| `WindowSettingEndpoint` | "Window Settings" | Window settings, form init, callouts |
| `JobsAndActionsEndpoint` | "Jobs and Actions" | Process execution (orders, defaults) |
| `PurchaseOrderReportEndpoint` | "Jobs and Actions" | Report generation + download |

## HTTP Access

```
GET /sws/openapi                          # All endpoints
GET /sws/openapi?tag=Window%20Settings    # Filter by tag
GET /sws/openapi?host=custom.domain.com   # Custom base URL
```

Response: OpenAPI 3.0 JSON with info, servers, paths, components, security.

## Key File Paths

```
modules/com.etendoerp.openapi/
  src/com/etendoerp/openapi/
    OpenAPIController.java              # Main HTTP controller (WebService)
    OpenApiProvider.java                # ComponentProvider registration
    OpenAPIDefaultRequest.java          # Abstract base for DB-driven flows
    model/
      OpenAPIEndpoint.java              # CORE INTERFACE
      window/WindowSettingEndpoint.java # Window settings (685 lines)
      jobs/JobsAndActionsEndpoint.java  # Jobs endpoint
      printreport/PurchaseOrderReportEndpoint.java
    events/OpenAPIRequestNameHandler.java
    hook/cloning/CloneFlow.java, CloneRequest.java
  config/com.etendoerp.openapi-provider-config.xml
  etendo-resources/META-INF/beans.xml

src-gen/com/etendoerp/openapi/data/
  OpenAPIRequest.java                   # Entity: ETAPI_OPENAPI_REQ
  OpenApiFlow.java                      # Entity: ETAPI_OPENAPI_FLOW
  OpenApiFlowPoint.java                 # Entity: ETAPI_OPENAPI_FLOWPOINT
```

## Dependencies

- `io.swagger.v3:swagger-models` — OpenAPI 3.0 object model
- `io.swagger.v3:swagger-integration` — OpenAPI context
- `com.fasterxml.jackson` — JSON serialization
- `org.openbravo.client.kernel` — WebService, WeldUtils (CDI discovery)
- `org.openbravo.dal` — OBDal, OBContext

## Relevance to Schema Forge

Schema Forge currently generates `RequestHandler`-based endpoints (custom routing via `HandlerRegistry`).
To integrate with the OpenAPI module, generated code could:

1. **Implement `OpenAPIEndpoint`** per window to auto-document generated REST endpoints
2. **Register flows via AD** (ETAPI_OPENAPI_FLOW + REQ + FLOWPOINT) in the generated dataset.xml
3. **Or** generate a single `@ApplicationScoped` class that programmatically adds all window endpoints to the OpenAPI spec

This would make all Schema Forge generated endpoints discoverable via Swagger UI at `/sws/openapi`.
