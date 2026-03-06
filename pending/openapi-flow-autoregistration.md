# Proposal: Auto-register Generated Endpoints in OpenAPI Flow

**Status:** Pending
**Date:** 2026-03-06
**Context:** Integration with `com.etendoerp.openapi` module — applies to all generated windows

## Problem

Schema Forge generates REST endpoints (handlers, selectors) per window, but these are invisible
to the Etendo OpenAPI system. They don't appear in Swagger UI (`/sws/openapi`) and aren't
discoverable by other modules or external integrations.

Etendo's OpenAPI module uses a CDI plugin architecture: any `@ApplicationScoped` bean implementing
`OpenAPIEndpoint` is auto-discovered at runtime and its paths are added to the OpenAPI 3.0 spec.

## Reference: How `com.etendoerp.copilot` Does It

The Copilot module registers its endpoints by implementing `OpenAPIEndpoint` directly.
Each implementation:
1. Checks `isValid(tag)` to filter by tag name
2. Programmatically builds `PathItem` + `Operation` objects with schemas, parameters, responses
3. Adds them to the `OpenAPI` object in `add(openAPI)`

The endpoints are then auto-discovered via `WeldUtils.getInstances(OpenAPIEndpoint.class)`.

## Proposed Design

### Generate an `EtendoGoOpenAPIEndpoint` per window

For each generated window, Schema Forge emits a single `@ApplicationScoped` class that registers
ALL endpoints for that window (handlers + selector) under a shared flow tag: `"EtendoGo"`.

```java
@ApplicationScoped
public class SalesOrderOpenAPIEndpoint implements OpenAPIEndpoint {

  private static final String TAG = "EtendoGo";

  @Override
  public boolean isValid(String tag) {
    return tag == null || TAG.equals(tag);
  }

  @Override
  public void add(OpenAPI openAPI) {
    // Header handler: GET/POST /sales-order/header
    addCrudPaths(openAPI, "/sales-order/header", "Order", "C_Order");

    // Lines handler: GET/POST /sales-order/lines
    addCrudPaths(openAPI, "/sales-order/lines", "OrderLine", "C_OrderLine");

    // ... one per tab/handler

    // Selector: GET /salesorder/selectors/{fieldName}
    addSelectorPath(openAPI, "/salesorder/selectors", selectorFields);
  }

  private void addCrudPaths(OpenAPI openAPI, String path, String name, String entity) {
    PathItem item = new PathItem();
    // GET list
    item.get(new Operation()
        .summary("List " + name)
        .addTagsItem(TAG)
        .responses(/* 200 with array schema */));
    // GET by id
    PathItem byId = new PathItem();
    byId.get(new Operation()
        .summary("Get " + name + " by ID")
        .addTagsItem(TAG)
        .addParametersItem(pathParam("id"))
        .responses(/* 200 with object schema */));
    // POST create
    item.post(new Operation()
        .summary("Create " + name)
        .addTagsItem(TAG)
        .requestBody(/* DTO schema */)
        .responses(/* 201 */));

    openAPI.getPaths().addPathItem(path, item);
    openAPI.getPaths().addPathItem(path + "/{id}", byId);
  }
}
```

### What gets generated

| File | Template | Purpose |
|------|----------|---------|
| `openapi/{Window}OpenAPIEndpoint.java` | `OpenAPIEndpoint.java.hbs` | CDI bean that registers all window endpoints |

The template would receive the same `handlers` + `selectorEndpoint` data that `generate-backend.js`
already computes, plus the DTO field definitions for request/response schemas.

### Flow tag: `"EtendoGo"`

All Schema Forge generated endpoints share a single tag. This means:
- `GET /sws/openapi?tag=EtendoGo` returns ALL generated endpoints across all windows
- They appear grouped under "EtendoGo" in Swagger UI
- Easy to distinguish from hand-coded Etendo endpoints

### Optional: DB Flow registration

Additionally, we could register an `ETAPI_OPENAPI_FLOW` record in `dataset.xml`:

```xml
<ETAPI_OPENAPI_FLOW>
  <ETAPI_OPENAPI_FLOW_ID><!-- UUID --></ETAPI_OPENAPI_FLOW_ID>
  <NAME>EtendoGo</NAME>
  <DESCRIPTION>Auto-generated REST endpoints by Schema Forge</DESCRIPTION>
  <OPENSWAGGER>Y</OPENSWAGGER>
</ETAPI_OPENAPI_FLOW>
```

This makes the flow visible in the Etendo AD UI for management/configuration.

## Advantages

1. **Zero manual registration** — CDI auto-discovers the bean
2. **Always in sync** — regeneration updates the OpenAPI spec automatically
3. **Standard Etendo pattern** — same as Copilot, no custom infrastructure
4. **Swagger UI for free** — all generated endpoints browsable and testable
5. **External integration friendly** — any tool that reads OpenAPI specs (Postman, code generators) works

## Dependencies

- `com.etendoerp.openapi` must be installed (it's in `modules/`)
- `io.swagger.v3:swagger-models` on the classpath (provided by openapi module)
- CDI/Weld container (standard Etendo runtime)

## Implementation Estimate

- New template: `OpenAPIEndpoint.java.hbs` (~100 lines)
- Generator update: add to `generateFileList()` (~10 lines)
- Dataset entry: 1 flow record in `dataset.xml`
- Tests: verify template output + endpoint registration

## Recommendation

Implement after CRUD endpoints are stable (post-MVP). The OpenAPI registration is purely
additive — it documents existing endpoints without changing their behavior. Can be added to any
window regeneration without breaking existing code.
