# F8: Auto Mock Data + Fetch Wrapper — Design

> Approved design for automatic mock data generation from contract.json with transparent fetch interception.

## What

A CLI tool that reads `contract.json` and produces realistic mock data per entity. A fetch wrapper intercepts API calls when `VITE_MOCK=true`, returning mock responses. Components use standard `fetch()` unchanged — the mock layer is transparent.

## Architecture

```
contract.json → generate-mock-data.js → mockData.js (per window)
                                              ↓
                                    createMockFetch(mockData)
                                              ↓
                                    Components use fetch() normally
                                    VITE_MOCK=true → mock response
                                    VITE_MOCK unset → real backend
```

## Mock Data Generator (`cli/src/generate-mock-data.js`)

Reads contract.json, generates 10-15 records per entity with semantic heuristics:

| Field Pattern | Mock Strategy | Example |
|---|---|---|
| `documentNo`, `*No` | Sequential with prefix | "SO-00001", "SO-00002" |
| `*Partner*`, `*customer*` | Company name pool | "Acme Corp", "TechFlow Inc" |
| `*Date*` | Recent dates (last 90 days) | "2026-02-15" |
| `*Total*`, `*Amount*`, `*Price*` | Random amounts 500-50000 | 4250.00 |
| `*Status*`, `docStatus` | Status pool | "DR", "CO", "VO" |
| `*quantity*`, `*Qty*` | Integers 1-100 | 25 |
| `description`, `*Name*` | Lorem-style phrases | "Standard delivery order" |
| `*currency*` | Currency codes | "USD", "EUR" |
| `*warehouse*` | Warehouse names | "US East Coast" |
| `*product*` | Product name pool | "Laptop Pro 15", "USB Cable" |
| `lineNo`, `*Line*` | Sequential integers | 10, 20, 30 |
| `*discount*` | Percentages 0-25 | 5.0 |
| Default string | "Sample {fieldName}" | "Sample invoiceAddress" |
| Default number | Random in range | 100 |

Parent-child relationships: orderLine records reference existing order IDs.

Output: `artifacts/{window}/generated/web/{window}/mockData.js`

```javascript
export const order = [ { id: "mock-001", documentNo: "SO-00001", ... }, ... ];
export const orderLine = [ { id: "mock-line-001", orderId: "mock-001", ... }, ... ];
```

## Mock Fetch Wrapper (`tools/app-shell/src/lib/mockFetch.js`)

`createMockFetch(mockData)` returns a fetch-compatible function that:

- Parses URL to determine entity and operation
- Routes by method + URL pattern:

| Method | URL Pattern | Behavior |
|---|---|---|
| GET | `/{base}/{entity}` | Return full list, apply query params as filters |
| GET | `/{base}/{entity}/{id}` | Return single record by ID |
| GET | `/{base}/{entity}/{id}/{child}` | Return child records for parent ID |
| POST | `/{base}/{entity}` | Add to list with generated ID, return created |
| PUT | `/{base}/{entity}/{id}` | Update record in list, return updated |
| POST | `/{base}/process/{name}` | Simulate process (toggle docStatus), return success |

Returns Response-like objects with `.ok`, `.json()`, `.status`.

## Activation

Environment variable `VITE_MOCK=true` in `.env.development`.

In the app shell entry point, when `import.meta.env.VITE_MOCK === 'true'`:
- Import mock data from the generated `mockData.js`
- Replace `window.fetch` with `createMockFetch(mockData)` (only for API paths)

When the variable is unset or false, `fetch()` hits the real backend unchanged.

## Integration with Generator CLI

Two options (both supported):
- Combined: `node cli/src/generate-frontend.js` also generates `mockData.js`
- Separate: `node cli/src/generate-mock-data.js artifacts/sales-order/contract.json`

## YAGNI — Not Included

- No simulated latency or errors
- No persistence between reloads (in-memory only)
- No mock of auth/login endpoints
- No UI toggle for mock mode
- No mock for WebSocket or streaming
