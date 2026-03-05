# Frontend Code Generator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI tool that reads a contract.json and generates React components (table, form, header-detail page) that mount in the app shell, plus Shadcn UI components the generated code depends on.

**Architecture:** `generate-frontend.js` reads the contract's `frontendContract` and `backendContract`, then produces per-entity Table, Form, and Page components using Shadcn/ui + Tailwind. A fixture `contract.json` for Sales Order enables development without a real Etendo instance. The app shell gets new Shadcn components (table, dialog, badge, select, label, separator) that generated code imports.

**Tech Stack:** Node.js 22 ESM, React 18, Shadcn/ui, Tailwind CSS, node:test, node:assert

---

## Task 1: Create Sales Order Contract Fixture

**Files:**
- Create: `artifacts/sales-order/contract.json`

**Step 1: Create the fixture**

```json
{
  "version": "0.1.0",
  "generatedAt": "2026-03-05T00:00:00.000Z",
  "checksum": "fixture-dev-only",
  "frontendContract": {
    "window": { "id": "143", "name": "Sales Order", "primaryEntity": "order", "category": "sales" },
    "entities": {
      "order": {
        "fields": [
          { "name": "documentNo", "column": "DocumentNo", "type": "string", "tsType": "string", "visibility": "readOnly", "required": true, "grid": true, "form": true },
          { "name": "businessPartner", "column": "C_BPartner_ID", "type": "string", "tsType": "string", "visibility": "editable", "required": true, "grid": true, "form": true },
          { "name": "orderDate", "column": "DateOrdered", "type": "date", "tsType": "string", "visibility": "editable", "required": true, "grid": true, "form": true },
          { "name": "warehouse", "column": "M_Warehouse_ID", "type": "string", "tsType": "string", "visibility": "editable", "required": true, "grid": false, "form": true },
          { "name": "currency", "column": "C_Currency_ID", "type": "string", "tsType": "string", "visibility": "readOnly", "required": true, "grid": true, "form": true },
          { "name": "paymentTerms", "column": "C_PaymentTerm_ID", "type": "string", "tsType": "string", "visibility": "editable", "required": false, "grid": false, "form": true },
          { "name": "description", "column": "Description", "type": "string", "tsType": "string", "visibility": "editable", "required": false, "grid": false, "form": true },
          { "name": "totalLines", "column": "TotalLines", "type": "amount", "tsType": "number", "visibility": "readOnly", "required": false, "grid": true, "form": true },
          { "name": "grandTotal", "column": "GrandTotal", "type": "amount", "tsType": "number", "visibility": "readOnly", "required": false, "grid": true, "form": true },
          { "name": "docStatus", "column": "DocStatus", "type": "string", "tsType": "string", "visibility": "readOnly", "required": true, "grid": true, "form": true },
          { "name": "deliveryLocation", "column": "DeliveryLocation", "type": "string", "tsType": "string", "visibility": "editable", "required": false, "grid": false, "form": true },
          { "name": "invoiceAddress", "column": "BillTo_ID", "type": "string", "tsType": "string", "visibility": "editable", "required": false, "grid": false, "form": true }
        ],
        "searchableFields": ["documentNo", "businessPartner", "docStatus"],
        "computedFields": []
      },
      "orderLine": {
        "fields": [
          { "name": "lineNo", "column": "Line", "type": "integer", "tsType": "number", "visibility": "readOnly", "required": true, "grid": true, "form": true },
          { "name": "product", "column": "M_Product_ID", "type": "string", "tsType": "string", "visibility": "editable", "required": true, "grid": true, "form": true },
          { "name": "quantity", "column": "QtyOrdered", "type": "number", "tsType": "number", "visibility": "editable", "required": true, "grid": true, "form": true },
          { "name": "unitPrice", "column": "PriceActual", "type": "amount", "tsType": "number", "visibility": "editable", "required": true, "grid": true, "form": true },
          { "name": "discount", "column": "Discount", "type": "number", "tsType": "number", "visibility": "editable", "required": false, "grid": true, "form": true },
          { "name": "lineNetAmount", "column": "LineNetAmt", "type": "amount", "tsType": "number", "visibility": "readOnly", "required": false, "grid": true, "form": true },
          { "name": "tax", "column": "C_Tax_ID", "type": "string", "tsType": "string", "visibility": "editable", "required": false, "grid": true, "form": true },
          { "name": "description", "column": "Description", "type": "string", "tsType": "string", "visibility": "editable", "required": false, "grid": false, "form": true }
        ],
        "searchableFields": ["product"],
        "computedFields": []
      }
    }
  },
  "backendContract": {
    "window": { "id": "143", "name": "Sales Order", "primaryEntity": "order", "category": "sales" },
    "entities": {
      "order": {
        "fields": [
          { "name": "documentNo", "column": "DocumentNo", "type": "string", "visibility": "readOnly", "required": true },
          { "name": "businessPartner", "column": "C_BPartner_ID", "type": "string", "visibility": "editable", "required": true },
          { "name": "orderDate", "column": "DateOrdered", "type": "date", "visibility": "editable", "required": true },
          { "name": "warehouse", "column": "M_Warehouse_ID", "type": "string", "visibility": "editable", "required": true },
          { "name": "currency", "column": "C_Currency_ID", "type": "string", "visibility": "readOnly", "required": true },
          { "name": "paymentTerms", "column": "C_PaymentTerm_ID", "type": "string", "visibility": "editable", "required": false },
          { "name": "description", "column": "Description", "type": "string", "visibility": "editable", "required": false },
          { "name": "totalLines", "column": "TotalLines", "type": "amount", "visibility": "readOnly", "required": false },
          { "name": "grandTotal", "column": "GrandTotal", "type": "amount", "visibility": "readOnly", "required": false },
          { "name": "docStatus", "column": "DocStatus", "type": "string", "visibility": "readOnly", "required": true },
          { "name": "deliveryLocation", "column": "DeliveryLocation", "type": "string", "visibility": "editable", "required": false },
          { "name": "invoiceAddress", "column": "BillTo_ID", "type": "string", "visibility": "editable", "required": false },
          { "name": "adClientId", "column": "AD_Client_ID", "type": "id", "visibility": "system", "required": true },
          { "name": "adOrgId", "column": "AD_Org_ID", "type": "id", "visibility": "system", "required": true },
          { "name": "created", "column": "Created", "type": "datetime", "visibility": "system", "required": true },
          { "name": "updated", "column": "Updated", "type": "datetime", "visibility": "system", "required": true }
        ]
      },
      "orderLine": {
        "fields": [
          { "name": "lineNo", "column": "Line", "type": "integer", "visibility": "readOnly", "required": true },
          { "name": "product", "column": "M_Product_ID", "type": "string", "visibility": "editable", "required": true },
          { "name": "quantity", "column": "QtyOrdered", "type": "number", "visibility": "editable", "required": true },
          { "name": "unitPrice", "column": "PriceActual", "type": "amount", "visibility": "editable", "required": true },
          { "name": "discount", "column": "Discount", "type": "number", "visibility": "editable", "required": false },
          { "name": "lineNetAmount", "column": "LineNetAmt", "type": "amount", "visibility": "readOnly", "required": false },
          { "name": "tax", "column": "C_Tax_ID", "type": "string", "visibility": "editable", "required": false },
          { "name": "description", "column": "Description", "type": "string", "visibility": "editable", "required": false },
          { "name": "adClientId", "column": "AD_Client_ID", "type": "id", "visibility": "system", "required": true },
          { "name": "adOrgId", "column": "AD_Org_ID", "type": "id", "visibility": "system", "required": true }
        ]
      }
    },
    "endpoints": [
      { "method": "GET", "path": "/order", "entity": "order", "supportedFilters": ["documentNo", "businessPartner", "docStatus"] },
      { "method": "GET", "path": "/order/:id", "entity": "order", "supportedFilters": [] },
      { "method": "POST", "path": "/order", "entity": "order", "supportedFilters": [] },
      { "method": "PUT", "path": "/order/:id", "entity": "order", "supportedFilters": [] },
      { "method": "DELETE", "path": "/order/:id", "entity": "order", "supportedFilters": [] },
      { "method": "GET", "path": "/orderLine", "entity": "orderLine", "supportedFilters": ["product"] },
      { "method": "GET", "path": "/orderLine/:id", "entity": "orderLine", "supportedFilters": [] },
      { "method": "POST", "path": "/orderLine", "entity": "orderLine", "supportedFilters": [] },
      { "method": "PUT", "path": "/orderLine/:id", "entity": "orderLine", "supportedFilters": [] },
      { "method": "DELETE", "path": "/orderLine/:id", "entity": "orderLine", "supportedFilters": [] }
    ],
    "processEndpoints": [
      { "name": "completeOrder", "method": "POST", "path": "/process/completeOrder", "entity": "order", "preconditions": ["Order must have at least one line", "Order status must be DR or IP"], "steps": 6 },
      { "name": "voidOrder", "method": "POST", "path": "/process/voidOrder", "entity": "order", "preconditions": ["Order status must be CO"], "steps": 4 }
    ]
  }
}
```

**Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('artifacts/sales-order/contract.json', 'utf8')); console.log('Valid JSON')"`
Expected: `Valid JSON`

**Step 3: Commit**

```bash
git add artifacts/sales-order/contract.json
git commit -m "feat: add sales order contract fixture for frontend generator development"
```

---

## Task 2: Add Shadcn UI Components to App Shell

**Files:**
- Create: `tools/app-shell/src/components/ui/table.jsx`
- Create: `tools/app-shell/src/components/ui/badge.jsx`
- Create: `tools/app-shell/src/components/ui/label.jsx`
- Create: `tools/app-shell/src/components/ui/separator.jsx`
- Create: `tools/app-shell/src/components/ui/select.jsx`
- Create: `tools/app-shell/src/components/ui/dialog.jsx`

**Step 1: Create table.jsx**

```jsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const Table = React.forwardRef(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)} {...props} />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef(({ className, ...props }, ref) => (
  <th ref={ref} className={cn('h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]', className)} {...props} />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]', className)} {...props} />
));
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
```

**Step 2: Create badge.jsx**

```jsx
import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

**Step 3: Create label.jsx**

```jsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
    {...props}
  />
));
Label.displayName = 'Label';

export { Label };
```

**Step 4: Create separator.jsx**

```jsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const Separator = React.forwardRef(({ className, orientation = 'horizontal', ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    className={cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
      className
    )}
    {...props}
  />
));
Separator.displayName = 'Separator';

export { Separator };
```

**Step 5: Create select.jsx**

```jsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const Select = React.forwardRef(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export { Select };
```

**Step 6: Create dialog.jsx**

```jsx
import * as React from 'react';
import { cn } from '@/lib/utils';

function Dialog({ open, onOpenChange, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/80" onClick={() => onOpenChange?.(false)} />
      <div className="relative z-50">{children}</div>
    </div>
  );
}

const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg',
      className
    )}
    {...props}
  >
    {children}
  </div>
));
DialogContent.displayName = 'DialogContent';

function DialogHeader({ className, ...props }) {
  return <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />;
}

function DialogTitle({ className, ...props }) {
  return <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />;
}

function DialogFooter({ className, ...props }) {
  return <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />;
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter };
```

**Step 7: Verify build**

Run: `cd tools/app-shell && npm run build`
Expected: PASS

**Step 8: Commit**

```bash
git add tools/app-shell/src/components/ui/
git commit -m "feat: add Shadcn table, badge, label, separator, select, dialog components"
```

---

## Task 3: Generate-Frontend CLI — Core Generator with Tests

**Files:**
- Create: `cli/src/generate-frontend.js`
- Create: `cli/test/generate-frontend.test.js`

**Step 1: Write the failing test**

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
    assert.ok(code.includes('documentNo'), 'should filter by documentNo');
    assert.ok(code.includes('businessPartner'), 'should filter by businessPartner');
  });

  it('skips fields not marked for grid', () => {
    const contract = {
      ...sampleContract,
      frontendContract: {
        ...sampleContract.frontendContract,
        entities: {
          test: {
            fields: [
              { name: 'shown', type: 'string', tsType: 'string', visibility: 'editable', required: false, grid: true, form: true },
              { name: 'hidden', type: 'string', tsType: 'string', visibility: 'editable', required: false, grid: false, form: true },
            ],
            searchableFields: [],
            computedFields: [],
          },
        },
      },
    };
    const code = generateTableComponent('test', contract);
    assert.ok(code.includes('shown'), 'should include grid:true field');
    // The table header should reference 'shown' but not 'hidden' as a column header
    const headerSection = code.split('TableHead').join('');
    // hidden should not appear as a table column
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

  it('renders readOnly fields as disabled or display', () => {
    const code = generateFormComponent('order', sampleContract);
    assert.ok(code.includes('documentNo'), 'should include readOnly documentNo');
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
});

describe('generatePageComponent', () => {
  it('generates header-detail layout', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes('export default function OrderPage'), 'should export OrderPage');
    assert.ok(code.includes('OrderTable'), 'should include header table');
    assert.ok(code.includes('OrderForm'), 'should include header form');
    assert.ok(code.includes('OrderLineTable'), 'should include detail table');
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
    // No Page component for single entity — index just renders table + form
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test cli/test/generate-frontend.test.js`
Expected: FAIL — module not found

**Step 3: Implement generate-frontend.js**

```javascript
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toLabel(name) {
  return name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

function getProcessesForEntity(contract, entityName) {
  return (contract.backendContract?.processEndpoints || [])
    .filter(p => p.entity === entityName);
}

export function generateTableComponent(entityName, contract) {
  const entity = contract.frontendContract.entities[entityName];
  const gridFields = entity.fields.filter(f => f.grid);
  const searchFields = entity.searchableFields || [];
  const name = capitalize(entityName);

  return `import { useState } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';

export default function ${name}Table({ data = [], onSelect, onRefresh, loading }) {
  const [filters, setFilters] = useState({${searchFields.map(f => ` ${f}: ''`).join(',')} });

  const filtered = data.filter(row => {
${searchFields.map(f => `    if (filters.${f} && !String(row.${f} ?? '').toLowerCase().includes(filters.${f}.toLowerCase())) return false;`).join('\n')}
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
${searchFields.map(f => `        <Input
          placeholder="Filter ${toLabel(f)}..."
          value={filters.${f}}
          onChange={e => setFilters(prev => ({ ...prev, ${f}: e.target.value }))}
          className="max-w-xs"
        />`).join('\n')}
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
${gridFields.map(f => `            <TableHead>${toLabel(f.name)}</TableHead>`).join('\n')}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((row, i) => (
            <TableRow key={row.id || i} onClick={() => onSelect?.(row)} className="cursor-pointer">
${gridFields.map(f => {
    if (f.name === 'docStatus') {
      return `              <TableCell><Badge variant={row.docStatus === 'CO' ? 'default' : row.docStatus === 'VO' ? 'destructive' : 'secondary'}>{row.docStatus}</Badge></TableCell>`;
    }
    if (f.tsType === 'number') {
      return `              <TableCell className="text-right">{row.${f.name}}</TableCell>`;
    }
    return `              <TableCell>{row.${f.name}}</TableCell>`;
  }).join('\n')}
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={${gridFields.length}} className="text-center text-muted-foreground py-8">
                {loading ? 'Loading...' : 'No records found'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
`;
}

export function generateFormComponent(entityName, contract) {
  const entity = contract.frontendContract.entities[entityName];
  const formFields = entity.fields.filter(f => f.form);
  const processes = getProcessesForEntity(contract, entityName);
  const name = capitalize(entityName);

  return `import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Badge } from '@/components/ui/badge.jsx';

export default function ${name}Form({ record, onSave, onProcessAction, loading }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (record) setForm({ ...record });
  }, [record]);

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave?.(form);
  }

  if (!record) {
    return <div className="text-muted-foreground py-8 text-center">Select a record to view details</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
${processes.length > 0 ? `      <div className="flex items-center gap-2">
${processes.map(p => `        <Button type="button" variant="outline" size="sm" onClick={() => onProcessAction?.('${p.name}', record)} disabled={loading}>
          ${toLabel(p.name)}
        </Button>`).join('\n')}
      </div>
      <Separator />` : ''}
      <div className="grid grid-cols-2 gap-4">
${formFields.map(f => {
    const readOnly = f.visibility === 'readOnly';
    return `        <div className="space-y-2">
          <Label htmlFor="${f.name}">${toLabel(f.name)}${f.required ? ' *' : ''}</Label>
          <Input
            id="${f.name}"
            value={form.${f.name} ?? ''}
            onChange={e => handleChange('${f.name}', e.target.value)}
            ${readOnly ? 'readOnly' : ''}
            ${f.required ? 'required' : ''}
            ${readOnly ? 'className="bg-muted"' : ''}
          />
        </div>`;
  }).join('\n')}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
`;
}

export function generatePageComponent(headerEntity, detailEntity, contract) {
  const headerName = capitalize(headerEntity);
  const detailName = capitalize(detailEntity);

  return `import { useState, useCallback } from 'react';
import ${headerName}Table from './${headerName}Table.jsx';
import ${headerName}Form from './${headerName}Form.jsx';
import ${detailName}Table from './${detailName}Table.jsx';
import { Separator } from '@/components/ui/separator.jsx';

export default function ${headerName}Page({ token, apiBaseUrl, window: windowConfig }) {
  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detailRecords, setDetailRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  const headers = { 'Authorization': \`Bearer \${token}\`, 'Content-Type': 'application/json' };

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(\`\${apiBaseUrl}/v1/${headerEntity}\`, { headers });
      if (res.ok) setRecords(await res.json());
    } catch (err) {
      console.error('Failed to fetch ${headerEntity}:', err);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, token]);

  const fetchDetail = useCallback(async (parentId) => {
    try {
      const res = await fetch(\`\${apiBaseUrl}/v1/${detailEntity}?parentId=\${parentId}\`, { headers });
      if (res.ok) setDetailRecords(await res.json());
    } catch (err) {
      console.error('Failed to fetch ${detailEntity}:', err);
    }
  }, [apiBaseUrl, token]);

  function handleSelect(record) {
    setSelected(record);
    if (record?.id) fetchDetail(record.id);
  }

  async function handleSave(data) {
    setLoading(true);
    try {
      const method = data.id ? 'PUT' : 'POST';
      const path = data.id ? \`\${apiBaseUrl}/v1/${headerEntity}/\${data.id}\` : \`\${apiBaseUrl}/v1/${headerEntity}\`;
      const res = await fetch(path, { method, headers, body: JSON.stringify(data) });
      if (res.ok) {
        await fetchRecords();
        const saved = await res.json();
        setSelected(saved);
      }
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleProcessAction(processName, record) {
    setLoading(true);
    try {
      const res = await fetch(\`\${apiBaseUrl}/v1/process/\${processName}\`, {
        method: 'POST', headers, body: JSON.stringify({ id: record.id }),
      });
      if (res.ok) {
        await fetchRecords();
        const updated = await fetch(\`\${apiBaseUrl}/v1/${headerEntity}/\${record.id}\`, { headers });
        if (updated.ok) setSelected(await updated.json());
      }
    } catch (err) {
      console.error(\`Process \${processName} failed:\`, err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <${headerName}Table data={records} onSelect={handleSelect} onRefresh={fetchRecords} loading={loading} />
      <Separator />
      <${headerName}Form record={selected} onSave={handleSave} onProcessAction={handleProcessAction} loading={loading} />
      {selected && (
        <>
          <Separator />
          <h3 className="text-sm font-medium text-muted-foreground">${detailName} Lines</h3>
          <${detailName}Table data={detailRecords} loading={loading} />
        </>
      )}
    </div>
  );
}
`;
}

export function generateIndexComponent(headerEntity, detailEntity) {
  const headerName = capitalize(headerEntity);

  if (detailEntity) {
    return `import ${headerName}Page from './${headerName}Page.jsx';

export default function SalesOrderWindow({ token, apiBaseUrl, window }) {
  return <${headerName}Page token={token} apiBaseUrl={apiBaseUrl} window={window} />;
}
`;
  }

  return `import { useState, useCallback } from 'react';
import ${headerName}Table from './${headerName}Table.jsx';
import ${headerName}Form from './${headerName}Form.jsx';
import { Separator } from '@/components/ui/separator.jsx';

export default function ${headerName}Window({ token, apiBaseUrl, window: windowConfig }) {
  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const headers = { 'Authorization': \`Bearer \${token}\`, 'Content-Type': 'application/json' };

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(\`\${apiBaseUrl}/v1/${headerEntity}\`, { headers });
      if (res.ok) setRecords(await res.json());
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, token]);

  return (
    <div className="space-y-6">
      <${headerName}Table data={records} onSelect={setSelected} onRefresh={fetchRecords} loading={loading} />
      <Separator />
      <${headerName}Form record={selected} loading={loading} />
    </div>
  );
}
`;
}

export function generateAll(contract) {
  const fc = contract.frontendContract;
  const entityNames = Object.keys(fc.entities);
  const files = {};

  // Determine header and detail entities
  const primaryEntity = fc.window.primaryEntity || entityNames[0];
  const detailEntity = entityNames.find(e => e !== primaryEntity);

  // Generate table + form for each entity
  for (const name of entityNames) {
    const capName = capitalize(name);
    files[\`\${capName}Table.jsx\`] = generateTableComponent(name, contract);
    files[\`\${capName}Form.jsx\`] = generateFormComponent(name, contract);
  }

  // Generate page if header-detail pattern exists
  if (detailEntity) {
    files[\`\${capitalize(primaryEntity)}Page.jsx\`] = generatePageComponent(primaryEntity, detailEntity, contract);
  }

  // Generate index entry point
  files['index.jsx'] = generateIndexComponent(primaryEntity, detailEntity);

  return files;
}

// CLI entry point
const contractPath = process.argv[2];
if (contractPath) {
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  const windowName = contract.frontendContract.window.name.toLowerCase().replace(/\s+/g, '-');
  const outDir = join(dirname(contractPath), 'generated', 'web', windowName);
  mkdirSync(outDir, { recursive: true });

  const files = generateAll(contract);
  for (const [filename, code] of Object.entries(files)) {
    writeFileSync(join(outDir, filename), code);
  }
  console.log(\`Generated \${Object.keys(files).length} files in \${outDir}\`);
}
```

**Step 4: Run tests**

Run: `node --test cli/test/generate-frontend.test.js`
Expected: All PASS

**Step 5: Commit**

```bash
git add cli/src/generate-frontend.js cli/test/generate-frontend.test.js
git commit -m "feat: add frontend code generator with table, form, page, and index components"
```

---

## Task 4: Run Generator Against Contract Fixture

**Step 1: Generate components**

Run: `node cli/src/generate-frontend.js artifacts/sales-order/contract.json`
Expected: `Generated 5 files in artifacts/sales-order/generated/web/sales-order`

**Step 2: Verify output files exist**

Run: `ls artifacts/sales-order/generated/web/sales-order/`
Expected:
```
OrderTable.jsx
OrderForm.jsx
OrderLineTable.jsx
OrderPage.jsx
index.jsx
```

**Step 3: Verify generated code is valid JSX (build test)**

Run: `cd tools/app-shell && npm run build`
Expected: PASS (generated files are outside the app-shell src, so this just confirms shell still builds)

**Step 4: Commit generated output**

```bash
git add artifacts/sales-order/generated/
git commit -m "feat: generate Sales Order frontend components from contract fixture"
```

---

## Task 5: Update generate-ui Skill for Shadcn/Tailwind

**Files:**
- Modify: `.claude/skills/generate-ui.md`

**Step 1: Rewrite the skill**

Replace the full content of `.claude/skills/generate-ui.md` with:

```markdown
---
name: generate-ui
description: Generate or customize React UI components from curated schema using Shadcn/ui + Tailwind
---

## Automatic Generation (start here)

Run the generator first to produce the base components:

\`\`\`bash
node cli/src/generate-frontend.js artifacts/{window}/contract.json
\`\`\`

This produces Table, Form, Page, and index components at:
`artifacts/{window}/generated/web/{window}/`

## Customization (conversational)

After running the generator, ask the user what they want to customize:
- Layout changes (column order, field grouping, responsive breakpoints)
- Custom logic (conditional field rendering, computed displays)
- Visual tweaks (status badges, color coding, icons)

Read the generated files and modify them based on user requests.

## SCHEMA CONSTRAINTS (INVIOLABLE)

- Only render fields with visibility: editable or readOnly
- System fields NEVER appear in UI
- ReadOnly fields render as non-editable (readOnly or disabled inputs with bg-muted)
- Computed fields are never editable
- Only searchable fields can be used as filters/search
- CascadeFrom relationships must be respected (cascading dropdowns)
- Never invent fields not in schema

## UI LIBRARY RULES

- Use Shadcn/ui components from `@/components/ui/` (button, input, card, table, badge, label, select, dialog, separator)
- Use Tailwind CSS for layout and spacing — NO inline styles
- Use `cn()` from `@/lib/utils` for conditional classes
- Use `lucide-react` for icons

## Component Props Contract

Generated components MUST accept these props from the app shell:

\`\`\`jsx
export default function WindowName({ token, apiBaseUrl, window }) {
  // token: JWT string for Authorization header
  // apiBaseUrl: base URL for API calls (e.g., '/etendo/api')
  // window: { name, label, entityConfig } from contract
}
\`\`\`

When making API calls, use:
\`\`\`javascript
const res = await fetch(\`\${apiBaseUrl}/v1/\${window.name}\`, {
  headers: { 'Authorization': \`Bearer \${token}\` },
});
\`\`\`

NEVER hardcode API URLs or tokens. Always use the props.

## Output Location

Write generated/modified components to:
`artifacts/{window}/generated/web/{window}/`

After generating, tell the user to preview with: `cd tools/app-shell && npm run dev`
```

**Step 2: Commit**

```bash
git add .claude/skills/generate-ui.md
git commit -m "feat: update generate-ui skill for Shadcn/Tailwind and auto-generator integration"
```

---

## Task 6: Run All Tests — Full Regression

**Step 1: Run CLI tests**

Run: `node --test 'cli/test/*.test.js'`
Expected: All PASS (234+ tests)

**Step 2: Run app shell tests**

Run: `node --test 'tools/app-shell/src/**/__tests__/*.test.js'`
Expected: All PASS (11 tests)

**Step 3: Run frontend generator tests**

Run: `node --test cli/test/generate-frontend.test.js`
Expected: All PASS

**Step 4: Build app shell**

Run: `cd tools/app-shell && npm run build`
Expected: PASS

---

## Summary

| Task | What | Files | Tests |
|------|------|-------|-------|
| 1 | Contract fixture | 1 JSON | — |
| 2 | Shadcn components | 6 JSX | build check |
| 3 | Generator CLI + tests | 2 JS | ~15 tests |
| 4 | Run generator | 5 generated JSX | build check |
| 5 | Update generate-ui skill | 1 MD | — |
| 6 | Full regression | — | 250+ tests |
