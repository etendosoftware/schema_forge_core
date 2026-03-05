# Module Structure: com.etendoerp.go

## Overview

The target module for Schema Forge code generation. It's a standard Etendo module with JWT-authenticated REST endpoints.

## Key Facts

| Property | Value |
|----------|-------|
| Java Package | `com.etendoerp.go` |
| Module ID | `94E1B433CF55451EABB764750AC5902A` |
| Servlet Path | `/sws/go/*` |
| Auth | JWT via `SecureWebServicesUtils` |
| OpenAPI | `com.etendoerp.openapi.model.OpenAPIEndpoint` |

## Architecture Pattern

```
HTTP Request
  → EtendoGoJwtServlet (extends HttpBaseServlet)
    → checkJwt() → sets OBContext from JWT claims
    → delegates to EtendoGoRestService singleton
      → routes by pathInfo + HTTP method
      → (currently returns dummy responses)
```

## File Layout

```
com.etendoerp.go/
├── build.gradle                              # plugins: java, deps: openapi, swagger, commons-lang3
├── etendo-resources/META-INF/beans.xml       # CDI beans config
├── src/com/etendoerp/go/rest/
│   ├── EtendoGoJwtServlet.java               # Auth servlet — DO NOT MODIFY
│   ├── EtendoGoRestService.java              # Request router — EXTEND THIS
│   └── EtendoGoOpenAPIDoc.java               # OpenAPI spec — EXTEND THIS
└── src-db/database/sourcedata/
    ├── AD_MODULE.xml                         # Module definition (javapackage=com.etendoerp.go)
    ├── AD_MODEL_OBJECT.xml                   # Servlet registration (action=P, type=S)
    └── AD_MODEL_OBJECT_MAPPING.xml           # URL mapping: /sws/go/*
```

## What the Generator Should Do

1. **Keep existing files unchanged** — the servlet, auth, and module registration are already done
2. **Generate new files under** `src/com/etendoerp/go/` in sub-packages:
   - `rest/handler/` — Request handlers per entity (called by RestService)
   - `dto/` — DTOs per entity
   - `process/` — Process classes (extend DalBaseProcess)
   - `event/` — Event handlers (extend EntityPersistenceEventObserver)
   - `validation/` — Precondition validators
3. **Modify EtendoGoRestService.java** — Add routing to generated handlers based on pathInfo
4. **Modify EtendoGoOpenAPIDoc.java** — Add OpenAPI spec for generated endpoints
5. **Use package** `com.etendoerp.go` (NOT `com.etendo.schemaforge.*`)

## Dependencies Available

From build.gradle + Etendo platform:
- `org.openbravo.dal.service.OBDal` — Data access layer
- `org.openbravo.dal.core.OBContext` — Security context
- `org.openbravo.base.model.ModelProvider` — Entity metadata
- `com.etendoerp.openapi.model.OpenAPIEndpoint` — OpenAPI registration
- `io.swagger.v3.oas.models.*` — Swagger models
- `org.codehaus.jettison.json.JSONObject` — JSON building
- `org.apache.logging.log4j.Logger` — Logging

## Source Layout Convention

Etendo modules use `src/` (not `src/main/java/`). The path is:
```
src/com/etendoerp/go/rest/handler/OrderHandler.java
```
NOT:
```
src/main/java/com/etendoerp/go/rest/handler/OrderHandler.java
```
