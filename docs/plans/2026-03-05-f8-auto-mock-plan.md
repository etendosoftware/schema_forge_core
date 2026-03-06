# F8: Auto Mock Data + Fetch Wrapper — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate realistic mock data from contract.json and intercept fetch calls so the app shell works without a backend when VITE_MOCK=true.

**Architecture:** A CLI generator reads contract field types/names and produces a mockData.js with 10-15 records per entity using semantic heuristics. A fetch wrapper in the app shell intercepts API calls and returns mock responses. Components use standard fetch() unchanged.

**Tech Stack:** Node.js CLI (ESM), Vite env vars, standard fetch API

---

### Task 1: Mock Data Generator — Semantic Heuristics

**Files:**
- Create: `cli/src/generate-mock-data.js`
- Test: `cli/test/generate-mock-data.test.js`

**Context:** The generator reads a contract.json and produces mock records. Each field gets a realistic value based on its name and type. The contract structure is at `artifacts/sales-order/contract.json` — entities have `fields` arrays where each field has `name`, `type`, `tsType`, `visibility`.

**Step 1: Write the failing tests**

Create `cli/test/generate-mock-data.test.js`:

```javascript
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateMockValue, generateMockRecords, generateAllMockData } from '../src/generate-mock-data.js';

const sampleContract = {
  frontendContract: {
    window: { id: '143', name: 'Sales Order', primaryEntity: 'order', category: 'sales' },
    entities: {
      order: {
        fields: [
          { name: 'documentNo', type: 'string', tsType: 'string', visibility: 'readOnly', required: true },
          { name: 'businessPartner', type: 'string', tsType: 'string', visibility: 'editable', required: true },
          { name: 'orderDate', type: 'date', tsType: 'string', visibility: 'editable', required: true },
          { name: 'warehouse', type: 'string', tsType: 'string', visibility: 'editable', required: true },
          { name: 'currency', type: 'string', tsType: 'string', visibility: 'readOnly', required: true },
          { name: 'totalLines', type: 'amount', tsType: 'number', visibility: 'readOnly', required: false },
          { name: 'grandTotal', type: 'amount', tsType: 'number', visibility: 'readOnly', required: false },
          { name: 'docStatus', type: 'string', tsType: 'string', visibility: 'readOnly', required: true },
          { name: 'description', type: 'string', tsType: 'string', visibility: 'editable', required: false },
          { name: 'quantity', type: 'number', tsType: 'number', visibility: 'editable', required: true },
          { name: 'discount', type: 'number', tsType: 'number', visibility: 'editable', required: false },
          { name: 'lineNo', type: 'integer', tsType: 'number', visibility: 'readOnly', required: true },
          { name: 'product', type: 'string', tsType: 'string', visibility: 'editable', required: true },
          { name: 'unitPrice', type: 'amount', tsType: 'number', visibility: 'editable', required: true },
        ],
        searchableFields: ['documentNo', 'businessPartner', 'docStatus'],
        computedFields: [],
      },
      orderLine: {
        fields: [
          { name: 'lineNo', type: 'integer', tsType: 'number', visibility: 'readOnly', required: true },
          { name: 'product', type: 'string', tsType: 'string', visibility: 'editable', required: true },
          { name: 'quantity', type: 'number', tsType: 'number', visibility: 'editable', required: true },
          { name: 'unitPrice', type: 'amount', tsType: 'number', visibility: 'editable', required: true },
          { name: 'lineNetAmount', type: 'amount', tsType: 'number', visibility: 'readOnly', required: false },
        ],
        searchableFields: ['product'],
        computedFields: [],
      },
    },
  },
  backendContract: {
    processEndpoints: [
      { name: 'completeOrder', method: 'POST', path: '/process/completeOrder', entity: 'order' },
    ],
  },
};

describe('generateMockValue', () => {
  it('generates sequential document numbers for documentNo', () => {
    const val = generateMockValue({ name: 'documentNo', type: 'string' }, 0, 'order');
    assert.ok(typeof val === 'string');
    assert.match(val, /^SO-\d+$/);
  });

  it('generates company names for businessPartner', () => {
    const val = generateMockValue({ name: 'businessPartner', type: 'string' }, 0, 'order');
    assert.ok(typeof val === 'string');
    assert.ok(val.length > 2);
  });

  it('generates dates for date fields', () => {
    const val = generateMockValue({ name: 'orderDate', type: 'date' }, 0, 'order');
    assert.ok(typeof val === 'string');
    assert.match(val, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('generates numbers for amount fields', () => {
    const val = generateMockValue({ name: 'grandTotal', type: 'amount' }, 0, 'order');
    assert.ok(typeof val === 'number');
    assert.ok(val > 0);
  });

  it('generates status values for docStatus', () => {
    const val = generateMockValue({ name: 'docStatus', type: 'string' }, 0, 'order');
    assert.ok(['DR', 'CO', 'VO', 'IP'].includes(val));
  });

  it('generates integers for integer fields', () => {
    const val = generateMockValue({ name: 'lineNo', type: 'integer' }, 0, 'order');
    assert.ok(typeof val === 'number');
    assert.ok(Number.isInteger(val));
  });

  it('generates currency codes for currency fields', () => {
    const val = generateMockValue({ name: 'currency', type: 'string' }, 0, 'order');
    assert.ok(['USD', 'EUR', 'GBP'].includes(val));
  });

  it('generates warehouse names for warehouse fields', () => {
    const val = generateMockValue({ name: 'warehouse', type: 'string' }, 0, 'order');
    assert.ok(typeof val === 'string');
    assert.ok(val.length > 2);
  });

  it('generates product names for product fields', () => {
    const val = generateMockValue({ name: 'product', type: 'string' }, 0, 'order');
    assert.ok(typeof val === 'string');
    assert.ok(val.length > 2);
  });

  it('generates discount as percentage', () => {
    const val = generateMockValue({ name: 'discount', type: 'number' }, 0, 'order');
    assert.ok(typeof val === 'number');
    assert.ok(val >= 0 && val <= 25);
  });

  it('generates quantity as integer', () => {
    const val = generateMockValue({ name: 'quantity', type: 'number' }, 0, 'order');
    assert.ok(typeof val === 'number');
    assert.ok(val >= 1 && val <= 100);
  });
});

describe('generateMockRecords', () => {
  it('generates the requested number of records', () => {
    const records = generateMockRecords('order', sampleContract, 10);
    assert.equal(records.length, 10);
  });

  it('each record has an id field', () => {
    const records = generateMockRecords('order', sampleContract, 5);
    records.forEach(r => assert.ok(r.id, 'record should have id'));
  });

  it('each record has all frontend fields', () => {
    const records = generateMockRecords('order', sampleContract, 3);
    const fieldNames = sampleContract.frontendContract.entities.order.fields.map(f => f.name);
    records.forEach(r => {
      fieldNames.forEach(f => assert.ok(f in r, `missing field ${f}`));
    });
  });

  it('generates unique IDs', () => {
    const records = generateMockRecords('order', sampleContract, 10);
    const ids = records.map(r => r.id);
    assert.equal(new Set(ids).size, 10);
  });
});

describe('generateAllMockData', () => {
  it('generates data for all entities', () => {
    const data = generateAllMockData(sampleContract);
    assert.ok(data.order);
    assert.ok(data.orderLine);
    assert.ok(Array.isArray(data.order));
    assert.ok(Array.isArray(data.orderLine));
  });

  it('generates 10-15 records per entity', () => {
    const data = generateAllMockData(sampleContract);
    assert.ok(data.order.length >= 10 && data.order.length <= 15);
    assert.ok(data.orderLine.length >= 10 && data.orderLine.length <= 15);
  });

  it('child records reference parent IDs', () => {
    const data = generateAllMockData(sampleContract);
    const orderIds = data.order.map(r => r.id);
    data.orderLine.forEach(line => {
      assert.ok(line.orderId, 'orderLine should have orderId');
      assert.ok(orderIds.includes(line.orderId), 'orderId should reference existing order');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `node --test cli/test/generate-mock-data.test.js`
Expected: FAIL — module not found

**Step 3: Implement the generator**

Create `cli/src/generate-mock-data.js`:

```javascript
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const COMPANY_NAMES = [
  'Acme Corp', 'TechFlow Inc', 'Global Trade Ltd', 'Summit Industries',
  'Pacific Partners', 'Alpine Solutions', 'Meridian Group', 'Vertex Systems',
  'Atlas Manufacturing', 'Nova Enterprises', 'Pinnacle Services', 'Horizon Labs',
  'Cedar Holdings', 'Sterling & Co', 'Quantum Logistics',
];

const PRODUCT_NAMES = [
  'Laptop Pro 15', 'USB-C Cable', 'Wireless Mouse', 'Mechanical Keyboard',
  'Monitor 27"', 'Webcam HD', 'Headset Pro', 'Docking Station',
  'SSD 1TB', 'RAM 16GB', 'Power Supply 750W', 'Network Switch',
  'Printer Laser', 'Scanner Flatbed', 'External HDD 2TB',
];

const WAREHOUSE_NAMES = [
  'US East Coast', 'US West Coast', 'Europe Central', 'Asia Pacific',
  'South America', 'UK Distribution', 'Spain South', 'Spain North',
];

const DESCRIPTION_PHRASES = [
  'Standard delivery order', 'Urgent shipment request', 'Quarterly bulk purchase',
  'Replacement parts order', 'New client initial order', 'Recurring monthly supply',
  'Special discount agreement', 'Priority express delivery', 'Warehouse transfer',
  'Sample order for evaluation', 'Custom configuration order', 'Maintenance supplies',
];

const STATUS_VALUES = ['DR', 'CO', 'VO', 'IP'];
const CURRENCY_CODES = ['USD', 'EUR', 'GBP'];
const TAX_NAMES = ['VAT 21%', 'VAT 10%', 'Tax Exempt', 'VAT 15%', 'Sales Tax 8%'];

function pick(arr, index) {
  return arr[index % arr.length];
}

function randomBetween(min, max) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function recentDate(index) {
  const d = new Date();
  d.setDate(d.getDate() - (index * 3 + Math.floor(Math.random() * 10)));
  return d.toISOString().split('T')[0];
}

/**
 * Generate a single mock value for a field based on its name and type.
 */
export function generateMockValue(field, index, entityName) {
  const name = field.name.toLowerCase();
  const type = field.type;

  // Semantic matches by field name
  if (name === 'documentno' || name.endsWith('no')) {
    const prefix = entityName === 'order' ? 'SO' : 'LN';
    return `${prefix}-${String(index + 1).padStart(5, '0')}`;
  }
  if (name.includes('partner') || name.includes('customer')) return pick(COMPANY_NAMES, index);
  if (name === 'docstatus' || name.includes('status')) return pick(STATUS_VALUES, index);
  if (name.includes('currency')) return pick(CURRENCY_CODES, index);
  if (name.includes('warehouse')) return pick(WAREHOUSE_NAMES, index);
  if (name.includes('product')) return pick(PRODUCT_NAMES, index);
  if (name === 'description') return pick(DESCRIPTION_PHRASES, index);
  if (name.includes('tax')) return pick(TAX_NAMES, index);
  if (name === 'lineno') return (index + 1) * 10;
  if (name === 'discount') return randomBetween(0, 25);
  if (name === 'quantity' || name.includes('qty')) return Math.floor(randomBetween(1, 100));

  // Type-based fallbacks
  if (type === 'date') return recentDate(index);
  if (type === 'amount') return randomBetween(500, 50000);
  if (type === 'number') return randomBetween(1, 1000);
  if (type === 'integer') return Math.floor(randomBetween(1, 100));
  return `Sample ${field.name}`;
}

/**
 * Generate N mock records for an entity.
 */
export function generateMockRecords(entityName, contract, count = 12) {
  const entity = contract.frontendContract.entities[entityName];
  if (!entity) return [];

  const records = [];
  for (let i = 0; i < count; i++) {
    const record = { id: `mock-${entityName}-${String(i + 1).padStart(3, '0')}` };
    for (const field of entity.fields) {
      record[field.name] = generateMockValue(field, i, entityName);
    }
    records.push(record);
  }
  return records;
}

/**
 * Detect parent-child relationships and generate mock data for all entities.
 * Child entities get an `{parentEntity}Id` field referencing parent records.
 */
export function generateAllMockData(contract, recordCount = 12) {
  const entities = contract.frontendContract.entities;
  const entityNames = Object.keys(entities);
  const primaryEntity = contract.frontendContract.window?.primaryEntity || entityNames[0];

  const data = {};

  // Generate parent first
  data[primaryEntity] = generateMockRecords(primaryEntity, contract, recordCount);

  // Generate children with parent references
  for (const name of entityNames) {
    if (name === primaryEntity) continue;
    const records = generateMockRecords(name, contract, recordCount);
    const parentIds = data[primaryEntity].map(r => r.id);
    records.forEach((r, i) => {
      r[`${primaryEntity}Id`] = parentIds[i % parentIds.length];
    });
    data[name] = records;
  }

  return data;
}

/**
 * Generate mockData.js file content as an ES module.
 */
export function generateMockDataFile(contract) {
  const data = generateAllMockData(contract);
  const lines = [];
  for (const [entity, records] of Object.entries(data)) {
    lines.push(`export const ${entity} = ${JSON.stringify(records, null, 2)};`);
    lines.push('');
  }
  return lines.join('\n');
}

// CLI entry point
const contractPath = process.argv[2];
if (contractPath) {
  const contract = JSON.parse(readFileSync(resolve(contractPath), 'utf-8'));
  const windowName = contract.frontendContract.window.name
    .toLowerCase().replace(/\s+/g, '-');
  const outDir = resolve(dirname(contractPath), `generated/web/${windowName}`);
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'mockData.js');
  writeFileSync(outPath, generateMockDataFile(contract));
  console.log(`Mock data written to ${outPath}`);
}
```

**Step 4: Run tests to verify they pass**

Run: `node --test cli/test/generate-mock-data.test.js`
Expected: All 15+ tests PASS

**Step 5: Generate mock data for Sales Order**

Run: `node cli/src/generate-mock-data.js artifacts/sales-order/contract.json`
Expected: File created at `artifacts/sales-order/generated/web/sales-order/mockData.js`

**Step 6: Commit**

```bash
git add cli/src/generate-mock-data.js cli/test/generate-mock-data.test.js artifacts/sales-order/generated/web/sales-order/mockData.js
git commit -m "feat: add mock data generator with semantic heuristics"
```

---

### Task 2: Mock Fetch Wrapper

**Files:**
- Create: `tools/app-shell/src/lib/mockFetch.js`
- Test: `tools/app-shell/src/lib/__tests__/mockFetch.test.js`

**Context:** The wrapper receives mock data and returns a function with the same signature as `fetch()`. It parses the URL to determine entity and operation, and returns Response-like objects. The API base URL is `/etendo_sf/api` (from `App.jsx`).

**Step 1: Write the failing tests**

Create `tools/app-shell/src/lib/__tests__/mockFetch.test.js`:

```javascript
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { createMockFetch } from '../mockFetch.js';

const mockData = {
  order: [
    { id: 'mock-001', documentNo: 'SO-00001', businessPartner: 'Acme Corp', docStatus: 'DR' },
    { id: 'mock-002', documentNo: 'SO-00002', businessPartner: 'TechFlow Inc', docStatus: 'CO' },
  ],
  orderLine: [
    { id: 'mock-line-001', orderId: 'mock-001', product: 'Laptop', quantity: 5 },
    { id: 'mock-line-002', orderId: 'mock-001', product: 'Mouse', quantity: 10 },
    { id: 'mock-line-003', orderId: 'mock-002', product: 'Keyboard', quantity: 3 },
  ],
};

const basePath = '/etendo_sf/api';

describe('createMockFetch', () => {
  it('returns a function', () => {
    const mockFetch = createMockFetch(mockData, basePath);
    assert.equal(typeof mockFetch, 'function');
  });
});

describe('GET list', () => {
  it('returns all records for entity', async () => {
    const mockFetch = createMockFetch(mockData, basePath);
    const res = await mockFetch(`${basePath}/order`);
    assert.ok(res.ok);
    const data = await res.json();
    assert.equal(data.length, 2);
  });

  it('returns 404 for unknown entity', async () => {
    const mockFetch = createMockFetch(mockData, basePath);
    const res = await mockFetch(`${basePath}/unknown`);
    assert.equal(res.status, 404);
  });
});

describe('GET by id', () => {
  it('returns single record by id', async () => {
    const mockFetch = createMockFetch(mockData, basePath);
    const res = await mockFetch(`${basePath}/order/mock-001`);
    assert.ok(res.ok);
    const data = await res.json();
    assert.equal(data.id, 'mock-001');
  });

  it('returns 404 for unknown id', async () => {
    const mockFetch = createMockFetch(mockData, basePath);
    const res = await mockFetch(`${basePath}/order/nonexistent`);
    assert.equal(res.status, 404);
  });
});

describe('GET children', () => {
  it('returns child records for parent id', async () => {
    const mockFetch = createMockFetch(mockData, basePath);
    const res = await mockFetch(`${basePath}/order/mock-001/orderLine`);
    assert.ok(res.ok);
    const data = await res.json();
    assert.equal(data.length, 2);
    data.forEach(r => assert.equal(r.orderId, 'mock-001'));
  });
});

describe('POST create', () => {
  it('adds record and returns it with generated id', async () => {
    const mockFetch = createMockFetch(mockData, basePath);
    const res = await mockFetch(`${basePath}/order`, {
      method: 'POST',
      body: JSON.stringify({ documentNo: 'SO-NEW', businessPartner: 'New Corp' }),
    });
    assert.ok(res.ok);
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    assert.equal(data.documentNo, 'SO-NEW');
  });
});

describe('PUT update', () => {
  it('updates record and returns it', async () => {
    const mockFetch = createMockFetch(mockData, basePath);
    const res = await mockFetch(`${basePath}/order/mock-001`, {
      method: 'PUT',
      body: JSON.stringify({ businessPartner: 'Updated Corp' }),
    });
    assert.ok(res.ok);
    const data = await res.json();
    assert.equal(data.businessPartner, 'Updated Corp');
    assert.equal(data.id, 'mock-001');
  });
});

describe('POST process', () => {
  it('simulates process execution', async () => {
    const mockFetch = createMockFetch(mockData, basePath);
    const res = await mockFetch(`${basePath}/process/completeOrder`, {
      method: 'POST',
      body: JSON.stringify({ id: 'mock-001' }),
    });
    assert.ok(res.ok);
    const data = await res.json();
    assert.equal(data.status, 'success');
  });
});

describe('passthrough', () => {
  it('returns undefined for non-API URLs so caller can fall back', async () => {
    const mockFetch = createMockFetch(mockData, basePath);
    const res = await mockFetch('/contract.json');
    assert.equal(res, undefined);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `node --test tools/app-shell/src/lib/__tests__/mockFetch.test.js`
Expected: FAIL — module not found

**Step 3: Implement the mock fetch wrapper**

Create `tools/app-shell/src/lib/mockFetch.js`:

```javascript
/**
 * Create a fetch-like function that intercepts API calls and returns mock data.
 * Non-API URLs return undefined so the caller can fall back to real fetch.
 *
 * @param {Object} mockData - { entityName: [...records] }
 * @param {string} basePath - API base path, e.g. '/etendo_sf/api'
 * @returns {Function} fetch-compatible function
 */
export function createMockFetch(mockData, basePath) {
  // Deep clone to avoid mutation across calls
  const store = JSON.parse(JSON.stringify(mockData));
  let idCounter = 1000;

  function jsonResponse(data, status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
      text: async () => JSON.stringify(data),
    };
  }

  return async function mockFetch(url, options = {}) {
    // Only intercept API paths
    if (!url.startsWith(basePath)) return undefined;

    const path = url.slice(basePath.length);
    const method = (options.method || 'GET').toUpperCase();
    const segments = path.split('/').filter(Boolean);

    // POST /process/{name}
    if (segments[0] === 'process' && method === 'POST') {
      let body = {};
      try { body = JSON.parse(options.body); } catch {}
      // Simulate toggling docStatus
      if (body.id && store.order) {
        const record = store.order.find(r => r.id === body.id);
        if (record && record.docStatus !== undefined) {
          record.docStatus = segments[1] === 'voidOrder' ? 'VO' : 'CO';
        }
      }
      return jsonResponse({ status: 'success', message: `Process ${segments[1]} executed` });
    }

    const entity = segments[0];
    if (!entity || !store[entity]) {
      return jsonResponse({ error: 'Not found' }, 404);
    }

    // GET /{entity}
    if (segments.length === 1 && method === 'GET') {
      return jsonResponse([...store[entity]]);
    }

    // POST /{entity}
    if (segments.length === 1 && method === 'POST') {
      let body = {};
      try { body = JSON.parse(options.body); } catch {}
      const record = { id: `mock-new-${++idCounter}`, ...body };
      store[entity].push(record);
      return jsonResponse(record, 201);
    }

    const id = segments[1];

    // GET /{entity}/{id}/{child}
    if (segments.length === 3 && method === 'GET') {
      const childEntity = segments[2];
      if (!store[childEntity]) return jsonResponse({ error: 'Not found' }, 404);
      const parentKey = `${entity}Id`;
      const children = store[childEntity].filter(r => r[parentKey] === id);
      return jsonResponse(children);
    }

    // GET /{entity}/{id}
    if (segments.length === 2 && method === 'GET') {
      const record = store[entity].find(r => r.id === id);
      if (!record) return jsonResponse({ error: 'Not found' }, 404);
      return jsonResponse({ ...record });
    }

    // PUT /{entity}/{id}
    if (segments.length === 2 && method === 'PUT') {
      let body = {};
      try { body = JSON.parse(options.body); } catch {}
      const idx = store[entity].findIndex(r => r.id === id);
      if (idx === -1) return jsonResponse({ error: 'Not found' }, 404);
      store[entity][idx] = { ...store[entity][idx], ...body };
      return jsonResponse({ ...store[entity][idx] });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `node --test tools/app-shell/src/lib/__tests__/mockFetch.test.js`
Expected: All 9 tests PASS

**Step 5: Commit**

```bash
git add tools/app-shell/src/lib/mockFetch.js tools/app-shell/src/lib/__tests__/mockFetch.test.js
git commit -m "feat: add mock fetch wrapper with CRUD and process support"
```

---

### Task 3: Wire Mock into App Shell

**Files:**
- Create: `tools/app-shell/.env.development`
- Modify: `tools/app-shell/src/App.jsx`

**Context:** When `VITE_MOCK=true`, the app replaces `window.fetch` with the mock wrapper before any component renders. The mock data is imported from the generated `mockData.js` at `@generated/web/sales-order/mockData.js` (same Vite alias used by registry.js).

**Step 1: Create `.env.development`**

Create `tools/app-shell/.env.development`:

```
VITE_MOCK=true
```

**Step 2: Modify App.jsx to wire mock fetch**

Current `App.jsx` starts at line 1. Add the mock wiring at the top level, before components render. The key change is in the `App` component's useEffect:

In `tools/app-shell/src/App.jsx`, add these imports at the top (after existing imports):

```javascript
import { createMockFetch } from './lib/mockFetch.js';
```

Then modify the `App` component's useEffect to also set up the mock:

Replace the current `useEffect` block (lines 66-71):

```javascript
  useEffect(() => {
    loadContract().then(contract => {
      setMenuItems(buildMenuFromContract(contract));
      setWindowMap(buildWindowMap(contract));
    });
  }, []);
```

With:

```javascript
  useEffect(() => {
    loadContract().then(async contract => {
      if (import.meta.env.VITE_MOCK === 'true') {
        const mockModule = await import('@generated/web/sales-order/mockData.js');
        const mockData = {};
        for (const [key, value] of Object.entries(mockModule)) {
          mockData[key] = value;
        }
        const mockFetch = createMockFetch(mockData, API_BASE_URL);
        const originalFetch = window.fetch;
        window.fetch = async (url, opts) => {
          const mockResult = await mockFetch(url, opts);
          if (mockResult !== undefined) return mockResult;
          return originalFetch(url, opts);
        };
      }
      setMenuItems(buildMenuFromContract(contract));
      setWindowMap(buildWindowMap(contract));
    });
  }, []);
```

**Step 3: Verify it works**

Run: `cd tools/app-shell && npx vite build`
Expected: Build succeeds

Run: `npx vite` (dev server)
Expected: App loads at localhost:3100, shows Sales Order with 12 mock records in the table, clicking a row shows the form with mock data, order lines appear below.

**Step 4: Commit**

```bash
git add tools/app-shell/.env.development tools/app-shell/src/App.jsx
git commit -m "feat: wire mock fetch into app shell with VITE_MOCK env var"
```

---

### Task 4: Run All Tests and Final Verification

**Files:** None new — verification only.

**Step 1: Run CLI tests**

Run: `node --test 'cli/test/*.test.js'`
Expected: All tests pass (existing generate-frontend tests + new generate-mock-data tests)

**Step 2: Run app shell tests**

Run: `node --test tools/app-shell/src/lib/__tests__/mockFetch.test.js && node --test tools/app-shell/src/windows/__tests__/registry.test.js`
Expected: All tests pass

**Step 3: Build verification**

Run: `cd tools/app-shell && npx vite build`
Expected: Build succeeds with no errors

**Step 4: Commit (if any fixes needed)**

Only commit if fixes were required.
