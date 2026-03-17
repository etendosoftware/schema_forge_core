# Plan: Fix Broken Write Operations (POST, PUT, PATCH) in NEO Headless

**Status:** Pending
**Ticket:** ETP-3546
**Severity:** Critical — all write operations are broken
**Created:** 2026-03-13

## Problem Summary

All write operations (POST, PUT, PATCH) in `NeoServlet.handleDefault()` fail with `JSONObject["data"] not found`.

### Root Cause

1. Client sends flat JSON: `{"deliveryNotes": "test"}`
2. `NeoFieldFilter.filterWriteRequest()` processes top-level keys (keeps only writable fields)
3. Filtered flat body is passed as string to `DefaultJsonDataService.update()` / `.add()`
4. Internally, `DefaultJsonDataService.getContentAsJSON(content)` does `jsonObject.get("data")` → **crash** — no `"data"` wrapper exists
5. Even if client sends `{"data": {...}}`, the filter strips `data` key (not a configured field)

### What Works vs What's Broken

| Operation | Status | Notes |
|-----------|--------|-------|
| GET (list + byId) | OK | |
| DELETE | OK | No body needed |
| 405 on disabled methods | OK | |
| **POST** | **BROKEN** | `JSONObject["data"] not found` |
| **PUT** | **BROKEN** | Same error |
| **PATCH** | **BROKEN** | Same error |

### Additional Issue: PUT vs PATCH Are Identical

Both share the exact same code path (lines 625-634) — both call `jsonService.update()`. No semantic difference. Both would do partial updates. Decision: keep both as partial updates (documented below in Step 6).

## Key Files

| File | Role | Lines |
|------|------|-------|
| `modules/com.etendoerp.go/.../NeoServlet.java` | Core fix location | 628-665 |
| `modules/com.etendoerp.go/.../NeoFieldFilter.java` | Filter strips `data` key | 177-189 |
| `modules_core/.../DefaultJsonDataService.java` | Expects `{"data": {...}}` format | 1172-1182 |
| `modules_core/.../JsonConstants.java` | Constants: `DATA`, `ENTITYNAME`, `ID` | Reference |

## Implementation Steps

### Step 1: Add `wrapForSmartclient()` helper in NeoServlet

Add a private method near `handleDefault()` (~line 677):

```java
private String wrapForSmartclient(JSONObject body, String dalEntityName, String recordId)
    throws JSONException {
  if (body == null) {
    body = new JSONObject();
  }
  body.put(JsonConstants.ENTITYNAME, dalEntityName);  // "_entityName"
  if (recordId != null) {
    body.put(JsonConstants.ID, recordId);              // "id"
  }
  JSONObject wrapper = new JSONObject();
  wrapper.put(JsonConstants.DATA, body);               // "data"
  return wrapper.toString();
}
```

### Step 2: Fix POST case (lines 644-648)

```java
// Before (broken):
case "POST": {
  JSONObject filteredBody = fieldFilter.filterWriteRequest(context.getRequestBody());
  result = jsonService.add(params, filteredBody != null ? filteredBody.toString() : "{}");
  break;
}

// After (fixed):
case "POST": {
  JSONObject filteredBody = fieldFilter.filterWriteRequest(context.getRequestBody());
  String wrappedBody = wrapForSmartclient(filteredBody, dalEntityName, null);
  result = jsonService.add(params, wrappedBody);
  break;
}
```

Note: `recordId` is `null` for POST — no `id` injected, system auto-generates.

### Step 3: Fix PUT/PATCH case (lines 650-655)

```java
// Before (broken):
case "PUT":
case "PATCH": {
  JSONObject filteredBody = fieldFilter.filterWriteRequest(context.getRequestBody());
  result = jsonService.update(params, filteredBody != null ? filteredBody.toString() : "{}");
  break;
}

// After (fixed):
case "PUT":
case "PATCH": {
  JSONObject filteredBody = fieldFilter.filterWriteRequest(context.getRequestBody());
  String wrappedBody = wrapForSmartclient(filteredBody, dalEntityName, context.getRecordId());
  result = jsonService.update(params, wrappedBody);
  break;
}
```

### Step 4: Add recordId validation for PUT/PATCH

Before the switch statement (~line 639):

```java
if (("PUT".equals(context.getHttpMethod()) || "PATCH".equals(context.getHttpMethod()))
    && context.getRecordId() == null) {
  return NeoResponse.error(HttpServletResponse.SC_BAD_REQUEST,
      "Record ID required in URL for " + context.getHttpMethod() + " requests");
}
```

### Step 5: Add validation — POST should not have recordId in URL

```java
if ("POST".equals(context.getHttpMethod()) && context.getRecordId() != null) {
  return NeoResponse.error(HttpServletResponse.SC_BAD_REQUEST,
      "POST (create) should not include a record ID in the URL. Use PUT or PATCH to update.");
}
```

### Step 6: PUT vs PATCH semantics — decision

**Decision: Keep both as partial updates.** Rationale:

- OBDal does not easily support "set all non-provided fields to null" without breaking mandatory fields, defaults, and audit columns
- Most modern APIs (including Etendo's own Smartclient) treat both as partial updates
- The only future enhancement worth considering: PUT could validate that all writable fields are present (validation-only, same underlying update)

Document this decision with a code comment in the PUT/PATCH case block.

### Step 7: Improve error handling for write responses

After `jsonService.add()`/`.update()` (~line 665), parse and check for errors:

```java
JSONObject responseJson = new JSONObject(result);
JSONObject resp = responseJson.optJSONObject("response");
if (resp != null) {
  int status = resp.optInt("status", 0);
  if (status == -1) {  // RPCREQUEST_STATUS_FAILURE
    String errorMsg = resp.optString("error", "Unknown error");
    return NeoResponse.error(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, errorMsg);
  }
  if (status == -4) {  // RPCREQUEST_STATUS_VALIDATION_ERROR
    return NeoResponse.error(HttpServletResponse.SC_BAD_REQUEST, responseJson);
  }
}
```

### Step 8: Filter write response bodies

POST/PUT/PATCH responses contain the full saved record. Apply the same field filter used for GET:

```java
if ("POST".equals(context.getHttpMethod()) || "PUT".equals(context.getHttpMethod())
    || "PATCH".equals(context.getHttpMethod())) {
  fieldFilter.filterGetResponse(responseJson);
}
```

### Step 9: Defensive handling in NeoFieldFilter

If a client sends already-wrapped `{"data": {...}}`, handle it gracefully in `filterWriteRequest()`:

```java
public JSONObject filterWriteRequest(JSONObject requestBody) {
  if (!active || requestBody == null) {
    return requestBody;
  }
  try {
    // If client sent already-wrapped Smartclient format, unwrap first
    if (requestBody.has("data") && !writableFields.contains("data")) {
      JSONObject inner = requestBody.optJSONObject("data");
      if (inner != null) {
        filterRecord(inner, writableFields);
        return inner;  // Return unwrapped, NeoServlet will re-wrap
      }
    }
    filterRecord(requestBody, writableFields);
  } catch (Exception e) {
    log.error("Error filtering write request: {}", e.getMessage(), e);
  }
  return requestBody;
}
```

### Step 10: Write integration tests

New file: `NeoServletWriteTest.java` (pattern: follow `NeoServletTabFilterTest.java`).

| Test | What it verifies |
|------|-----------------|
| POST creates a new record | Flat JSON → 200, record exists in DB |
| PUT/PATCH updates existing record | Create → update → verify changed fields |
| POST with missing required fields | Appropriate validation error |
| PUT/PATCH without recordId in URL | 400 error |
| POST with recordId in URL | 400 error |
| Write with field filter active | Read-only fields in body are stripped |
| Write response filtering | Response only contains included fields |
| PATCH single field | Only that field changes, others unchanged |

## File Changes Summary

| File | Change |
|------|--------|
| `NeoServlet.java` | Add `wrapForSmartclient()`, fix POST/PUT/PATCH cases, add validation guards, error handling, response filtering |
| `NeoFieldFilter.java` | Handle pre-wrapped `data` input defensively |
| `NeoServletWriteTest.java` | New integration test file |

## Risks and Considerations

1. **`_entityName` format:** Must be DAL entity name (e.g., `"OrderHeader"` not `"C_Order"`). Already what line 589 puts in params.
2. **FK fields:** Clients may send FK as IDs or objects — `DefaultJsonDataService` handles both via `JsonToDataConverter`.
3. **Mandatory fields:** `DefaultJsonDataService` validates via `fromJsonConverter.hasErrors()`. Step 7 surfaces these.
4. **Audit columns:** OBDal auto-sets `creationDate`, `updated`, etc. Should be system/read-only, stripped by filter.
5. **Core bug note:** `DefaultJsonDataService` line 1048 has `jsonObject.put(ID, parameters.containsKey(ID))` — puts boolean instead of value. NOT our bug, but means we MUST inject `id` ourselves (can't rely on fallback).
