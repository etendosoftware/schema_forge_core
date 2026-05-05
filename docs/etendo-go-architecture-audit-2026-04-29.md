# Etendo Go Architecture Audit

Scope observed:
- Repo: `/Users/sebastianbarrozo/Documents/work/epic/schema-forge`
- Root branch: `feature/ETP-3881`
- Root working tree: dirty before audit; observed existing changes:
  - `A .claude/skills/local-sonar-gate/SKILL.md`
  - `M docs/index.md`
  - `M tools/app-shell/test/mcp-proxy.test.js`
  - `M tools/app-shell/vite-plugins/mcp-proxy.js`
  - untracked `.claude/skills/testing-delivery-gate/`, docs, presentations, and `tools/app-shell/test/oauth-mcp-config.test.js`
- Nested module repo: `/Users/sebastianbarrozo/Documents/work/epic/schema-forge/etendo_core/modules/com.etendoerp.go`
- Nested module branch: `feature/ETP-3881`
- Nested module working tree: clean
- Root repo and nested module repo differ: yes. `etendo_core/modules/com.etendoerp.go` is its own Git repository.
- Read-only audit: no files modified by this audit.
- Required module instructions read: `etendo_core/modules/com.etendoerp.go/AGENTS.md`.

Mapped layers observed:
- NEO generic core: `src/com/etendoerp/go/schemaforge/Neo*.java`, `src/com/etendoerp/go/schemaforge/util/Neo*.java`
- NEO handlers/actions: `src/com/etendoerp/go/schemaforge/*Handler.java`, commercial/payment/document helpers
- MCP: `src/com/etendoerp/go/mcp`
- OAuth/JWT/REST: `src/com/etendoerp/go/oauth2`, `src/com/etendoerp/go/rest`
- Onboarding: `src/com/etendoerp/go/onboarding`
- Tests: `src-test/src/com/etendoerp/go`

## Executive Summary
- Critical: 0
- High: 3
- Medium: 5
- Low: 1

## Issues

### High MCP write execution bypasses Schema Forge field write policy

Evidence:
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/mcp/McpToolRouter.java:97-104` — `route()` authorizes only the tool scope first, then resolves the `specName`, then calls `authorizeSpecAccess(specName)`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/mcp/McpToolRouter.java:276-295` — `neo_create` resolves the `SFEntity`, creates a `NeoFieldFilter`, but explicitly bypasses it: “MCP: accept all valid table columns from AI agents, not just SF-configured ones.”
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/mcp/McpToolRouter.java:374-392` — `neo_update` repeats the same pattern and maps caller-supplied fields directly through `mapFieldsToDalProperties(fields, adTab)`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/mcp/McpToolRouter.java:785-790` — `mapFieldsToDalProperties()` documents that it “allows MCP AI agents to set any valid column on the table.”
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoFieldFilter.java:43-49` — `NeoFieldFilter` is the configured boundary that removes non-included and read-only fields from write inputs.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoFieldFilter.java:276-284` — `filterWriteRequest()` removes fields that are not included or are read-only.

Why it matters:
- Security: MCP `neo:write` becomes table-level write once a window spec is accessible. Schema Forge field inclusion/read-only decisions are treated as UI policy, not execution policy.
- Blast radius: affects every MCP `neo_create` and `neo_update` for window specs.
- Coupling: MCP has a parallel write semantics path from NEO REST. REST uses `NeoFieldFilter`; MCP intentionally does not.
- Maintenance risk: future decisions in `ETGO_SF_FIELD` can be silently bypassed by MCP callers.

Recommendation:
- Move execution-time write authorization into `McpAuthorizationService` or an MCP router execution gate that validates operation, spec/window access, entity access, and per-field write policy before routing.
- Use the same `NeoFieldFilter`/field policy model as NEO REST, or define an explicit MCP-only field policy in metadata. Do not encode “AI agents can set any valid column” as a generic router exception.
- Clean cutover: remove the MCP bypass comments and require all writes to pass through one write-policy control point.

Confidence: High

### High Generic NEO and MCP routing enter admin mode before access decisions

Evidence:
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoServlet.java:131-134` — `NeoServlet` enters `OBContext.setAdminMode()` before resolving the spec and before routing to process/report/window access checks.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoServlet.java:200-220` — after admin mode is already active, the servlet resolves `SFSpec`, reads `specType`, and routes to process/report/window handlers.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoServlet.java:234-241` — process access is checked inside `handleProcessSpecRequest()`, after the outer servlet has already entered admin mode.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoServlet.java:295-300` — report access is checked inside `handleReportSpecRequest()`, after the outer servlet has already entered admin mode.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoServlet.java:323-330` — window access is checked inside `handleWindowSpecRequest()`, after the outer servlet has already entered admin mode.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/mcp/McpServlet.java:367-373` — MCP `tools/call` enters admin mode before constructing `McpToolRouter` and calling `router.route(...)`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/mcp/McpToolRouter.java:97-105` — `McpToolRouter.route()` authorizes tool scope, enters admin mode, then resolves and authorizes spec access.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/util/NeoAccessHelper.java:50-60` and `:69-79` — access checks use the current role’s AD access records.

Why it matters:
- Security: access decisions occur after the generic privileged path has already been opened.
- Blast radius: this pattern wraps all NEO servlet routing and MCP tool execution.
- Coupling: generic routing, metadata resolution, and authorization are interleaved instead of being staged as authenticate → authorize → elevate → execute.
- [inference] Admin mode is probably needed for metadata/process execution, but the current boundary makes it hard to prove that no metadata/entity lookup, handler pre-hook, or fallback path observes data before the server-side access gate.

Recommendation:
- Move server-side access checks into a central `NeoAccessHelper` gate that runs before admin mode for spec/window/process/report/action routing.
- Keep admin mode scoped to the minimum metadata/execution block after authorization has succeeded.
- For MCP, have `McpAuthorizationService` validate both scopes and server-side spec/window/process/report access before `McpToolRouter` enters admin mode.
- Clean cutover: remove nested generic admin-mode wrappers around routing once the pre-gate is authoritative.

Confidence: High

### High Commercial line policy is invoked unconditionally from generic CRUD and callout services

Evidence:
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoCrudHandler.java:419-428` — after generic defaults and callout cascade, generic CRUD unconditionally invokes `NeoCommercialLinePolicy.injectProductDerivedUomIfMissing`, `injectGrossAmountIfMissing`, `injectLineGrossAmountIfMissing`, and `injectLineNetAmountIfMissing`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoCommercialLinePolicy.java:42-68` — policy computes `grossAmount` from concrete invoice-line fields: `invoicedQuantity`, `lineNetAmount`, `tax`, and `grossUnitPrice`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoCommercialLinePolicy.java:72-101` — policy computes `lineGrossAmount` from concrete order-line fields: `orderedQuantity`, `unitPrice`, `discount`, `tax`, and `grossUnitPrice`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoCommercialLinePolicy.java:105-128` — policy computes `lineNetAmount` from `invoicedQuantity` and `unitPrice`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoCommercialLinePolicy.java:148-176` — policy injects `uOM` by querying `M_PRODUCT`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoCalloutService.java:701-707` — generic callout transformation injects `taxRate` whenever a callout sets a `tax` field.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/OrderLineHandler.java:77-80` — an order-line handler also calls `NeoCommercialLinePolicy.normalizeOrderLineSelectorPriceMapping(...)`.

Why it matters:
- Wrong layer: `NeoCrudHandler` and `NeoCalloutService` are protected generic services, but they know commercial document line concepts through unconditional policy hooks.
- Blast radius: every create request and callout response traversing these generic services is exposed to field-name-based commercial behavior.
- Coupling: a commercial line convention becomes an implicit global API contract for all entities that happen to use matching field names.
- Maintenance risk: order, quotation, invoice, and inventory line behaviors can diverge because some logic is in handlers and some is in generic services.

Recommendation:
- Move commercial line decisions behind a named commercial line policy/control point selected by metadata or `NeoHandler` `Java_Qualifier`.
- Let generic CRUD/callout execute extension points only; it should not call commercial policy directly.
- Clean cutover: remove unconditional commercial policy calls from `NeoCrudHandler` and `NeoCalloutService`, then register the policy explicitly for order/quotation/invoice line entities.

Confidence: High

### Medium Selector business policy is centralized but still hardcoded in a static generic policy class

Evidence:
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoSelectorPolicy.java:39-48` — `NeoSelectorPolicy` describes itself as selector policy for business concepts and hardcodes `BusinessPartner` and `ProductByPriceAndWarehouse`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoSelectorPolicy.java:50-60` — static reference override filters hardcode reference IDs `166`, `800031`, `EED0EF97D4A7421687F3B365D009E7A6`, and `DF1CEA94B3564A33AFDB37C07E1CE353`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoSelectorPolicy.java:74-86` — context filters branch by concrete DAL entity name.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoSelectorPolicy.java:89-94` — business partner customer/vendor filtering is hardcoded against `isCustomer` and `isVendor`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoSelectorPolicy.java:97-110` — product price-list filtering is hardcoded against `priceList` and `isSOTrx`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoSelectorPolicy.java:122-151` — virtual address selector behavior is hardcoded for `C_BPartner_Location`, `locationAddress`, `C_Country_ID`, `C_Region_ID`, and `C_Location`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoSelectorPolicy.java:223-241` — product selector enrichment hardcodes SQL over `m_productprice`, `m_pricelist_version`, and `m_pricelist`.

Why it matters:
- Normalization: this is better than leaking these branches directly inside `NeoSelectorService`, but the decision is still not metadata-driven or provider-selected.
- Coupling: product, price list, payment method, financial account, BP, and address behavior are all owned by one static selector policy class.
- Blast radius: selector behavior changes for multiple windows are controlled by hardcoded reference IDs and entity names.
- Maintenance risk: adding a new selector policy means editing this central class, not registering metadata or a named provider.

Recommendation:
- Promote `NeoSelectorPolicy` into a selector policy registry/provider model.
- Move reference-specific filters and virtual field wrappers to metadata or named policy providers.
- Keep `NeoSelectorService` as executor and the registry as resolver; do not grow another static map.

Confidence: High

### Medium Active-record filtering is globally disabled for generic CRUD and MCP data service calls

Evidence:
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoCrudHandler.java:225-230` — every generic CRUD DAL parameter map sets `JsonConstants.NO_ACTIVE_FILTER` to `"true"`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/mcp/McpToolRouter.java:723-729` — MCP builds the same base params and sets `JsonConstants.NO_ACTIVE_FILTER` to `"true"`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/util/NeoCrudHelper.java:83-84` — the utility helper also sets `NO_ACTIVE_FILTER` to `"true"`.

Why it matters:
- Security/data exposure: inactive records are normally a server-side data visibility boundary in many Etendo/Openbravo flows. Here that boundary is disabled globally for NEO and MCP generic data paths.
- Blast radius: all window-backed generic list/get/create/update/delete paths that rely on these parameter maps.
- Coupling: an execution-wide compatibility choice is encoded as a generic default rather than per-window or per-use-case metadata.
- [inference] Some windows may need inactive rows for selector/default compatibility, but applying it everywhere makes that exception indistinguishable from the default.

Recommendation:
- Make active-filter behavior metadata-driven or route-specific.
- Default generic CRUD/MCP to active filtering; allow explicit per-entity exceptions through metadata or a named policy provider.
- Put the control point in `NeoAccessHelper` or a CRUD policy resolver so authorization/data visibility policy is not scattered across base-param builders.

Confidence: Medium

### Medium Onboarding transaction ownership is split between servlet-level commit/rollback and inner step/session commits

Evidence:
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/rest/EtendoGoJwtServlet.java:490-521` — onboarding servlet orchestrates client/org/dataset setup and commits once at the end via `EtendoGoDalHelper.commitDalChanges("onboarding", log)`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/rest/EtendoGoJwtServlet.java:527-532` — the same servlet catches failures and calls `EtendoGoDalHelper.rollbackDalChanges("onboarding", e, log)`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/rest/EtendoGoJwtServlet.java:737-750` — dataset import catches its own exception, rolls back via `EtendoGoDalHelper.rollbackDalChanges("onboarding dataset import", e, log)`, returns `false`, and the outer flow returns without throwing.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/rest/EtendoGoDalHelper.java:29-37` — servlet-level commit uses `OBDal.getInstance().commitAndClose()`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/rest/EtendoGoDalHelper.java:40-48` — servlet-level rollback uses `OBDal.getInstance().rollbackAndClose()`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/onboarding/steps/CreateOrgStep.java:51-58` — an inner onboarding step switches context and calls `OBDal.getInstance().commitAndClose()` mid-flow.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/onboarding/OnboardingDatasetImportService.java:107-120` — dataset import runs under admin mode and flushes internally.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/onboarding/steps/MarkOrgReadyStep.java:70-95` — mark-org-ready step flushes before and after process execution.

Why it matters:
- Data integrity: after `CreateOrgStep` commits and closes, later outer rollback cannot undo the already committed client/org phase.
- Maintenance risk: boolean failure returns (`importOnboardingDataset` returns `false`) mean the outer catch/rollback path is bypassed.
- Coupling: transaction boundaries are owned by both protocol servlet and inner application steps.
- [inference] Some phases may require durable commits because Openbravo filters/processes need a fresh session, but that is not modeled as an explicit persisted phase with cleanup/retry semantics.

Recommendation:
- Move onboarding transaction ownership into an onboarding application service.
- Either use one transaction owner for the entire flow or model explicit persisted phases with idempotent retry/cleanup.
- Do not let inner steps call `commitAndClose()` unless the phase boundary is explicit in the service contract.
- Prefer exceptions over boolean failure returns when the outer transaction owner must perform cleanup.

Confidence: High

### Medium Hardcoded “Posted” button fallback embeds metadata policy in `NeoAccessHelper`

Evidence:
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/util/NeoAccessHelper.java:39` — `DEFAULT_POST_PROCESS_ID` is hardcoded as `57496FB9CF9E4E8F847224017941570E`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/util/NeoAccessHelper.java:107-119` — `resolveDefaultPostProcess()` loads that default OBUIAPP process directly.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/util/NeoAccessHelper.java:122-134` — `resolveFallbackObuiappProcess()` applies the fallback only when the AD column DB name is `"Posted"`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoProcessService.java:249-258` — process action discovery applies the shared fallback policy when no process is linked to the button column.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/util/NeoButtonActionHelper.java:89-95` — button action listing applies the same fallback.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/util/NeoButtonActionHelper.java:131-135` — button execution applies the same fallback before access checking.

Why it matters:
- Wrong layer: `NeoAccessHelper` is an access utility, but it owns concrete button/process metadata policy.
- Blast radius: every button column named `Posted` can inherit the default process if metadata does not declare one.
- Coupling: discovery, button execution, and process description all rely on a hardcoded AD process UUID.
- Maintenance risk: a metadata absence becomes executable behavior, making it harder to distinguish intended configuration from fallback compatibility.

Recommendation:
- Move the fallback to metadata or a named button/process policy provider.
- Keep `NeoAccessHelper` focused on access checks only.
- If compatibility requires a fallback, make the compatibility boundary explicit and test it as a named policy.

Confidence: High

### Medium Header/action delegation is mostly routed, but one handler still manually constructs a delegate

Evidence:
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoHeaderActionRouter.java:19-27` — shared dispatch helper exists for header handlers that fan out ACTION requests to delegates.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/SalesOrderHeaderHandler.java:40-55` — sales order header uses CDI-injected delegates and `NeoHeaderActionRouter.dispatch(...)`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/PurchaseOrderHeaderHandler.java:39-54` — purchase order header uses CDI-injected delegates and `NeoHeaderActionRouter.dispatch(...)`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/SalesQuotationHeaderHandler.java:35-44` — sales quotation injects only `NeoCloneRecordHandler`, then manually constructs `new CreateDraftInvoiceHandler().handle(context)`.

Why it matters:
- Coupling: one header handler bypasses the CDI-managed dispatch pattern used by adjacent handlers.
- Maintenance risk: constructor injection, interceptors, future dependencies, or lifecycle behavior added to `CreateDraftInvoiceHandler` will not apply to the manually created instance.
- Blast radius: limited to sales quotation header actions, but it is exactly the repeated action-dispatch family the router was introduced to control.

Recommendation:
- Use CDI injection for `CreateDraftInvoiceHandler` and dispatch through `NeoHeaderActionRouter`, matching sales order and purchase order header handlers.
- Longer term, use a CDI-managed action router/registry keyed by metadata/action name rather than per-header delegate lists.

Confidence: High

### Low Report selector documentation still exposes `roleOrgIds` as a query parameter even though code derives it server-side

Evidence:
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/ReportSelectorsServlet.java:55-59` — class comment lists `roleOrgIds` as an optional query parameter.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/ReportSelectorsServlet.java:96-104` — `SelectorRequest` ignores request-supplied `roleOrgIds` and sets `this.roleOrgIds = readableOrganizationIds()`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/ReportSelectorsServlet.java:116-120` — `readableOrganizationIds()` derives org IDs from `OBContext.getOBContext().getReadableOrganizations()`.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/ReportSelectorsServlet.java:184-189` — selector request is built before admin mode is entered for query execution.
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/ReportSelectorsServlet.java:234-235` — derived `roleOrgIds` are bound as query parameters.

Why it matters:
- The implementation has the right control point: server-derived readable orgs before admin-mode SQL execution.
- The stale documentation/comment is still risky because future maintainers may reintroduce client-provided `roleOrgIds` to match the advertised API.
- Blast radius is narrow and no current authorization bypass was observed.

Recommendation:
- Update the protocol documentation/comment to state that role org IDs are server-derived and never accepted from the request.
- Keep the owner as the server-derived selector access policy in `ReportSelectorsServlet` or a shared report selector policy helper.

Confidence: High

## Not reported as current issues

- MCP discovery/execution mismatch in its simplest form was not observed: `tools/call` now calls `McpAuthorizationService.authorizeToolCall(...)` and `authorizeSpecAccess(...)` before dispatching specific operations (`McpToolRouter.java:97-105`, `:660-668`). The remaining MCP issue is field write-policy bypass, not missing spec/tool execution gating.
- JWT MCP fallback with broad `neo:*` was not observed: legacy JWT fallback is currently `neo:read` (`McpServlet.java:70`, `:257-266`).
- OAuth DCR defaulting public clients to write scope was not observed: DCR sets `String scopes = SCOPE_NEO_READ` (`OAuth2Servlet.java:1195-1199`) and persists registered redirect URIs (`OAuth2Servlet.java:1207-1213`). Redirect URI validation against registered URIs was observed in `OAuth2Servlet.java:1414-1423`.
