# Fiscal Monitor Implementation Plan

> **Status: COMPLETED** — 2026-05-04. All 12 tasks implemented and committed on branch `feature/ETP-3778`.

**Goal:** Build a unified read-only Fiscal Monitor that shows invoice statuses for SII, TBAI, SII+TBAI, or Verifactu fiscal systems, adapting its layout to the organization's active fiscal profile.

**Architecture:** Three standard NEO Headless artifacts (`sii-monitor`, `verifactu-monitor`, `tbai-facturas-enviadas`) are extracted from the DB and pushed to NEO to serve invoice data. A custom `fiscal-monitor` window detects the active fiscal profile (reusing `useFiscalConfig`'s `detectProfile` logic), renders KPI count cards at top via the existing `KPIHeader` component, and delegates to three profile-specific section components that each call their backend artifact's NEO endpoint with pagination.

## Implementation Notes (deviations from plan)

- **Spec name:** "Monitor Verifactu" resolves to `monitor-verifactu` (not `verifactu-monitor` as the plan assumed). Fixed in `registry.js` `apiOnlyWindows` and throughout the implementation.
- **Subtab filtering simplified:** All SII/Verifactu subtab entities have an `organization` field and can be filtered directly — no header FK lookup needed. The hook fetches subtabs by `organization` directly, removing the two-step header-then-subtab pattern from the plan.
- **TBAI `estado` values:** Actual values are `"Recibido"`, `"Rechazado"`, `"Error"` (from `ProcessInvoiceTbaiHook` / `SynchronizeUtils`). Plan used placeholder values `OK/ERROR/PENDING`.
- **SII invoice number field:** `documentNo`; invoice FK for navigation: `aeatsiiInvoice`.

**Tech Stack:** Schema Forge pipeline CLI (`extract-from-db.js`, `make regen`), NEO Headless (backend), React + shadcn/ui (custom window), `node:test` (unit tests for pure functions)

---

## File Structure

### New files
```
artifacts/sii-monitor/decisions.json
artifacts/verifactu-monitor/decisions.json
artifacts/tbai-facturas-enviadas/decisions.json
artifacts/fiscal-monitor/decisions.json

tools/app-shell/src/windows/custom/fiscal-monitor/fiscalMonitor.utils.js
tools/app-shell/src/windows/custom/fiscal-monitor/useFiscalMonitor.js
tools/app-shell/src/windows/custom/fiscal-monitor/FiscalKpiCards.jsx
tools/app-shell/src/windows/custom/fiscal-monitor/SiiMonitorSection.jsx
tools/app-shell/src/windows/custom/fiscal-monitor/VerifactuMonitorSection.jsx
tools/app-shell/src/windows/custom/fiscal-monitor/TbaiMonitorSection.jsx
tools/app-shell/src/windows/custom/fiscal-monitor/FiscalMonitorPage.jsx
tools/app-shell/src/windows/custom/fiscal-monitor/index.jsx

cli/test/fiscal-monitor.utils.test.js
```

### Modified files
```
tools/app-shell/src/windows/registry.js        — customLoaders + apiOnlyWindows
tools/app-shell/src/menu.json                  — add fiscal-monitor entry
tools/app-shell/src/locales/en_US.json         — add fiscalMonitor.* keys
tools/app-shell/src/locales/es_ES.json         — add fiscalMonitor.* keys
```

---

## Task 1: Extract sii-monitor artifact

**Files:**
- Create: `artifacts/sii-monitor/decisions.json`

**Context:** The SII Monitor window (ID `FEF76C3E0F104F06A89AAD15A4A4A35C`) has one header record per organization and 4 subtab entities (emitidas, recibidas, and period-anterior variants). All fields are read-only — this is a monitoring view, not an editable form. After extraction, we need the exact entity names to use in the hook (Task 6).

- [x] **Step 1: Extract the schema from DB**

```bash
node cli/src/extract-from-db.js --menu-name "SII Monitor"
```

Expected: creates `artifacts/sii-monitor/schema-raw.json` and `artifacts/sii-monitor/rules-raw.json`.

- [x] **Step 2: Inspect the extracted entities and field names**

```bash
python3 -c "
import json
with open('artifacts/sii-monitor/schema-raw.json') as f: d = json.load(f)
for e in d.get('tabs', d.get('entities', [])):
    name = e.get('entityName') or e.get('entity') or e.get('name') or '?'
    fields = [x.get('name') or x.get('columnName') or '?' for x in e.get('fields', e.get('columns', []))[:5]]
    print(f'Entity: {name}  sample fields: {fields}')
"
```

Record the output — you will need the entity names in Task 6. There should be 5 entities: 1 header + 4 subtab entities (emitidas, recibidas, emitidas periodo anterior, recibidas periodo anterior).

- [x] **Step 3: Create `artifacts/sii-monitor/decisions.json`**

All fields in a monitor are read-only. `organization` and `client` are system-derived.

```json
{
  "$schema": "decisions-v2",
  "window": {
    "category": "monitor",
    "name": "SII Monitor"
  },
  "entities": {}
}
```

The pipeline will auto-classify fields. If any field is incorrectly marked `editable` after Step 4, add an override in the `entities` block:
```json
"entities": {
  "<entityName>": {
    "fields": {
      "organization": { "visibility": "system", "derivation": "fromParent" },
      "client": { "visibility": "system", "derivation": "fromParent" }
    }
  }
}
```

- [x] **Step 4: Generate the contract and push to NEO**

```bash
make regen ONLY=sii-monitor PUSH_TO_NEO=1
```

Expected: `artifacts/sii-monitor/contract.json` created or updated, NEO tables populated.

- [x] **Step 5: Record entity names for Task 6**

```bash
python3 -c "
import json
with open('artifacts/sii-monitor/contract.json') as f: d = json.load(f)
entities = d.get('frontendContract', d).get('entities', {})
for name, e in entities.items():
    print('Entity:', name, '  type:', e.get('type',''))
"
```

Write the entity names here (fill in as you run this):
- Header entity: `_______________`
- Emitidas entity: `_______________`
- Recibidas entity: `_______________`
- Emitidas periodo anterior entity: `_______________`
- Recibidas periodo anterior entity: `_______________`
- Parent key field name for subtabs: `_______________` (look for the FK column linking subtab to header)

- [x] **Step 6: Remind Etendo export**

```
After PUSH_TO_NEO, run in the Etendo root:
./gradlew export.database
```

- [x] **Step 7: Commit**

```bash
git add artifacts/sii-monitor/
git commit -m "Feature ETP-3778: Extract sii-monitor artifact"
```

---

## Task 2: Extract verifactu-monitor artifact

**Files:**
- Create: `artifacts/verifactu-monitor/decisions.json`

**Context:** The Monitor Verifactu window (ID `F4675DAB02134762B66881DAE4672AD0`) has one header per org + 4 subtab entities organized by status (rechazadas, parcialmente aceptadas, aceptadas, inválidas). All read-only.

- [x] **Step 1: Extract the schema**

```bash
node cli/src/extract-from-db.js --menu-name "Monitor Verifactu"
```

- [x] **Step 2: Inspect entities**

```bash
python3 -c "
import json
with open('artifacts/verifactu-monitor/schema-raw.json') as f: d = json.load(f)
for e in d.get('tabs', d.get('entities', [])):
    name = e.get('entityName') or e.get('entity') or e.get('name') or '?'
    fields = [x.get('name') or x.get('columnName') or '?' for x in e.get('fields', e.get('columns', []))[:5]]
    print(f'Entity: {name}  sample fields: {fields}')
"
```

- [x] **Step 3: Create `artifacts/verifactu-monitor/decisions.json`**

```json
{
  "$schema": "decisions-v2",
  "window": {
    "category": "monitor",
    "name": "Monitor Verifactu"
  },
  "entities": {}
}
```

- [x] **Step 4: Generate and push**

```bash
make regen ONLY=verifactu-monitor PUSH_TO_NEO=1
```

- [x] **Step 5: Record entity names for Task 6**

```bash
python3 -c "
import json
with open('artifacts/verifactu-monitor/contract.json') as f: d = json.load(f)
for name, e in d.get('frontendContract', d).get('entities', {}).items():
    print('Entity:', name)
"
```

Record:
- Header entity: `_______________`
- Rechazadas entity: `_______________`
- Parcialmente aceptadas entity: `_______________`
- Aceptadas entity: `_______________`
- Inválidas entity: `_______________`
- Parent key field: `_______________`

- [x] **Step 6: Run Etendo export**

```
./gradlew export.database  (in Etendo root)
```

- [x] **Step 7: Commit**

```bash
git add artifacts/verifactu-monitor/
git commit -m "Feature ETP-3778: Extract verifactu-monitor artifact"
```

---

## Task 3: Extract tbai-facturas-enviadas artifact

**Files:**
- Create: `artifacts/tbai-facturas-enviadas/decisions.json`

**Context:** TBAI Facturas Enviadas (ID `71F24BF89DE748B483BE87594747D6FB`) is a flat list with one record per sent invoice. No subtabs. Read-only. The status field name is needed for the filter in `TbaiMonitorSection`.

- [x] **Step 1: Extract the schema**

```bash
node cli/src/extract-from-db.js --menu-name "TBAI Facturas Enviadas"
```

- [x] **Step 2: Inspect the single entity and find the status field**

```bash
python3 -c "
import json
with open('artifacts/tbai-facturas-enviadas/schema-raw.json') as f: d = json.load(f)
for e in d.get('tabs', d.get('entities', [])):
    name = e.get('entityName') or e.get('entity') or e.get('name') or '?'
    fields = [x.get('name') or x.get('columnName') or '?' for x in e.get('fields', e.get('columns', []))]
    print(f'Entity: {name}')
    print('All fields:', fields)
"
```

Look for a field that represents the send status (words like `status`, `estado`, `result`, `resultado`). Record it for Task 10.

- [x] **Step 3: Create `artifacts/tbai-facturas-enviadas/decisions.json`**

```json
{
  "$schema": "decisions-v2",
  "window": {
    "category": "monitor",
    "name": "TBAI Facturas Enviadas"
  },
  "entities": {}
}
```

- [x] **Step 4: Generate and push**

```bash
make regen ONLY=tbai-facturas-enviadas PUSH_TO_NEO=1
```

- [x] **Step 5: Record entity name and status field for Task 10**

```bash
python3 -c "
import json
with open('artifacts/tbai-facturas-enviadas/contract.json') as f: d = json.load(f)
for name, e in d.get('frontendContract', d).get('entities', {}).items():
    print('Entity:', name)
    for f in e.get('fields', []):
        print(' ', f.get('name'), '—', f.get('type',''))
"
```

Record:
- Main entity name: `_______________`
- Status field name (for filter): `_______________`
- Invoice number/ID field name (for navigation link): `_______________`

- [x] **Step 6: Run Etendo export**

```
./gradlew export.database  (in Etendo root)
```

- [x] **Step 7: Commit**

```bash
git add artifacts/tbai-facturas-enviadas/
git commit -m "Feature ETP-3778: Extract tbai-facturas-enviadas artifact"
```

---

## Task 4: Create fiscal-monitor artifact and menu entry

**Files:**
- Create: `artifacts/fiscal-monitor/decisions.json`
- Modify: `tools/app-shell/src/menu.json`

- [x] **Step 1: Create `artifacts/fiscal-monitor/decisions.json`**

```json
{
  "$schema": "decisions-v2",
  "window": {
    "category": "monitor",
    "name": "Monitor Fiscal",
    "layoutType": "custom"
  },
  "entities": {}
}
```

- [x] **Step 2: Add fiscal-monitor to `tools/app-shell/src/menu.json`**

In the `Settings` group (where `fiscal-config` already lives), add `fiscal-monitor` right after `fiscal-config`:

```json
{
  "name": "fiscal-monitor",
  "label": "Fiscal Monitor",
  "favname": "Fiscal Monitor"
}
```

The full Settings group `items` array should end with:
```json
    { "name": "fiscal-config",  "label": "Fiscal Configuration", "favname": "Fiscal Configuration" },
    { "name": "fiscal-monitor", "label": "Fiscal Monitor",        "favname": "Fiscal Monitor" }
```

- [x] **Step 3: Run pipeline validation**

```bash
make validate-pipeline
```

Expected: 0 violations (new artifact with empty entities is valid).

- [x] **Step 4: Commit**

```bash
git add artifacts/fiscal-monitor/decisions.json tools/app-shell/src/menu.json
git commit -m "Feature ETP-3778: Add fiscal-monitor artifact and menu entry"
```

---

## Task 5: fiscalMonitor.utils.js — pure functions with TDD

**Files:**
- Create: `cli/test/fiscal-monitor.utils.test.js`
- Create: `tools/app-shell/src/windows/custom/fiscal-monitor/fiscalMonitor.utils.js`

- [x] **Step 1: Write the failing test file**

Create `cli/test/fiscal-monitor.utils.test.js`:

```js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildMonitorFetchPlan,
  computeKpis,
} from '../../tools/app-shell/src/windows/custom/fiscal-monitor/fiscalMonitor.utils.js';

describe('buildMonitorFetchPlan', () => {
  it('sii profile fetches only sii-monitor', () => {
    assert.deepStrictEqual(buildMonitorFetchPlan('sii'), ['sii-monitor']);
  });
  it('sii-navarra profile fetches sii-monitor', () => {
    assert.deepStrictEqual(buildMonitorFetchPlan('sii-navarra'), ['sii-monitor']);
  });
  it('tbai profile fetches only tbai-facturas-enviadas', () => {
    assert.deepStrictEqual(buildMonitorFetchPlan('tbai'), ['tbai-facturas-enviadas']);
  });
  it('sii+tbai profile fetches both', () => {
    const plan = buildMonitorFetchPlan('sii+tbai');
    assert.ok(plan.includes('sii-monitor'));
    assert.ok(plan.includes('tbai-facturas-enviadas'));
    assert.equal(plan.length, 2);
  });
  it('verifactu profile fetches only verifactu-monitor', () => {
    assert.deepStrictEqual(buildMonitorFetchPlan('verifactu'), ['verifactu-monitor']);
  });
  it('unconfigured profile fetches nothing', () => {
    assert.deepStrictEqual(buildMonitorFetchPlan('unconfigured'), []);
  });
  it('conflict profile fetches nothing', () => {
    assert.deepStrictEqual(buildMonitorFetchPlan('conflict'), []);
  });
  it('null profile fetches nothing', () => {
    assert.deepStrictEqual(buildMonitorFetchPlan(null), []);
  });
});

describe('computeKpis - verifactu', () => {
  it('maps all 4 subtab totalCounts to kpi object', () => {
    const kpis = computeKpis('verifactu', {
      verifactu: {
        aceptadas:             { totalCount: 10 },
        parcialmenteAceptadas: { totalCount: 3 },
        rechazadas:            { totalCount: 2 },
        invalidas:             { totalCount: 1 },
      },
    });
    assert.deepStrictEqual(kpis.verifactu, {
      aceptadas: 10, parcialmenteAceptadas: 3, rechazadas: 2, invalidas: 1,
    });
    assert.equal(kpis.sii, undefined);
    assert.equal(kpis.tbai, undefined);
  });

  it('defaults to 0 when a subtab bucket is absent', () => {
    const kpis = computeKpis('verifactu', { verifactu: {} });
    assert.equal(kpis.verifactu.aceptadas, 0);
    assert.equal(kpis.verifactu.rechazadas, 0);
  });
});

describe('computeKpis - sii', () => {
  it('returns emitidas and recibidas totals for both periods', () => {
    const kpis = computeKpis('sii', {
      sii: {
        emitidas:                  { totalCount: 50 },
        recibidas:                 { totalCount: 30 },
        emitidasPeriodoAnterior:   { totalCount: 100 },
        recibidasPeriodoAnterior:  { totalCount: 80 },
      },
    });
    assert.deepStrictEqual(kpis.sii, {
      emitidas: 50, recibidas: 30,
      emitidasPeriodoAnterior: 100, recibidasPeriodoAnterior: 80,
    });
  });

  it('defaults to 0 on missing data', () => {
    const kpis = computeKpis('sii', { sii: {} });
    assert.equal(kpis.sii.emitidas, 0);
    assert.equal(kpis.sii.recibidas, 0);
  });
});

describe('computeKpis - sii-navarra', () => {
  it('produces sii kpi bucket (same as sii)', () => {
    const kpis = computeKpis('sii-navarra', {
      sii: { emitidas: { totalCount: 5 }, recibidas: { totalCount: 3 }, emitidasPeriodoAnterior: { totalCount: 0 }, recibidasPeriodoAnterior: { totalCount: 0 } },
    });
    assert.equal(kpis.sii.emitidas, 5);
  });
});

describe('computeKpis - sii+tbai', () => {
  it('returns kpi buckets for both systems', () => {
    const kpis = computeKpis('sii+tbai', {
      sii:  { emitidas: { totalCount: 20 }, recibidas: { totalCount: 15 }, emitidasPeriodoAnterior: { totalCount: 0 }, recibidasPeriodoAnterior: { totalCount: 0 } },
      tbai: { totalCount: 8 },
    });
    assert.equal(kpis.sii.emitidas, 20);
    assert.equal(kpis.tbai.total, 8);
  });
});

describe('computeKpis - tbai', () => {
  it('returns total count', () => {
    const kpis = computeKpis('tbai', { tbai: { totalCount: 45 } });
    assert.deepStrictEqual(kpis.tbai, { total: 45 });
  });

  it('defaults to 0 on missing data', () => {
    const kpis = computeKpis('tbai', { tbai: null });
    assert.equal(kpis.tbai.total, 0);
  });
});

describe('computeKpis - unconfigured/conflict', () => {
  it('returns empty object', () => {
    assert.deepStrictEqual(computeKpis('unconfigured', {}), {});
    assert.deepStrictEqual(computeKpis('conflict', {}), {});
    assert.deepStrictEqual(computeKpis(null, {}), {});
  });
});
```

- [x] **Step 2: Run tests to confirm they fail**

```bash
node --test cli/test/fiscal-monitor.utils.test.js
```

Expected: `ERR_MODULE_NOT_FOUND` or `Cannot find module '...fiscalMonitor.utils.js'`

- [x] **Step 3: Create `tools/app-shell/src/windows/custom/fiscal-monitor/fiscalMonitor.utils.js`**

```js
/**
 * Returns the list of backend spec names to fetch for a given fiscal profile.
 * @param {string|null} profile
 * @returns {string[]}
 */
export function buildMonitorFetchPlan(profile) {
  switch (profile) {
    case 'sii':
    case 'sii-navarra':
      return ['sii-monitor'];
    case 'tbai':
      return ['tbai-facturas-enviadas'];
    case 'sii+tbai':
      return ['sii-monitor', 'tbai-facturas-enviadas'];
    case 'verifactu':
      return ['verifactu-monitor'];
    default:
      return [];
  }
}

/**
 * Computes the KPI card data from monitor subtab totalCounts.
 *
 * @param {string|null} profile - active fiscal profile
 * @param {object} monitorData  - { sii?: {emitidas, recibidas, ...}, tbai?: {totalCount}, verifactu?: {...} }
 * @returns {object} kpis       - { sii?: {...}, tbai?: {...}, verifactu?: {...} }
 */
export function computeKpis(profile, monitorData) {
  const kpis = {};
  const sii  = monitorData?.sii  ?? {};
  const tbai = monitorData?.tbai ?? {};
  const vf   = monitorData?.verifactu ?? {};

  if (profile === 'sii' || profile === 'sii-navarra' || profile === 'sii+tbai') {
    kpis.sii = {
      emitidas:                 sii.emitidas?.totalCount               ?? 0,
      recibidas:                sii.recibidas?.totalCount              ?? 0,
      emitidasPeriodoAnterior:  sii.emitidasPeriodoAnterior?.totalCount  ?? 0,
      recibidasPeriodoAnterior: sii.recibidasPeriodoAnterior?.totalCount ?? 0,
    };
  }

  if (profile === 'tbai' || profile === 'sii+tbai') {
    kpis.tbai = {
      total: tbai?.totalCount ?? 0,
    };
  }

  if (profile === 'verifactu') {
    kpis.verifactu = {
      aceptadas:             vf.aceptadas?.totalCount             ?? 0,
      parcialmenteAceptadas: vf.parcialmenteAceptadas?.totalCount ?? 0,
      rechazadas:            vf.rechazadas?.totalCount            ?? 0,
      invalidas:             vf.invalidas?.totalCount             ?? 0,
    };
  }

  return kpis;
}
```

- [x] **Step 4: Run tests to confirm they pass**

```bash
node --test cli/test/fiscal-monitor.utils.test.js
```

Expected: all tests pass with `✔` marks.

- [x] **Step 5: Commit**

```bash
git add cli/test/fiscal-monitor.utils.test.js tools/app-shell/src/windows/custom/fiscal-monitor/fiscalMonitor.utils.js
git commit -m "Feature ETP-3778: Add fiscalMonitor.utils with tests"
```

---

## Task 6: useFiscalMonitor.js — profile-aware data hook

**Files:**
- Create: `tools/app-shell/src/windows/custom/fiscal-monitor/useFiscalMonitor.js`

**Before starting:** Fill in the entity name constants below using the values recorded in Tasks 1–3.

- [x] **Step 1: Look up entity names from extracted contracts**

```bash
# SII Monitor entities:
python3 -c "import json; d=json.load(open('artifacts/sii-monitor/contract.json')); [print(k) for k in d.get('frontendContract',d).get('entities',{}).keys()]"

# Verifactu Monitor entities:
python3 -c "import json; d=json.load(open('artifacts/verifactu-monitor/contract.json')); [print(k) for k in d.get('frontendContract',d).get('entities',{}).keys()]"

# TBAI entities:
python3 -c "import json; d=json.load(open('artifacts/tbai-facturas-enviadas/contract.json')); [print(k) for k in d.get('frontendContract',d).get('entities',{}).keys()]"
```

- [x] **Step 2: Create `tools/app-shell/src/windows/custom/fiscal-monitor/useFiscalMonitor.js`**

Replace each `'REPLACE_WITH_TASK1_ENTITY_NAME'` with the actual entity name from Step 1.

```js
import { useState, useEffect, useCallback } from 'react';
import { neoBase } from '@/components/related-documents/helpers.js';
import { detectProfile } from '../fiscal-config/fiscalConfig.utils.js';
import { computeKpis } from './fiscalMonitor.utils.js';

// ── Entity constants ──────────────────────────────────────────────────────────
// Update these after running the commands in Task 6 Step 1.
const SII_HEADER_ENTITY        = 'REPLACE_WITH_TASK1_HEADER_ENTITY';
const SII_EMITIDAS_ENTITY      = 'REPLACE_WITH_TASK1_EMITIDAS_ENTITY';
const SII_RECIBIDAS_ENTITY     = 'REPLACE_WITH_TASK1_RECIBIDAS_ENTITY';
const SII_EMITIDAS_ANT_ENTITY  = 'REPLACE_WITH_TASK1_EMITIDAS_ANT_ENTITY';
const SII_RECIBIDAS_ANT_ENTITY = 'REPLACE_WITH_TASK1_RECIBIDAS_ANT_ENTITY';
// The FK field in each SII subtab that points to the header record's ID:
const SII_PARENT_FIELD         = 'REPLACE_WITH_TASK1_PARENT_FIELD';

const VF_HEADER_ENTITY    = 'REPLACE_WITH_TASK2_HEADER_ENTITY';
const VF_ACEPTADAS_ENTITY = 'REPLACE_WITH_TASK2_ACEPTADAS_ENTITY';
const VF_PARCIAL_ENTITY   = 'REPLACE_WITH_TASK2_PARCIALMENTE_ENTITY';
const VF_RECHAZADAS_ENTITY = 'REPLACE_WITH_TASK2_RECHAZADAS_ENTITY';
const VF_INVALIDAS_ENTITY  = 'REPLACE_WITH_TASK2_INVALIDAS_ENTITY';
const VF_PARENT_FIELD      = 'REPLACE_WITH_TASK2_PARENT_FIELD';

const TBAI_ENTITY = 'REPLACE_WITH_TASK3_ENTITY';

// Also used by SII config for profile detection (already pushed to NEO):
const SII_CFG_ENTITY      = 'siiConfiguration';
const TBAI_CFG_ENTITY     = 'header';
const VERIFACTU_CFG_ENTITY = 'cabeceraDeConfiguraciónVerifactu';
// ─────────────────────────────────────────────────────────────────────────────

async function get(base, spec, entity, params, token) {
  const url = `${base}/${spec}/${entity}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`${spec}/${entity} HTTP ${res.status}`);
  return (await res.json())?.response ?? {};
}

async function fetchCount(base, spec, entity, parentField, parentId, token) {
  const criteria = JSON.stringify([{ fieldName: parentField, operator: 'equals', value: parentId }]);
  const resp = await get(base, spec, entity, { criteria, _limit: '1' }, token);
  return { totalCount: resp.totalRows ?? 0 };
}

async function fetchConfigRecord(base, spec, entity, orgId, token) {
  const resp = await get(base, spec, entity, { organization: orgId, _limit: '1' }, token);
  return resp.data?.[0] ?? null;
}

async function fetchSiiMonitorData(base, orgId, token) {
  const resp = await get(base, 'sii-monitor', SII_HEADER_ENTITY, { organization: orgId, _limit: '1' }, token);
  const headerId = resp.data?.[0]?.id;
  if (!headerId) return { headerId: null, emitidas: { totalCount: 0 }, recibidas: { totalCount: 0 }, emitidasPeriodoAnterior: { totalCount: 0 }, recibidasPeriodoAnterior: { totalCount: 0 } };
  const [emitidas, recibidas, emitidasAnt, recibidasAnt] = await Promise.all([
    fetchCount(base, 'sii-monitor', SII_EMITIDAS_ENTITY,      SII_PARENT_FIELD, headerId, token),
    fetchCount(base, 'sii-monitor', SII_RECIBIDAS_ENTITY,     SII_PARENT_FIELD, headerId, token),
    fetchCount(base, 'sii-monitor', SII_EMITIDAS_ANT_ENTITY,  SII_PARENT_FIELD, headerId, token),
    fetchCount(base, 'sii-monitor', SII_RECIBIDAS_ANT_ENTITY, SII_PARENT_FIELD, headerId, token),
  ]);
  return { headerId, emitidas, recibidas, emitidasPeriodoAnterior: emitidasAnt, recibidasPeriodoAnterior: recibidasAnt };
}

async function fetchVerifactuMonitorData(base, orgId, token) {
  const resp = await get(base, 'verifactu-monitor', VF_HEADER_ENTITY, { organization: orgId, _limit: '1' }, token);
  const headerId = resp.data?.[0]?.id;
  if (!headerId) return { headerId: null, aceptadas: { totalCount: 0 }, parcialmenteAceptadas: { totalCount: 0 }, rechazadas: { totalCount: 0 }, invalidas: { totalCount: 0 } };
  const [aceptadas, parcial, rechazadas, invalidas] = await Promise.all([
    fetchCount(base, 'verifactu-monitor', VF_ACEPTADAS_ENTITY,  VF_PARENT_FIELD, headerId, token),
    fetchCount(base, 'verifactu-monitor', VF_PARCIAL_ENTITY,    VF_PARENT_FIELD, headerId, token),
    fetchCount(base, 'verifactu-monitor', VF_RECHAZADAS_ENTITY, VF_PARENT_FIELD, headerId, token),
    fetchCount(base, 'verifactu-monitor', VF_INVALIDAS_ENTITY,  VF_PARENT_FIELD, headerId, token),
  ]);
  return { headerId, aceptadas, parcialmenteAceptadas: parcial, rechazadas, invalidas };
}

async function fetchTbaiData(base, orgId, token) {
  const resp = await get(base, 'tbai-facturas-enviadas', TBAI_ENTITY, { organization: orgId, _limit: '1' }, token);
  return { totalCount: resp.totalRows ?? 0 };
}

export function useFiscalMonitor(orgId, token, apiBaseUrl) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    profile: null,
    monitorData: {},
    kpis: {},
  });

  const load = useCallback(async () => {
    if (!orgId) {
      setState({ loading: false, error: null, profile: 'unconfigured', monitorData: {}, kpis: {} });
      return;
    }
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const base = neoBase(apiBaseUrl);
      const [siiCfg, tbaiCfg, vfCfg] = await Promise.all([
        fetchConfigRecord(base, 'sii-config',      SII_CFG_ENTITY,      orgId, token),
        fetchConfigRecord(base, 'tbai-config',     TBAI_CFG_ENTITY,     orgId, token),
        fetchConfigRecord(base, 'verifactu-config', VERIFACTU_CFG_ENTITY, orgId, token),
      ]);
      const profile = detectProfile(siiCfg, tbaiCfg, vfCfg);

      let monitorData = {};
      if (profile === 'sii' || profile === 'sii-navarra' || profile === 'sii+tbai') {
        monitorData.sii = await fetchSiiMonitorData(base, orgId, token);
      }
      if (profile === 'tbai' || profile === 'sii+tbai') {
        monitorData.tbai = await fetchTbaiData(base, orgId, token);
      }
      if (profile === 'verifactu') {
        monitorData.verifactu = await fetchVerifactuMonitorData(base, orgId, token);
      }

      setState({
        loading: false,
        error: null,
        profile,
        monitorData,
        kpis: computeKpis(profile, monitorData),
      });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  }, [orgId, token, apiBaseUrl]);

  useEffect(() => { load(); }, [load]);

  return { ...state, refetch: load };
}
```

- [x] **Step 3: Commit**

```bash
git add tools/app-shell/src/windows/custom/fiscal-monitor/useFiscalMonitor.js
git commit -m "Feature ETP-3778: Add useFiscalMonitor hook"
```

---

## Task 7: FiscalKpiCards.jsx

**Files:**
- Create: `tools/app-shell/src/windows/custom/fiscal-monitor/FiscalKpiCards.jsx`

**Context:** Uses the existing `KPIHeader` wrapper from `@/components/contract-ui/KPIHeader.jsx`. KPIs differ per profile: SII shows emitidas/recibidas counts, Verifactu shows status buckets, TBAI shows a total.

- [x] **Step 1: Create `FiscalKpiCards.jsx`**

```jsx
import { KPIHeader } from '@/components/contract-ui/KPIHeader.jsx';
import { FileCheck, FileX, FileWarning, File, FileMinus } from 'lucide-react';
import { useUI } from '@/i18n';

export default function FiscalKpiCards({ profile, kpis }) {
  const ui = useUI();

  if (!profile || profile === 'unconfigured' || profile === 'conflict') return null;

  const cards = buildCards(profile, kpis, ui);
  return <KPIHeader kpis={cards} />;
}

function buildCards(profile, kpis, ui) {
  if (!kpis) return [];

  if (profile === 'verifactu') {
    const vf = kpis.verifactu ?? {};
    return [
      { key: 'accepted',  label: ui('fiscalMonitor.kpi.verifactu.aceptadas'),             value: vf.aceptadas             ?? 0, format: 'number', icon: FileCheck   },
      { key: 'partial',   label: ui('fiscalMonitor.kpi.verifactu.parcialmenteAceptadas'), value: vf.parcialmenteAceptadas ?? 0, format: 'number', icon: FileWarning  },
      { key: 'rejected',  label: ui('fiscalMonitor.kpi.verifactu.rechazadas'),             value: vf.rechazadas            ?? 0, format: 'number', icon: FileX        },
      { key: 'invalid',   label: ui('fiscalMonitor.kpi.verifactu.invalidas'),              value: vf.invalidas             ?? 0, format: 'number', icon: FileMinus    },
    ];
  }

  const cards = [];

  if (profile === 'sii' || profile === 'sii-navarra' || profile === 'sii+tbai') {
    const sii = kpis.sii ?? {};
    cards.push(
      { key: 'sii-emitidas',   label: ui('fiscalMonitor.kpi.sii.emitidas'),   value: sii.emitidas   ?? 0, format: 'number', icon: FileCheck },
      { key: 'sii-recibidas',  label: ui('fiscalMonitor.kpi.sii.recibidas'),  value: sii.recibidas  ?? 0, format: 'number', icon: File      },
    );
  }

  if (profile === 'tbai' || profile === 'sii+tbai') {
    const tbai = kpis.tbai ?? {};
    cards.push(
      { key: 'tbai-total', label: ui('fiscalMonitor.kpi.tbai.total'), value: tbai.total ?? 0, format: 'number', icon: FileCheck },
    );
  }

  return cards;
}
```

- [x] **Step 2: Commit**

```bash
git add tools/app-shell/src/windows/custom/fiscal-monitor/FiscalKpiCards.jsx
git commit -m "Feature ETP-3778: Add FiscalKpiCards component"
```

---

## Task 8: SiiMonitorSection.jsx

**Files:**
- Create: `tools/app-shell/src/windows/custom/fiscal-monitor/SiiMonitorSection.jsx`

**Context:** Shows invoices for the SII Monitor. Primary navigation: 2 tabs (Emitidas / Recibidas). Secondary control: period toggle (Actual / Anterior). Each combination maps to one of the 4 SII subtab entities. Each row has an invoice number that links to the invoice in Etendo.

**Before starting:** Confirm entity names and parent field from Task 1. Also check the invoice number/document field name in the SII emitidas contract entity.

- [x] **Step 1: Look up invoice number field name for SII emitidas**

```bash
python3 -c "
import json
with open('artifacts/sii-monitor/contract.json') as f: d = json.load(f)
entities = d.get('frontendContract', d).get('entities', {})
for name, e in entities.items():
    for f in e.get('fields', []):
        fname = f.get('name','')
        if any(kw in fname.lower() for kw in ['numero', 'number', 'doc', 'factura', 'invoice']):
            print(f'Entity {name}: field {fname}')
"
```

Record the invoice number field name — you will use it as `INVOICE_NUMBER_FIELD` below.

- [x] **Step 2: Create `SiiMonitorSection.jsx`**

Replace `REPLACE_*` constants with values from Task 1 and the field check above.

```jsx
import { useState, useEffect } from 'react';
import { useUI } from '@/i18n';
import { neoBase } from '@/components/related-documents/helpers.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2 } from 'lucide-react';

// ── Fill in from Task 1 output ────────────────────────────────────────────────
const SII_SPEC          = 'sii-monitor';
const SII_HEADER_ENTITY = 'REPLACE_WITH_TASK1_HEADER_ENTITY';
const SUBTAB_ENTITIES   = {
  emitidas:                 'REPLACE_WITH_TASK1_EMITIDAS_ENTITY',
  recibidas:                'REPLACE_WITH_TASK1_RECIBIDAS_ENTITY',
  emitidasPeriodoAnterior:  'REPLACE_WITH_TASK1_EMITIDAS_ANT_ENTITY',
  recibidasPeriodoAnterior: 'REPLACE_WITH_TASK1_RECIBIDAS_ANT_ENTITY',
};
const SII_PARENT_FIELD     = 'REPLACE_WITH_TASK1_PARENT_FIELD';
const INVOICE_NUMBER_FIELD = 'REPLACE_WITH_INVOICE_NUMBER_FIELD';
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

async function fetchSubtab(base, entity, parentId, page, token) {
  const criteria = JSON.stringify([{ fieldName: SII_PARENT_FIELD, operator: 'equals', value: parentId }]);
  const params = new URLSearchParams({ criteria, _startRow: String((page - 1) * PAGE_SIZE), _endRow: String(page * PAGE_SIZE) });
  const res = await fetch(`${base}/${SII_SPEC}/${entity}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return { data: json?.response?.data ?? [], totalRows: json?.response?.totalRows ?? 0 };
}

export default function SiiMonitorSection({ headerId, token, apiBaseUrl }) {
  const ui = useUI();
  const [tab, setTab]       = useState('emitidas');   // 'emitidas' | 'recibidas'
  const [period, setPeriod] = useState('actual');     // 'actual' | 'anterior'
  const [page, setPage]     = useState(1);
  const [rows, setRows]     = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const entityKey = tab === 'emitidas'
    ? (period === 'actual' ? 'emitidas' : 'emitidasPeriodoAnterior')
    : (period === 'actual' ? 'recibidas' : 'recibidasPeriodoAnterior');

  useEffect(() => {
    if (!headerId) return;
    setLoading(true);
    setError(null);
    const base = neoBase(apiBaseUrl);
    fetchSubtab(base, SUBTAB_ENTITIES[entityKey], headerId, page, token)
      .then(({ data, totalRows }) => { setRows(data); setTotalRows(totalRows); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [headerId, entityKey, page, token, apiBaseUrl]);

  // Reset page when tab or period changes
  useEffect(() => { setPage(1); }, [tab, period]);

  const columns = rows[0] ? Object.keys(rows[0]).filter(k => !k.startsWith('_') && k !== 'id') : [];
  const totalPages = Math.ceil(totalRows / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Primary tabs: Emitidas / Recibidas */}
      <div className="flex gap-2 border-b pb-2">
        {['emitidas', 'recibidas'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t ${tab === t ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {ui(`fiscalMonitor.sii.tab.${t}`)}
          </button>
        ))}
      </div>

      {/* Period toggle */}
      <div className="flex gap-2">
        {['actual', 'anterior'].map(p => (
          <Button
            key={p}
            size="sm"
            variant={period === p ? 'default' : 'outline'}
            onClick={() => setPeriod(p)}
          >
            {ui(`fiscalMonitor.sii.period.${p}`)}
          </Button>
        ))}
      </div>

      {/* Table */}
      {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>}
      {error   && <p className="text-destructive text-sm">{error}</p>}
      {!loading && !error && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ui('fiscalMonitor.col.invoiceNumber')}</TableHead>
                {columns.filter(c => c !== INVOICE_NUMBER_FIELD).map(c => (
                  <TableHead key={c}>{c}</TableHead>
                ))}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={columns.length + 2} className="text-center text-muted-foreground">{ui('fiscalMonitor.empty')}</TableCell></TableRow>
              ) : rows.map((row, i) => (
                <TableRow key={row.id ?? i}>
                  <TableCell className="font-mono">{row[INVOICE_NUMBER_FIELD] ?? '-'}</TableCell>
                  {columns.filter(c => c !== INVOICE_NUMBER_FIELD).map(c => (
                    <TableCell key={c}>{String(row[c] ?? '-')}</TableCell>
                  ))}
                  <TableCell>
                    {row.invoiceId && (
                      <a href={`/web/org.openbravo.client.application/window/${row.invoiceId}`} target="_blank" rel="noreferrer" title={ui('fiscalMonitor.openInvoice')}>
                        <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>{ui('fiscalMonitor.pagination', { page, total: totalPages })}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  {ui('fiscalMonitor.prev')}
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  {ui('fiscalMonitor.next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [x] **Step 3: Commit**

```bash
git add tools/app-shell/src/windows/custom/fiscal-monitor/SiiMonitorSection.jsx
git commit -m "Feature ETP-3778: Add SiiMonitorSection"
```

---

## Task 9: VerifactuMonitorSection.jsx

**Files:**
- Create: `tools/app-shell/src/windows/custom/fiscal-monitor/VerifactuMonitorSection.jsx`

**Context:** Shows Verifactu invoices. Navigation: 4 status tabs (Aceptadas / Parcialmente / Rechazadas / Inválidas), each mapping to one NEO subtab entity. Same table + pagination pattern as SiiMonitorSection.

**Before starting:** Confirm entity names and parent field from Task 2.

- [x] **Step 1: Create `VerifactuMonitorSection.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { useUI } from '@/i18n';
import { neoBase } from '@/components/related-documents/helpers.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2 } from 'lucide-react';

// ── Fill in from Task 2 output ────────────────────────────────────────────────
const VF_SPEC = 'verifactu-monitor';
const STATUS_ENTITIES = {
  aceptadas:             'REPLACE_WITH_TASK2_ACEPTADAS_ENTITY',
  parcialmenteAceptadas: 'REPLACE_WITH_TASK2_PARCIALMENTE_ENTITY',
  rechazadas:            'REPLACE_WITH_TASK2_RECHAZADAS_ENTITY',
  invalidas:             'REPLACE_WITH_TASK2_INVALIDAS_ENTITY',
};
const VF_PARENT_FIELD      = 'REPLACE_WITH_TASK2_PARENT_FIELD';
const INVOICE_NUMBER_FIELD = 'REPLACE_WITH_VF_INVOICE_NUMBER_FIELD';
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const STATUS_TABS = ['aceptadas', 'parcialmenteAceptadas', 'rechazadas', 'invalidas'];

async function fetchStatusTab(base, entity, parentId, page, token) {
  const criteria = JSON.stringify([{ fieldName: VF_PARENT_FIELD, operator: 'equals', value: parentId }]);
  const params = new URLSearchParams({ criteria, _startRow: String((page - 1) * PAGE_SIZE), _endRow: String(page * PAGE_SIZE) });
  const res = await fetch(`${base}/${VF_SPEC}/${entity}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return { data: json?.response?.data ?? [], totalRows: json?.response?.totalRows ?? 0 };
}

export default function VerifactuMonitorSection({ headerId, token, apiBaseUrl }) {
  const ui = useUI();
  const [activeTab, setActiveTab] = useState('aceptadas');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!headerId) return;
    setLoading(true);
    setError(null);
    const base = neoBase(apiBaseUrl);
    fetchStatusTab(base, STATUS_ENTITIES[activeTab], headerId, page, token)
      .then(({ data, totalRows }) => { setRows(data); setTotalRows(totalRows); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [headerId, activeTab, page, token, apiBaseUrl]);

  useEffect(() => { setPage(1); }, [activeTab]);

  const columns = rows[0] ? Object.keys(rows[0]).filter(k => !k.startsWith('_') && k !== 'id') : [];
  const totalPages = Math.ceil(totalRows / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2">
        {STATUS_TABS.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t ${activeTab === t ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {ui(`fiscalMonitor.verifactu.tab.${t}`)}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>}
      {error   && <p className="text-destructive text-sm">{error}</p>}
      {!loading && !error && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ui('fiscalMonitor.col.invoiceNumber')}</TableHead>
                {columns.filter(c => c !== INVOICE_NUMBER_FIELD).map(c => (
                  <TableHead key={c}>{c}</TableHead>
                ))}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={columns.length + 2} className="text-center text-muted-foreground">{ui('fiscalMonitor.empty')}</TableCell></TableRow>
              ) : rows.map((row, i) => (
                <TableRow key={row.id ?? i}>
                  <TableCell className="font-mono">{row[INVOICE_NUMBER_FIELD] ?? '-'}</TableCell>
                  {columns.filter(c => c !== INVOICE_NUMBER_FIELD).map(c => (
                    <TableCell key={c}>{String(row[c] ?? '-')}</TableCell>
                  ))}
                  <TableCell>
                    {row.invoiceId && (
                      <a href={`/web/org.openbravo.client.application/window/${row.invoiceId}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>{ui('fiscalMonitor.pagination', { page, total: totalPages })}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{ui('fiscalMonitor.prev')}</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{ui('fiscalMonitor.next')}</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add tools/app-shell/src/windows/custom/fiscal-monitor/VerifactuMonitorSection.jsx
git commit -m "Feature ETP-3778: Add VerifactuMonitorSection"
```

---

## Task 10: TbaiMonitorSection.jsx

**Files:**
- Create: `tools/app-shell/src/windows/custom/fiscal-monitor/TbaiMonitorSection.jsx`

**Context:** TBAI has no subtabs — one flat list with one record per sent invoice. Status filter chips above the table filter by the status field recorded in Task 3. If the status field supports server-side filtering, pass it as a criteria parameter; otherwise filter client-side (note: client-side filtering won't work across pages).

**Before starting:** Confirm entity name and status field name from Task 3.

- [x] **Step 1: Decide server-side vs client-side status filter**

Check if the TBAI status field is in the NEO contract with `filterable: true`:

```bash
python3 -c "
import json
with open('artifacts/tbai-facturas-enviadas/contract.json') as f: d = json.load(f)
for ename, e in d.get('frontendContract', d).get('entities', {}).items():
    for f in e.get('fields', []):
        print(f.get('name'), '— filterable:', f.get('filterable'), '— type:', f.get('type'))
" | grep -i "status\|estado\|result"
```

If filterable, the section can filter server-side via `criteria`. If not, filter client-side (acceptable since TBAI lists are typically small per org).

- [x] **Step 2: Create `TbaiMonitorSection.jsx`**

Replace `REPLACE_*` with values from Task 3.

```jsx
import { useState, useEffect, useMemo } from 'react';
import { useUI } from '@/i18n';
import { neoBase } from '@/components/related-documents/helpers.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Loader2 } from 'lucide-react';

// ── Fill in from Task 3 output ────────────────────────────────────────────────
const TBAI_SPEC            = 'tbai-facturas-enviadas';
const TBAI_ENTITY          = 'REPLACE_WITH_TASK3_ENTITY';
const STATUS_FIELD         = 'REPLACE_WITH_TASK3_STATUS_FIELD';    // e.g. 'estado', 'status'
const INVOICE_NUMBER_FIELD = 'REPLACE_WITH_TASK3_INVOICE_NUMBER_FIELD';
const STATUS_FILTER_VALUES = ['all', 'OK', 'ERROR', 'PENDING'];    // adjust to actual enum values from Task 3
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

async function fetchTbaiList(base, token, page, statusFilter) {
  const params = new URLSearchParams({
    _startRow: String((page - 1) * PAGE_SIZE),
    _endRow: String(page * PAGE_SIZE),
  });
  if (statusFilter && statusFilter !== 'all') {
    params.set('criteria', JSON.stringify([{ fieldName: STATUS_FIELD, operator: 'equals', value: statusFilter }]));
  }
  const res = await fetch(`${base}/${TBAI_SPEC}/${TBAI_ENTITY}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return { data: json?.response?.data ?? [], totalRows: json?.response?.totalRows ?? 0 };
}

export default function TbaiMonitorSection({ token, apiBaseUrl }) {
  const ui = useUI();
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchTbaiList(neoBase(apiBaseUrl), token, page, statusFilter)
      .then(({ data, totalRows }) => { setRows(data); setTotalRows(totalRows); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [statusFilter, page, token, apiBaseUrl]);

  useEffect(() => { setPage(1); }, [statusFilter]);

  const columns = rows[0] ? Object.keys(rows[0]).filter(k => !k.startsWith('_') && k !== 'id') : [];
  const totalPages = Math.ceil(totalRows / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Status filter chips */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTER_VALUES.map(s => (
          <Badge
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setStatusFilter(s)}
          >
            {ui(`fiscalMonitor.tbai.status.${s}`)}
          </Badge>
        ))}
      </div>

      {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>}
      {error   && <p className="text-destructive text-sm">{error}</p>}
      {!loading && !error && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ui('fiscalMonitor.col.invoiceNumber')}</TableHead>
                {columns.filter(c => c !== INVOICE_NUMBER_FIELD).map(c => (
                  <TableHead key={c}>{c}</TableHead>
                ))}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={columns.length + 2} className="text-center text-muted-foreground">{ui('fiscalMonitor.empty')}</TableCell></TableRow>
              ) : rows.map((row, i) => (
                <TableRow key={row.id ?? i}>
                  <TableCell className="font-mono">{row[INVOICE_NUMBER_FIELD] ?? '-'}</TableCell>
                  {columns.filter(c => c !== INVOICE_NUMBER_FIELD).map(c => (
                    <TableCell key={c}>{String(row[c] ?? '-')}</TableCell>
                  ))}
                  <TableCell>
                    {row.invoiceId && (
                      <a href={`/web/org.openbravo.client.application/window/${row.invoiceId}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>{ui('fiscalMonitor.pagination', { page, total: totalPages })}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{ui('fiscalMonitor.prev')}</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{ui('fiscalMonitor.next')}</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [x] **Step 3: Update `STATUS_FILTER_VALUES` with actual enum values**

After reviewing Task 3 output (status field values), update the `STATUS_FILTER_VALUES` array with the real values the status field can hold (e.g. `['all', 'E', 'P', 'R']` or whatever the DB stores).

- [x] **Step 4: Commit**

```bash
git add tools/app-shell/src/windows/custom/fiscal-monitor/TbaiMonitorSection.jsx
git commit -m "Feature ETP-3778: Add TbaiMonitorSection"
```

---

## Task 11: FiscalMonitorPage.jsx — orchestrator + index

**Files:**
- Create: `tools/app-shell/src/windows/custom/fiscal-monitor/FiscalMonitorPage.jsx`
- Create: `tools/app-shell/src/windows/custom/fiscal-monitor/index.jsx`

- [x] **Step 1: Create `FiscalMonitorPage.jsx`**

```jsx
import { useAuth } from '@/auth/AuthContext.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { useUI } from '@/i18n';
import { useFiscalMonitor } from './useFiscalMonitor.js';
import FiscalKpiCards from './FiscalKpiCards.jsx';
import SiiMonitorSection from './SiiMonitorSection.jsx';
import TbaiMonitorSection from './TbaiMonitorSection.jsx';
import VerifactuMonitorSection from './VerifactuMonitorSection.jsx';

export default function FiscalMonitorPage({ token, apiBaseUrl }) {
  const ui = useUI();
  const { selectedOrg } = useAuth();
  const orgId = selectedOrg?.id ?? null;

  const { loading, error, profile, monitorData, kpis } = useFiscalMonitor(orgId, token, apiBaseUrl);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-destructive">{ui('fiscalMonitor.error', { error })}</div>;
  }

  if (!profile || profile === 'unconfigured') {
    return (
      <div className="p-6 text-muted-foreground text-center">
        {ui('fiscalMonitor.unconfigured')}
      </div>
    );
  }

  if (profile === 'conflict') {
    return (
      <div className="p-6 text-destructive text-center">
        {ui('fiscalMonitor.conflict')}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">{ui('fiscalMonitor.title')}</h1>

      <FiscalKpiCards profile={profile} kpis={kpis} />

      {/* SII section */}
      {(profile === 'sii' || profile === 'sii-navarra' || profile === 'sii+tbai') && (
        <section>
          {profile === 'sii+tbai' && (
            <h2 className="text-base font-medium mb-3">{ui('fiscalMonitor.section.sii')}</h2>
          )}
          <SiiMonitorSection
            headerId={monitorData.sii?.headerId}
            token={token}
            apiBaseUrl={apiBaseUrl}
          />
        </section>
      )}

      {/* Divider for combined profile */}
      {profile === 'sii+tbai' && <hr className="border-border" />}

      {/* TBAI section */}
      {(profile === 'tbai' || profile === 'sii+tbai') && (
        <section>
          {profile === 'sii+tbai' && (
            <h2 className="text-base font-medium mb-3">{ui('fiscalMonitor.section.tbai')}</h2>
          )}
          <TbaiMonitorSection token={token} apiBaseUrl={apiBaseUrl} />
        </section>
      )}

      {/* Verifactu section */}
      {profile === 'verifactu' && (
        <VerifactuMonitorSection
          headerId={monitorData.verifactu?.headerId}
          token={token}
          apiBaseUrl={apiBaseUrl}
        />
      )}
    </div>
  );
}
```

- [x] **Step 2: Create `index.jsx`**

```js
export { default } from './FiscalMonitorPage.jsx';
```

- [x] **Step 3: Commit**

```bash
git add tools/app-shell/src/windows/custom/fiscal-monitor/
git commit -m "Feature ETP-3778: Add FiscalMonitorPage orchestrator"
```

---

## Task 12: Register window + complete i18n + final validation

**Files:**
- Modify: `tools/app-shell/src/windows/registry.js`
- Modify: `tools/app-shell/src/locales/en_US.json`
- Modify: `tools/app-shell/src/locales/es_ES.json`

- [x] **Step 1: Add fiscal-monitor to `registry.js`**

In the `customLoaders` object, add:
```js
'fiscal-monitor': () => import('./custom/fiscal-monitor/index.jsx'),
```

In the `apiOnlyWindows` Set, add the three backend artifacts:
```js
export const apiOnlyWindows = new Set([
  'sii-config',
  'tbai-config',
  'verifactu-config',
  'sii-monitor',            // ← add
  'verifactu-monitor',      // ← add
  'tbai-facturas-enviadas', // ← add
]);
```

- [x] **Step 2: Add all i18n keys to `en_US.json`**

Under `genericLabels`, add:

```json
"fiscalMonitor.title": "Fiscal Monitor",
"fiscalMonitor.unconfigured": "No fiscal system configured for this organization.",
"fiscalMonitor.conflict": "Invalid configuration: Verifactu and SII/TBAI cannot coexist.",
"fiscalMonitor.error": "Error loading monitor data: {error}",
"fiscalMonitor.empty": "No records found.",
"fiscalMonitor.prev": "Previous",
"fiscalMonitor.next": "Next",
"fiscalMonitor.pagination": "Page {page} of {total}",
"fiscalMonitor.openInvoice": "Open invoice",
"fiscalMonitor.col.invoiceNumber": "Invoice No.",
"fiscalMonitor.section.sii": "SII",
"fiscalMonitor.section.tbai": "TBAI",
"fiscalMonitor.sii.tab.emitidas": "Issued",
"fiscalMonitor.sii.tab.recibidas": "Received",
"fiscalMonitor.sii.period.actual": "Current period",
"fiscalMonitor.sii.period.anterior": "Previous period",
"fiscalMonitor.verifactu.tab.aceptadas": "Accepted",
"fiscalMonitor.verifactu.tab.parcialmenteAceptadas": "Partially accepted",
"fiscalMonitor.verifactu.tab.rechazadas": "Rejected",
"fiscalMonitor.verifactu.tab.invalidas": "Invalid",
"fiscalMonitor.tbai.status.all": "All",
"fiscalMonitor.tbai.status.OK": "Sent",
"fiscalMonitor.tbai.status.ERROR": "Error",
"fiscalMonitor.tbai.status.PENDING": "Pending",
"fiscalMonitor.kpi.sii.emitidas": "Issued invoices",
"fiscalMonitor.kpi.sii.recibidas": "Received invoices",
"fiscalMonitor.kpi.tbai.total": "TBAI sent",
"fiscalMonitor.kpi.verifactu.aceptadas": "Accepted",
"fiscalMonitor.kpi.verifactu.parcialmenteAceptadas": "Partially accepted",
"fiscalMonitor.kpi.verifactu.rechazadas": "Rejected",
"fiscalMonitor.kpi.verifactu.invalidas": "Invalid"
```

- [x] **Step 3: Add Spanish translations to `es_ES.json`**

Under `genericLabels`, add:

```json
"fiscalMonitor.title": "Monitor Fiscal",
"fiscalMonitor.unconfigured": "No hay sistema fiscal configurado para esta organización.",
"fiscalMonitor.conflict": "Configuración inválida: Verifactu y SII/TBAI no pueden coexistir.",
"fiscalMonitor.error": "Error cargando datos del monitor: {error}",
"fiscalMonitor.empty": "No hay registros.",
"fiscalMonitor.prev": "Anterior",
"fiscalMonitor.next": "Siguiente",
"fiscalMonitor.pagination": "Página {page} de {total}",
"fiscalMonitor.openInvoice": "Abrir factura",
"fiscalMonitor.col.invoiceNumber": "Nº Factura",
"fiscalMonitor.section.sii": "SII",
"fiscalMonitor.section.tbai": "TBAI",
"fiscalMonitor.sii.tab.emitidas": "Emitidas",
"fiscalMonitor.sii.tab.recibidas": "Recibidas",
"fiscalMonitor.sii.period.actual": "Periodo actual",
"fiscalMonitor.sii.period.anterior": "Periodo anterior",
"fiscalMonitor.verifactu.tab.aceptadas": "Aceptadas",
"fiscalMonitor.verifactu.tab.parcialmenteAceptadas": "Parcialmente aceptadas",
"fiscalMonitor.verifactu.tab.rechazadas": "Rechazadas",
"fiscalMonitor.verifactu.tab.invalidas": "Inválidas",
"fiscalMonitor.tbai.status.all": "Todas",
"fiscalMonitor.tbai.status.OK": "Enviadas",
"fiscalMonitor.tbai.status.ERROR": "Error",
"fiscalMonitor.tbai.status.PENDING": "Pendiente",
"fiscalMonitor.kpi.sii.emitidas": "Facturas emitidas",
"fiscalMonitor.kpi.sii.recibidas": "Facturas recibidas",
"fiscalMonitor.kpi.tbai.total": "TBAI enviadas",
"fiscalMonitor.kpi.verifactu.aceptadas": "Aceptadas",
"fiscalMonitor.kpi.verifactu.parcialmenteAceptadas": "Parcialmente aceptadas",
"fiscalMonitor.kpi.verifactu.rechazadas": "Rechazadas",
"fiscalMonitor.kpi.verifactu.invalidas": "Inválidas"
```

- [x] **Step 4: Run all tests**

```bash
make test
```

Expected: all tests pass including the new fiscal-monitor.utils tests.

- [x] **Step 5: Run pipeline validator**

```bash
make validate-pipeline
```

Expected: 0 violations.

- [x] **Step 6: Push fiscal-monitor artifact to NEO**

The fiscal-monitor decisions.json has no entities so `make regen` won't push data, but run to confirm clean state:

```bash
make regen ONLY=fiscal-monitor
```

- [x] **Step 7: Final commit**

```bash
git add tools/app-shell/src/windows/registry.js tools/app-shell/src/locales/en_US.json tools/app-shell/src/locales/es_ES.json
git commit -m "Feature ETP-3778: Register fiscal-monitor window and add i18n keys"
```

---

## Post-implementation notes

- **TBAI status enum values:** Task 10 uses placeholder status values (`OK`, `ERROR`, `PENDING`). Update `STATUS_FILTER_VALUES` and the corresponding i18n keys once the actual enum values are known from the DB extraction.
- **Invoice navigation URL:** The `href` in section components uses `/web/org.openbravo.client.application/window/{invoiceId}`. Verify this pattern against how other windows link to invoices in the codebase (e.g. `tools/app-shell/src/components/related-documents/`).
- **Column rendering:** The table columns in Tasks 8–10 render all non-private fields dynamically. After confirming the extracted fields, you may want to whitelist specific columns per entity for a cleaner UI.
- **Export DB:** After any `PUSH_TO_NEO=1` run, remember to run `./gradlew export.database` in the Etendo root.
