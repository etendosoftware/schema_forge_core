# Etendo OpenAPI Module — Integration Reference

Module: `com.etendoerp.openapi`
Source: `/modules/com.etendoerp.openapi/`

This document explains how the Etendo OpenAPI module works and how other modules integrate with it. Based on actual source code from `com.etendoerp.openapi` and `com.etendoerp.copilot`.

---

## How It Works

The OpenAPI module generates an OpenAPI 3.0 JSON spec at runtime by discovering all registered endpoint contributors via CDI (Weld). Any module can contribute endpoints by implementing a single interface.

```
GET /sws/com.etendoerp.openapi
    ?tag=Copilot          # optional: filter by tag
    ?host=https://...     # optional: override host

          │
          ▼
    OpenAPIController.doGet()
          │
          ├── initializeOpenAPI(baseUrl)     → empty OpenAPI object with server info
          ├── configureSecurity()            → JWT bearer + Basic auth schemes
          ├── applyEndpoints(openAPI, tag)   → CDI discovery loop (see below)
          ├── addLoginEndpoint()             → /sws/login POST
          └── serializeOpenAPI()             → JSON response
```

**Tag filtering:** If `?tag=Copilot` is passed, only endpoints where `isValid("Copilot")` returns `true` are included. Without a tag, ALL endpoints are included.

---

## The Interface: OpenAPIEndpoint

**File:** `com.etendoerp.openapi/src/com/etendoerp/openapi/model/OpenAPIEndpoint.java`

```java
package com.etendoerp.openapi.model;

import io.swagger.v3.oas.models.OpenAPI;

public interface OpenAPIEndpoint {

  /**
   * Checks if the hook is valid for that tag.
   * @param tag the tag to be checked
   * @return true if the tag is valid, false otherwise
   */
  boolean isValid(String tag);

  /**
   * Adds the given OpenAPI object to this endpoint with the specified tag.
   * @param openAPI the OpenAPI object to be added
   */
  void add(OpenAPI openAPI);
}
```

This is the only interface a module needs to implement.

---

## Discovery Mechanism

The core discovery happens in `OpenAPIController.applyEndpoints()`:

```java
// OpenAPIController.java — lines 404-420

private OpenAPI applyEndpoints(OpenAPI openAPI, String tag) throws OpenApiConfigurationException {
    Set<String> resourcePackages = new HashSet<>();
    resourcePackages.add(RESOURCE_PACKAGE);

    SwaggerConfiguration oasConfig = new SwaggerConfiguration().openAPI(openAPI)
        .resourcePackages(resourcePackages);

    OpenApiContext ctx = new GenericOpenApiContext<>().openApiConfiguration(oasConfig).init();
    OpenAPI updatedOpenAPI = ctx.read();

    for (OpenAPIEndpoint endpoint : WeldUtils.getInstances(OpenAPIEndpoint.class)) {
      if (tag == null || endpoint.isValid(tag)) {
        endpoint.add(updatedOpenAPI);
      }
    }
    return updatedOpenAPI;
}
```

Key points:
- `WeldUtils.getInstances(OpenAPIEndpoint.class)` discovers ALL beans implementing the interface across all modules
- No explicit registration needed — CDI auto-discovers any class implementing `OpenAPIEndpoint`
- The implementing class does NOT need `@ApplicationScoped` — Weld discovers it if the module has `beans.xml` with `bean-discovery-mode="all"`

---

## Security Configuration

Two auth schemes are added to every generated spec:

```java
// OpenAPIController.java — lines 359-374

private void configureSecurity(OpenAPI openAPI, String baseUrl) {
    Components components = new Components().addSecuritySchemes("basicAuth",
        createSecuritySchema("basic", null, BASIC_AUTH_DESCRIPTION));
    openAPI.components(components);

    SecurityScheme bearerAuthScheme = createSecuritySchema("bearer", "JWT",
        String.format(BEARER_TOKEN_DESCRIPTION, baseUrl));
    openAPI.components(components.addSecuritySchemes("bearerAuth", bearerAuthScheme));

    SecurityRequirement securityRequirement = new SecurityRequirement().addList("bearerAuth");
    openAPI.addSecurityItem(securityRequirement);
}
```

All endpoints require `bearerAuth` (JWT) by default. `basicAuth` is available as an alternative.

---

## Real Example: How Copilot Integrates

`com.etendoerp.copilot` implements `OpenAPIEndpoint` in `OpenAPIDoc.java` to register 8 custom endpoints.

### Class structure

```java
// com.etendoerp.copilot/src/com/etendoerp/copilot/hook/OpenAPIDoc.java

public class OpenAPIDoc implements OpenAPIEndpoint {
  private static final List<String> COPILOT_TAG = Collections.singletonList("Copilot");

  @Override
  public boolean isValid(String tag) {
    return StringUtils.equalsIgnoreCase(tag, "copilot");
  }

  @Override
  public void add(OpenAPI openAPI) {
    var paths = openAPI.getPaths();
    if (paths == null) {
      paths = new Paths();
      openAPI.setPaths(paths);
    }
    addTranscriptionEndpoint(openAPI);
    addAssistantsEndpoint(openAPI);
    addAQuestionEndpoint(openAPI);
    addQuestionEndpoint(openAPI);
    addCacheQuestionEndpoint(openAPI);
    addFileEndpoint(openAPI);
    addConfigCheckEndpoint(openAPI);
    addStructureEndpoint(openAPI);
  }
}
```

### Pattern: GET endpoint returning a list

```java
// OpenAPIDoc.java — addAssistantsEndpoint()

private static void addAssistantsEndpoint(OpenAPI openAPI) {
    var operation = new io.swagger.v3.oas.models.Operation();
    operation.setSummary("List available assistants for the current user");
    operation.setTags(COPILOT_TAG);

    var itemSchema = new ObjectSchema()
        .addProperties("id", new StringSchema().description("Assistant unique ID"))
        .addProperties("name", new StringSchema().description("Assistant name"));
    var arraySchema = new io.swagger.v3.oas.models.media.ArraySchema().items(itemSchema);

    var response = new io.swagger.v3.oas.models.responses.ApiResponse()
        .description("A list of available assistants for the current user")
        .content(new Content().addMediaType(APPLICATION_JSON,
            new MediaType().schema(arraySchema)));

    operation.responses(new io.swagger.v3.oas.models.responses.ApiResponses()
        .addApiResponse("200", response));

    var pathItem = new io.swagger.v3.oas.models.PathItem();
    pathItem.setGet(operation);
    openAPI.getPaths().put("/sws/copilot/assistants", pathItem);
}
```

### Pattern: POST endpoint with JSON body

```java
// OpenAPIDoc.java — addQuestionEndpoint()

private static void addQuestionEndpoint(OpenAPI openAPI) {
    var operation = new io.swagger.v3.oas.models.Operation();
    operation.setSummary("Ask a question to a selected assistant (JSON body)");
    operation.setTags(COPILOT_TAG);

    var requestSchema = new ObjectSchema()
        .addProperties("app_id", new StringSchema().description("ID of the assistant to use"))
        .addProperties("question", new StringSchema().description("The question to ask"))
        .addProperties("conversation_id", new StringSchema().description("Optional conversation ID"))
        .addProperties("file", new StringSchema().description("Optional file attachment"))
        .required(List.of("app_id", "question"));

    var requestBody = new RequestBody()
        .description("JSON object containing the question and parameters")
        .content(new Content().addMediaType(APPLICATION_JSON,
            new MediaType().schema(requestSchema)));
    operation.setRequestBody(requestBody);

    var responseSchema = new ObjectSchema()
        .addProperties("app_id", new StringSchema())
        .addProperties("conversation_id", new StringSchema())
        .addProperties("response", new StringSchema())
        .addProperties("timestamp", new StringSchema().description("ISO-8601 timestamp"));

    var apiResponse = new io.swagger.v3.oas.models.responses.ApiResponse()
        .description("The answer to the user's question")
        .content(new Content().addMediaType(APPLICATION_JSON,
            new MediaType().schema(responseSchema)));

    operation.responses(new io.swagger.v3.oas.models.responses.ApiResponses()
        .addApiResponse("200", apiResponse));

    var pathItem = new io.swagger.v3.oas.models.PathItem().post(operation);
    openAPI.getPaths().put("/sws/copilot/question", pathItem);
}
```

### Pattern: GET endpoint with query parameters

```java
// OpenAPIDoc.java — addAQuestionEndpoint()

private static void addAQuestionEndpoint(OpenAPI openAPI) {
    var operation = new io.swagger.v3.oas.models.Operation();
    operation.setSummary("Ask a question to a selected assistant");
    operation.setTags(COPILOT_TAG);

    operation.addParametersItem(new io.swagger.v3.oas.models.parameters.Parameter()
        .name("app_id").in("query").required(true)
        .description("The ID of the assistant to use")
        .schema(new StringSchema()));

    operation.addParametersItem(new io.swagger.v3.oas.models.parameters.Parameter()
        .name("question").in("query").required(true)
        .description("The question to ask")
        .schema(new StringSchema()));

    operation.addParametersItem(new io.swagger.v3.oas.models.parameters.Parameter()
        .name("conversation_id").in("query").required(false)
        .description("Conversation ID for continuing a session")
        .schema(new StringSchema()));

    // ... response similar to POST ...

    var pathItem = new io.swagger.v3.oas.models.PathItem().get(operation);
    openAPI.getPaths().put("/sws/copilot/aquestion", pathItem);
}
```

### Pattern: POST with multipart file upload

```java
// OpenAPIDoc.java — addTranscriptionEndpoint()

private static void addTranscriptionEndpoint(OpenAPI openAPI) {
    var transcription = new io.swagger.v3.oas.models.Operation();
    transcription.setSummary("Transcribe an audio file to text");
    transcription.setTags(COPILOT_TAG);

    RequestBody request = new RequestBody();
    request.setDescription("The audio file to transcribe");
    request.content(new Content()
        .addMediaType("multipart/form-data", new MediaType()
            .schema(new ObjectSchema()
                .addProperties("file", new StringSchema().format("binary")))));
    transcription.setRequestBody(request);

    var response = new io.swagger.v3.oas.models.responses.ApiResponse();
    response.setDescription("The transcription of the audio file");
    response.content(new Content()
        .addMediaType(APPLICATION_JSON, new MediaType().schema(new StringSchema())));
    transcription.responses(new io.swagger.v3.oas.models.responses.ApiResponses()
        .addApiResponse("200", response));

    var pathItem = new io.swagger.v3.oas.models.PathItem();
    pathItem.setPost(transcription);
    openAPI.getPaths().put("/sws/copilot/transcription", pathItem);
}
```

---

## Database Tables (Flow System)

The OpenAPI module also supports database-driven endpoint configuration:

| Table | Purpose |
|-------|---------|
| `ETAPI_OPENAPI_FLOW` | Groups endpoints by business area (used as OpenAPI tag). Fields: NAME, DESCRIPTION, OPEN_SWAGGER, ISLEGACY. |
| `ETAPI_OPENAPI_REQ` | Individual endpoint definition. Fields: NAME (alpha only, validated by event handler), TYPE, CLASSNAME, per-method descriptions. |
| `ETAPI_OPENAPI_FLOWPOINT` | Links a flow to a request with HTTP method flags: GET, POST, PUT, GETBYID, DELETE, PATCH. |

These are used by `OpenAPIDefaultRequest` (abstract base class) for modules that prefer declarative configuration over programmatic registration.

Copilot uses BOTH approaches:
- **Programmatic:** `OpenAPIDoc` adds 8 custom endpoints via code
- **Database:** Copilot creates a "Copilot" flow with 2 database-driven requests

Copilot sourcedata records:

```xml
<!-- ETAPI_OPENAPI_FLOW -->
<ETAPI_OPENAPI_FLOW>
  <ETAPI_OPENAPI_FLOW_ID>37FF96E51341486BB25AF7EB15BE6C44</ETAPI_OPENAPI_FLOW_ID>
  <NAME>Copilot</NAME>
  <OPEN_SWAGGER>N</OPEN_SWAGGER>
  <ISLEGACY>N</ISLEGACY>
</ETAPI_OPENAPI_FLOW>

<!-- Agents — GET only -->
<ETAPI_OPENAPI_FLOWPOINT>
  <ETAPI_OPENAPI_FLOW_ID>37FF96E51341486BB25AF7EB15BE6C44</ETAPI_OPENAPI_FLOW_ID>
  <ETAPI_OPENAPI_REQ_ID>FAB84394CBF74B7D98C5012DCB40F5AC</ETAPI_OPENAPI_REQ_ID>
  <GET>Y</GET><PUT>N</PUT><GETBYID>N</GETBYID><POST>N</POST>
</ETAPI_OPENAPI_FLOWPOINT>

<!-- AgentAccess — POST only -->
<ETAPI_OPENAPI_FLOWPOINT>
  <ETAPI_OPENAPI_FLOW_ID>37FF96E51341486BB25AF7EB15BE6C44</ETAPI_OPENAPI_FLOW_ID>
  <ETAPI_OPENAPI_REQ_ID>6719675F2F3949C7A3B1FEF44D868217</ETAPI_OPENAPI_REQ_ID>
  <GET>N</GET><PUT>N</PUT><GETBYID>N</GETBYID><POST>Y</POST>
</ETAPI_OPENAPI_FLOWPOINT>
```

---

## Built-in Endpoint Implementations

| Class | Tag | Endpoints |
|-------|-----|-----------|
| `WindowSettingEndpoint` | "Window Settings" | Window settings + form initialization (hardcoded SWS paths) |
| `JobsAndActionsEndpoint` | "Jobs and Actions" | Process execution (orders, defaults) |
| `PurchaseOrderReportEndpoint` | "Jobs and Actions" | Report generation + download |

---

## Dependencies

To integrate from another module, add to `build.gradle`:

```gradle
dependencies {
    compileOnly('com.etendoerp:openapi:[2.5.0,)')
    compileOnly 'io.swagger.core.v3:swagger-models:2.1.13'
}
```

Ensure `beans.xml` exists with bean discovery enabled:

```xml
<!-- etendo-resources/META-INF/beans.xml -->
<beans xmlns="http://xmlns.jcp.org/xml/ns/javaee"
       bean-discovery-mode="all">
</beans>
```

---

## Key File Paths

```
modules/com.etendoerp.openapi/
  src/com/etendoerp/openapi/
    OpenAPIController.java              # Main HTTP controller (WebService)
    OpenAPIDefaultRequest.java          # Abstract base for DB-driven flows
    OpenApiProvider.java                # ComponentProvider registration
    model/
      OpenAPIEndpoint.java              # THE INTERFACE to implement
      window/WindowSettingEndpoint.java # Built-in: window settings
      jobs/JobsAndActionsEndpoint.java  # Built-in: jobs and actions
      printreport/PurchaseOrderReportEndpoint.java
    events/OpenAPIRequestNameHandler.java  # Validates REQ name is alpha-only
    hook/cloning/CloneFlow.java            # Clone support for UI
    hook/cloning/CloneRequest.java

src-gen/com/etendoerp/openapi/data/
  OpenAPIRequest.java                   # DAL entity: ETAPI_OPENAPI_REQ
  OpenApiFlow.java                      # DAL entity: ETAPI_OPENAPI_FLOW
  OpenApiFlowPoint.java                 # DAL entity: ETAPI_OPENAPI_FLOWPOINT
```

---

## Swagger Models Quick Reference

Most commonly used classes from `io.swagger.v3.oas.models`:

| Class | Usage |
|-------|-------|
| `OpenAPI` | Root object — passed to `add()` |
| `Paths` | Map of URL path → PathItem |
| `PathItem` | One URL path — holds GET/POST/PUT/DELETE operations |
| `Operation` | One HTTP method — summary, tags, parameters, requestBody, responses |
| `Parameter` | Query/path/header parameter — name, in, required, schema |
| `RequestBody` | POST/PUT body — content type + schema |
| `ApiResponse` / `ApiResponses` | Response definitions by status code |
| `Content` / `MediaType` | Content type mapping + schema |
| `ObjectSchema` | Schema with type="object" — use `addProperties()` |
| `StringSchema` | Schema with type="string" |
| `ArraySchema` | Schema with type="array" — use `items()` |
| `Tag` | Grouping tag for operations |

---

## Applying This to Etendo Go (NEO Headless)

Etendo Go currently does NOT integrate with the OpenAPI module. To add it, create a single class in `com.etendoerp.go`:

```java
public class NeoOpenAPIEndpoint implements OpenAPIEndpoint {

  private static final String TAG = "EtendoGo";

  @Override
  public boolean isValid(String tag) {
    return tag == null || TAG.equalsIgnoreCase(tag);
  }

  @Override
  public void add(OpenAPI openAPI) {
    // Read ETGO_SF_SPEC records via OBDal
    // For each active spec + included entity:
    //   Build PathItem with enabled HTTP methods
    //   Add to openAPI.getPaths()
    // All data is already in the DB — no hardcoding needed
  }
}
```

This would make all NEO Headless endpoints appear in Swagger UI at `/sws/com.etendoerp.openapi?tag=EtendoGo`.
