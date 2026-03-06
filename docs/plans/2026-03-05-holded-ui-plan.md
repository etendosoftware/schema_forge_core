# Holded-Style UI Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade generated UI from basic shadcn to a modern Holded-inspired look with slide panel, status badges, and clean table styling.

**Architecture:** Two fixed shell components (SlidePanel, StatusBadge) plus updated generators (table, form, page) that produce components using them. The useEntity hook stays untouched — only JSX output changes.

**Tech Stack:** React, Tailwind CSS, shadcn/ui components, Node.js test runner

---

### Task 1: Create Fixed Shell Components — SlidePanel + StatusBadge (PARALLEL)

**Files:**
- Create: `tools/app-shell/src/components/ui/slide-panel.jsx`
- Create: `tools/app-shell/src/components/ui/status-badge.jsx`

**Step 1: Create SlidePanel component**

Create `tools/app-shell/src/components/ui/slide-panel.jsx`:

```jsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export function SlidePanel({ open, onClose, title, children }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/30 z-40 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-[480px] max-w-full bg-white z-50 shadow-xl',
          'transform transition-transform duration-300 ease-in-out',
          'flex flex-col',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </>
  );
}
```

**Step 2: Create StatusBadge component**

Create `tools/app-shell/src/components/ui/status-badge.jsx`:

```jsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const STATUS_MAP = {
  DR: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  CO: { label: 'Complete', className: 'bg-green-100 text-green-700' },
  VO: { label: 'Void', className: 'bg-red-100 text-red-700' },
  IP: { label: 'In Process', className: 'bg-yellow-100 text-yellow-700' },
};

export function StatusBadge({ status }) {
  const config = STATUS_MAP[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}
```

**Step 3: Verify app shell builds**

Run: `cd tools/app-shell && npx vite build 2>&1 | tail -5`
Expected: Build succeeds (components are tree-shaken but no syntax errors).

**Step 4: Commit**

```bash
git add tools/app-shell/src/components/ui/slide-panel.jsx tools/app-shell/src/components/ui/status-badge.jsx
git commit -m "feat: add SlidePanel and StatusBadge shell components for Holded-style UI"
```

---

### Task 2: Update Generators — Table, Form, Page (PARALLEL)

**Files:**
- Modify: `cli/src/generate-frontend.js`
- Modify: `cli/test/generate-frontend.test.js`

**Context:** Three generator functions need updating. The `useEntity` hook return signature is unchanged. Only JSX output changes. The existing shadcn components (`Table`, `Input`, `Label`, `Button`, `Separator`) are already available. Two new shell components are being created in Task 1: `SlidePanel` at `@/components/ui/slide-panel` and `StatusBadge` at `@/components/ui/status-badge`.

**Step 1: Update tests first**

Replace the content of `cli/test/generate-frontend.test.js` with:

```javascript
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  generateTableComponent,
  generateFormComponent,
  generatePageComponent,
  generateIndexComponent,
  generateAll,
} from '../src/generate-frontend.js';

const sampleContract = {
  frontendContract: {
    window: { id: '143', name: 'Sales Order', primaryEntity: 'order', category: 'sales' },
    entities: {
      order: {
        fields: [
          { name: 'documentNo', type: 'string', tsType: 'string', visibility: 'readOnly', required: true, grid: true, form: true },
          { name: 'businessPartner', type: 'string', tsType: 'string', visibility: 'editable', required: true, grid: true, form: true },
          { name: 'grandTotal', type: 'amount', tsType: 'number', visibility: 'readOnly', required: false, grid: true, form: true },
          { name: 'docStatus', type: 'string', tsType: 'string', visibility: 'readOnly', required: true, grid: true, form: true },
        ],
        searchableFields: ['documentNo', 'businessPartner', 'docStatus'],
        computedFields: [],
      },
      orderLine: {
        fields: [
          { name: 'product', type: 'string', tsType: 'string', visibility: 'editable', required: true, grid: true, form: true },
          { name: 'quantity', type: 'number', tsType: 'number', visibility: 'editable', required: true, grid: true, form: true },
          { name: 'lineNetAmount', type: 'amount', tsType: 'number', visibility: 'readOnly', required: false, grid: true, form: true },
        ],
        searchableFields: ['product'],
        computedFields: [],
      },
    },
  },
  backendContract: {
    processEndpoints: [
      { name: 'completeOrder', method: 'POST', path: '/process/completeOrder', entity: 'order', preconditions: [], steps: 6 },
      { name: 'voidOrder', method: 'POST', path: '/process/voidOrder', entity: 'order', preconditions: [], steps: 4 },
    ],
  },
};

describe('generateTableComponent', () => {
  it('generates valid JSX string with imports', () => {
    const code = generateTableComponent('order', sampleContract);
    assert.ok(code.includes('import'), 'should have imports');
    assert.ok(code.includes('export default function OrderTable'), 'should export OrderTable');
  });

  it('includes grid columns from contract fields', () => {
    const code = generateTableComponent('order', sampleContract);
    assert.ok(code.includes('documentNo'), 'should include documentNo column');
    assert.ok(code.includes('businessPartner'), 'should include businessPartner column');
    assert.ok(code.includes('grandTotal'), 'should include grandTotal column');
  });

  it('includes search filters for searchable fields', () => {
    const code = generateTableComponent('order', sampleContract);
    assert.ok(code.includes('Filter'), 'should have filter inputs');
  });

  it('renders status fields with StatusBadge', () => {
    const code = generateTableComponent('order', sampleContract);
    assert.ok(code.includes('StatusBadge'), 'should import and use StatusBadge');
    assert.ok(code.includes('status-badge'), 'should import from status-badge');
  });

  it('adds hover styling to rows', () => {
    const code = generateTableComponent('order', sampleContract);
    assert.ok(code.includes('hover:bg-gray-50'), 'should have hover effect on rows');
  });
});

describe('generateFormComponent', () => {
  it('generates valid JSX string', () => {
    const code = generateFormComponent('order', sampleContract);
    assert.ok(code.includes('export default function OrderForm'), 'should export OrderForm');
  });

  it('renders editable fields as inputs', () => {
    const code = generateFormComponent('order', sampleContract);
    assert.ok(code.includes('businessPartner'), 'should include editable businessPartner');
  });

  it('renders readOnly fields as disabled', () => {
    const code = generateFormComponent('order', sampleContract);
    assert.ok(code.includes('readOnly') || code.includes('disabled'), 'should mark readOnly fields');
  });

  it('includes process action buttons for matching entity', () => {
    const code = generateFormComponent('order', sampleContract);
    assert.ok(code.includes('completeOrder') || code.includes('Complete Order'), 'should include completeOrder button');
    assert.ok(code.includes('voidOrder') || code.includes('Void Order'), 'should include voidOrder button');
  });

  it('does not include process buttons for non-matching entity', () => {
    const code = generateFormComponent('orderLine', sampleContract);
    assert.ok(!code.includes('completeOrder'), 'should not include order processes in orderLine form');
  });

  it('uses single-column layout for panel width', () => {
    const code = generateFormComponent('order', sampleContract);
    assert.ok(!code.includes('grid-cols-2'), 'should not use 2-column grid (panel is narrow)');
    assert.ok(code.includes('space-y-3') || code.includes('space-y-4'), 'should use vertical stacking');
  });
});

describe('generatePageComponent', () => {
  it('generates page with SlidePanel', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes('export default function OrderPage'), 'should export OrderPage');
    assert.ok(code.includes('SlidePanel'), 'should use SlidePanel');
    assert.ok(code.includes('slide-panel'), 'should import from slide-panel');
  });

  it('imports useEntity from @/hooks/useEntity', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes("from '@/hooks/useEntity'"), 'should import useEntity');
  });

  it('calls useEntity with correct entity names', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes("useEntity('order', 'orderLine'"), 'should call useEntity with entity names');
  });

  it('does NOT contain inline useState or fetch', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(!code.includes('fetch('), 'should not have fetch calls');
  });

  it('passes hook properties to child components', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes('.items'), 'should pass items to table');
    assert.ok(code.includes('.editing'), 'should pass editing to form');
    assert.ok(code.includes('.handleSelect'), 'should pass handleSelect');
    assert.ok(code.includes('.handleChange'), 'should pass handleChange');
    assert.ok(code.includes('.handleSave'), 'should pass handleSave');
    assert.ok(code.includes('.handleProcess'), 'should pass handleProcess');
    assert.ok(code.includes('.children'), 'should pass children to detail table');
  });

  it('includes New button and close panel clears editing', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes('.handleNew'), 'should wire handleNew');
    assert.ok(code.includes('onClose'), 'should have onClose for panel');
  });

  it('puts form and detail table inside SlidePanel', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    const panelStart = code.indexOf('<SlidePanel');
    const panelEnd = code.indexOf('</SlidePanel>');
    const panelContent = code.slice(panelStart, panelEnd);
    assert.ok(panelContent.includes('Form'), 'form should be inside SlidePanel');
    assert.ok(panelContent.includes('Table'), 'detail table should be inside SlidePanel');
  });
});

describe('generateIndexComponent', () => {
  it('generates entry point with standard props', () => {
    const code = generateIndexComponent('order', 'orderLine');
    assert.ok(code.includes('token'), 'should accept token prop');
    assert.ok(code.includes('apiBaseUrl'), 'should accept apiBaseUrl prop');
    assert.ok(code.includes('window'), 'should accept window prop');
    assert.ok(code.includes('export default'), 'should have default export');
  });
});

describe('generateAll', () => {
  it('returns map of filename to code', () => {
    const files = generateAll(sampleContract);
    assert.ok(files['OrderTable.jsx'], 'should produce OrderTable.jsx');
    assert.ok(files['OrderForm.jsx'], 'should produce OrderForm.jsx');
    assert.ok(files['OrderLineTable.jsx'], 'should produce OrderLineTable.jsx');
    assert.ok(files['OrderPage.jsx'], 'should produce OrderPage.jsx');
    assert.ok(files['index.jsx'], 'should produce index.jsx');
  });

  it('handles single-entity contract without detail', () => {
    const singleEntity = {
      frontendContract: {
        window: { id: '1', name: 'Simple', primaryEntity: 'item', category: 'test' },
        entities: {
          item: {
            fields: [{ name: 'name', type: 'string', tsType: 'string', visibility: 'editable', required: true, grid: true, form: true }],
            searchableFields: ['name'],
            computedFields: [],
          },
        },
      },
      backendContract: { processEndpoints: [] },
    };
    const files = generateAll(singleEntity);
    assert.ok(files['ItemTable.jsx'], 'should produce ItemTable.jsx');
    assert.ok(files['ItemForm.jsx'], 'should produce ItemForm.jsx');
    assert.ok(files['index.jsx'], 'should produce index.jsx');
  });
});
```

**Step 2: Run tests to verify new tests fail**

Run: `cd cli && node --test test/generate-frontend.test.js 2>&1 | tail -15`
Expected: New tests fail (StatusBadge, hover, SlidePanel, single-column).

**Step 3: Update generateTableComponent**

Replace `generateTableComponent` in `cli/src/generate-frontend.js` (starts at line 34):

```javascript
export function generateTableComponent(entityName, contract) {
  const entity = contract.frontendContract.entities[entityName];
  const gridFields = entity.fields.filter(f => f.grid);
  const searchableFields = entity.searchableFields ?? [];
  const compName = `${capitalize(entityName)}Table`;

  const hasStatusField = gridFields.some(f => f.name.toLowerCase().includes('status'));

  const imports = [
    `import React, { useState } from 'react';`,
    `import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';`,
    `import { Input } from '@/components/ui/input';`,
  ];
  if (hasStatusField) {
    imports.push(`import { StatusBadge } from '@/components/ui/status-badge';`);
  }

  const filterState = searchableFields
    .map(f => `  const [filter${capitalize(f)}, setFilter${capitalize(f)}] = useState('');`)
    .join('\n');

  const filterInputs = searchableFields
    .map(f => `        <Input
          placeholder="Filter ${toLabel(f)}..."
          value={filter${capitalize(f)}}
          onChange={(e) => setFilter${capitalize(f)}(e.target.value)}
          className="max-w-xs"
        />`)
    .join('\n');

  const headerCells = gridFields
    .map(f => `            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">${toLabel(f.name)}</TableHead>`)
    .join('\n');

  const bodyCells = gridFields
    .map(f => {
      if (f.name.toLowerCase().includes('status')) {
        return `            <TableCell><StatusBadge status={row.${f.name}} /></TableCell>`;
      }
      if (f.type === 'amount') {
        return `            <TableCell className="tabular-nums">{row.${f.name}?.toLocaleString()}</TableCell>`;
      }
      return `            <TableCell>{row.${f.name}}</TableCell>`;
    })
    .join('\n');

  return `${imports.join('\n')}

export default function ${compName}({ data = [], onRowSelect }) {
${filterState}

  const filteredData = data.filter(row => {
${searchableFields.map(f => `    if (filter${capitalize(f)} && !String(row.${f} ?? '').toLowerCase().includes(filter${capitalize(f)}.toLowerCase())) return false;`).join('\n')}
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
${filterInputs}
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-gray-100">
${headerCells}
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-50">
          {filteredData.map((row, idx) => (
            <TableRow key={row.id ?? idx} onClick={() => onRowSelect?.(row)} className="cursor-pointer hover:bg-gray-50 transition-colors">
${bodyCells}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
`;
}
```

**Step 4: Update generateFormComponent**

Replace `generateFormComponent` in `cli/src/generate-frontend.js` (starts at line 114):

```javascript
export function generateFormComponent(entityName, contract) {
  const entity = contract.frontendContract.entities[entityName];
  const formFields = entity.fields.filter(f => f.form);
  const processes = getProcessesForEntity(contract, entityName);
  const compName = `${capitalize(entityName)}Form`;

  const imports = [
    `import React from 'react';`,
    `import { Input } from '@/components/ui/input';`,
    `import { Label } from '@/components/ui/label';`,
    `import { Button } from '@/components/ui/button';`,
    `import { Separator } from '@/components/ui/separator';`,
  ];

  const fieldElements = formFields.map(f => {
    const label = toLabel(f.name);
    const isReadOnly = f.visibility === 'readOnly';
    const inputType = f.tsType === 'number' ? 'number' : 'text';
    const disabledAttr = isReadOnly ? ' disabled readOnly className="bg-gray-50 text-gray-500"' : '';
    const requiredAttr = f.required ? ' required' : '';

    return `        <div className="space-y-1.5">
          <Label htmlFor="${f.name}" className="text-sm text-gray-600">${label}${f.required ? ' *' : ''}</Label>
          <Input
            id="${f.name}"
            name="${f.name}"
            type="${inputType}"
            value={data?.${f.name} ?? ''}
            onChange={(e) => onChange?.('${f.name}', e.target.value)}${disabledAttr}${requiredAttr}
          />
        </div>`;
  }).join('\n');

  const processButtons = processes.map(p => {
    const label = toLabel(p.name);
    return `          <Button variant="outline" size="sm" onClick={() => onProcess?.('${p.name}')}>
            ${label}
          </Button>`;
  }).join('\n');

  const processSection = processes.length > 0
    ? `\n      <Separator className="my-4" />\n      <div className="flex gap-2">\n${processButtons}\n      </div>`
    : '';

  return `${imports.join('\n')}

export default function ${compName}({ data, onChange, onSave, onDelete, onProcess }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave?.(data); }} className="space-y-3">
      <div className="space-y-3">
${fieldElements}
      </div>
      <Separator className="my-4" />
      <div className="flex gap-2">
        <Button type="submit" size="sm">Save</Button>
        {onDelete && <Button variant="outline" size="sm" onClick={(e) => { e.preventDefault(); onDelete(); }}>Delete</Button>}
      </div>${processSection}
    </form>
  );
}
`;
}
```

**Step 5: Update generatePageComponent**

Replace `generatePageComponent` in `cli/src/generate-frontend.js` (starts at line 180):

```javascript
export function generatePageComponent(headerEntity, detailEntity, contract) {
  const headerName = capitalize(headerEntity);
  const detailName = capitalize(detailEntity);
  const compName = `${headerName}Page`;

  return `import React from 'react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { SlidePanel } from '@/components/ui/slide-panel';
import { useEntity } from '@/hooks/useEntity';
import ${headerName}Table from './${headerName}Table';
import ${headerName}Form from './${headerName}Form';
import ${detailName}Table from './${detailName}Table';

export default function ${compName}({ token, apiBaseUrl }) {
  const ${headerEntity} = useEntity('${headerEntity}', '${detailEntity}', { token, apiBaseUrl });

  const panelTitle = ${headerEntity}.editing?.id
    ? \`${toLabel(headerEntity)} \${${headerEntity}.editing.documentNo || ${headerEntity}.editing.id}\`
    : 'New ${toLabel(headerEntity)}';

  const handleClose = () => {
    ${headerEntity}.handleSelect(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">${toLabel(headerEntity)}s</h2>
        <Button onClick={${headerEntity}.handleNew}>New</Button>
      </div>
      <${headerName}Table data={${headerEntity}.items} onRowSelect={${headerEntity}.handleSelect} />
      <SlidePanel
        open={!!${headerEntity}.editing}
        onClose={handleClose}
        title={panelTitle}
      >
        <${headerName}Form
          data={${headerEntity}.editing}
          onChange={${headerEntity}.handleChange}
          onSave={${headerEntity}.handleSave}
          onDelete={${headerEntity}.selected ? ${headerEntity}.handleDelete : undefined}
          onProcess={${headerEntity}.handleProcess}
        />
        <Separator className="my-6" />
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">${toLabel(detailEntity)}s</h3>
        <${detailName}Table data={${headerEntity}.children} />
      </SlidePanel>
    </div>
  );
}
`;
}
```

**Step 6: Run tests to verify they pass**

Run: `cd cli && node --test test/generate-frontend.test.js 2>&1 | tail -15`
Expected: ALL tests pass.

**Step 7: Commit**

```bash
git add cli/src/generate-frontend.js cli/test/generate-frontend.test.js
git commit -m "feat: update generators for Holded-style UI (SlidePanel, StatusBadge, clean table)"
```

---

### Task 3: Regenerate Sales Order + Verify in Browser (SEQUENTIAL — depends on Tasks 1+2)

**Files:**
- Overwrite: `artifacts/sales-order/generated/web/sales-order/*.jsx` (all generated files)

**Context:** Tasks 1 and 2 must be complete first. The generator now produces Holded-style components that import `SlidePanel` and `StatusBadge` from the shell. Regenerating rewrites all JSX files in the sales-order output directory.

**Step 1: Regenerate components**

Run: `node cli/src/generate-frontend.js artifacts/sales-order/contract.json`
Expected: Output shows 6 files written.

**Step 2: Verify OrderPage.jsx uses SlidePanel**

Run: `head -20 artifacts/sales-order/generated/web/sales-order/OrderPage.jsx`
Expected: Imports `SlidePanel` from `@/components/ui/slide-panel` and `useEntity` from `@/hooks/useEntity`.

**Step 3: Verify OrderTable.jsx uses StatusBadge**

Run: `grep -n 'StatusBadge' artifacts/sales-order/generated/web/sales-order/OrderTable.jsx`
Expected: Import line and usage for docStatus column.

**Step 4: Verify app shell builds**

Run: `cd tools/app-shell && npx vite build 2>&1 | tail -5`
Expected: Build succeeds with no errors.

**Step 5: Run all CLI tests**

Run: `cd cli && node --test 'test/*.test.js' 2>&1 | tail -15`
Expected: All tests pass, 0 failures.

**Step 6: Commit**

```bash
git add artifacts/sales-order/generated/web/sales-order/
git commit -m "feat: regenerate Sales Order with Holded-style UI"
```
