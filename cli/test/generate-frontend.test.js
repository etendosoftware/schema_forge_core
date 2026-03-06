import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  generateTableComponent,
  generateFormComponent,
  generatePageComponent,
  generateIndexComponent,
  generateAll,
  getReadOnlyFields,
  generateMockCatalogs,
} from '../src/generate-frontend.js';

const sampleContract = {
  frontendContract: {
    window: { id: '143', name: 'Sales Order', primaryEntity: 'order', category: 'sales' },
    entities: {
      order: {
        fields: [
          { name: 'documentNo', type: 'string', tsType: 'string', visibility: 'readOnly', required: true, grid: true, form: true },
          { name: 'businessPartner', type: 'foreignKey', tsType: 'string', visibility: 'editable', required: true, grid: true, form: true, reference: 'BusinessPartner', inputMode: 'search' },
          { name: 'partnerAddress', type: 'foreignKey', tsType: 'string', visibility: 'editable', required: true, grid: false, form: true, reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'businessPartnerId' } },
          { name: 'warehouse', type: 'foreignKey', tsType: 'string', visibility: 'editable', required: true, grid: false, form: true, reference: 'Warehouse', inputMode: 'selector' },
          { name: 'priceList', type: 'foreignKey', tsType: 'string', visibility: 'editable', required: true, grid: false, form: true, reference: 'PriceList', inputMode: 'selector' },
          { name: 'grandTotal', type: 'amount', tsType: 'number', visibility: 'readOnly', required: false, grid: true, form: true },
          { name: 'docStatus', type: 'string', tsType: 'string', visibility: 'readOnly', required: true, grid: true, form: true },
        ],
        searchableFields: ['documentNo', 'businessPartner', 'docStatus'],
        computedFields: [],
      },
      orderLine: {
        fields: [
          { name: 'product', type: 'foreignKey', tsType: 'string', visibility: 'editable', required: true, grid: true, form: true, reference: 'Product', inputMode: 'search' },
          { name: 'quantity', type: 'number', tsType: 'number', visibility: 'editable', required: true, grid: true, form: true },
          { name: 'tax', type: 'foreignKey', tsType: 'string', visibility: 'editable', required: true, grid: true, form: true, reference: 'Tax', inputMode: 'selector' },
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
  it('generates thin component importing from contract-ui', () => {
    const code = generateTableComponent('order', sampleContract);
    assert.ok(code.includes("import { DataTable } from '@/components/contract-ui'"), 'should import DataTable from contract-ui');
    assert.ok(code.includes('export default function OrderTable'), 'should export OrderTable');
    assert.ok(code.includes('<DataTable'), 'should render DataTable component');
  });

  it('declares columns array with correct entries', () => {
    const code = generateTableComponent('order', sampleContract);
    assert.ok(code.includes("key: 'documentNo'"), 'should have documentNo column');
    assert.ok(code.includes("label: 'Document No'"), 'should have Document No label');
    assert.ok(code.includes("key: 'businessPartner'"), 'should have businessPartner column');
    assert.ok(code.includes("key: 'grandTotal'"), 'should have grandTotal column');
    assert.ok(code.includes("type: 'amount'"), 'should mark grandTotal as amount type');
    assert.ok(code.includes("type: 'status'"), 'should mark docStatus as status type');
  });

  it('declares filters array from searchableFields', () => {
    const code = generateTableComponent('order', sampleContract);
    assert.ok(code.includes("'documentNo'"), 'should include documentNo filter');
    assert.ok(code.includes("'businessPartner'"), 'should include businessPartner filter');
    assert.ok(code.includes("'docStatus'"), 'should include docStatus filter');
    assert.ok(code.includes('const filters'), 'should declare filters array');
  });

  it('passes columns and filters as props to DataTable', () => {
    const code = generateTableComponent('order', sampleContract);
    assert.ok(code.includes('columns={columns}'), 'should pass columns prop');
    assert.ok(code.includes('filters={filters}'), 'should pass filters prop');
    assert.ok(code.includes('{...props}'), 'should spread remaining props');
  });

  it('does NOT contain inline CSS classes (moved to generic components)', () => {
    const code = generateTableComponent('order', sampleContract);
    assert.ok(!code.includes('hover:bg-primary'), 'should NOT have hover classes inline');
    assert.ok(!code.includes('bg-muted/30'), 'should NOT have zebra classes inline');
    assert.ok(!code.includes('rounded-lg border overflow-hidden'), 'should NOT have container classes inline');
    assert.ok(!code.includes('text-blue-800'), 'should NOT have header classes inline');
    assert.ok(!code.includes('pl-8'), 'should NOT have filter padding inline');
    assert.ok(!code.includes('lucide-react'), 'should NOT import from lucide-react');
  });

  it('does NOT contain inline state management', () => {
    const code = generateTableComponent('order', sampleContract);
    assert.ok(!code.includes('useState'), 'should NOT have useState (handled by DataTable)');
    assert.ok(!code.includes('filteredData'), 'should NOT have filteredData logic inline');
  });
});

describe('generateFormComponent', () => {
  it('generates thin component importing from contract-ui', () => {
    const code = generateFormComponent('order', sampleContract);
    assert.ok(code.includes("import { EntityForm } from '@/components/contract-ui'"), 'should import EntityForm from contract-ui');
    assert.ok(code.includes('export default function OrderForm'), 'should export OrderForm');
    assert.ok(code.includes('<EntityForm'), 'should render EntityForm component');
  });

  it('declares fields array with only editable fields', () => {
    const code = generateFormComponent('order', sampleContract);
    assert.ok(code.includes("key: 'businessPartner'"), 'should include editable businessPartner');
    assert.ok(!code.includes("key: 'documentNo'"), 'should NOT include readOnly documentNo');
    assert.ok(!code.includes("key: 'docStatus'"), 'should NOT include readOnly docStatus');
    assert.ok(!code.includes("key: 'grandTotal'"), 'should NOT include readOnly grandTotal');
  });

  it('includes required flag on required fields', () => {
    const code = generateFormComponent('order', sampleContract);
    assert.ok(code.includes("required: true"), 'should mark required fields');
  });

  it('includes labels for editable fields', () => {
    const code = generateFormComponent('order', sampleContract);
    assert.ok(code.includes("label: 'Business Partner'"), 'should have Business Partner label');
  });

  it('does NOT contain inline CSS classes or layout', () => {
    const code = generateFormComponent('order', sampleContract);
    assert.ok(!code.includes('grid-cols-2'), 'should NOT have grid classes inline');
    assert.ok(!code.includes('focus:ring'), 'should NOT have focus ring classes inline');
    assert.ok(!code.includes('space-y-1.5'), 'should NOT have spacing classes inline');
  });

  it('generates search type for search-mode FK fields with reference', () => {
    const code = generateFormComponent('order', sampleContract);
    assert.ok(code.includes("type: 'search'"), 'should use search type for search-mode FK fields');
    assert.ok(code.includes("reference: 'BusinessPartner'"), 'should include reference for businessPartner');
  });

  it('generates selector type for selector-mode FK fields', () => {
    const code = generateFormComponent('order', sampleContract);
    assert.ok(code.includes("type: 'selector'"), 'should use selector type for selector-mode FK fields');
    assert.ok(code.includes("reference: 'Warehouse'"), 'should include reference for warehouse');
    assert.ok(code.includes("reference: 'PriceList'"), 'should include reference for priceList');
    assert.ok(code.includes("inputMode: 'selector'"), 'should include inputMode selector');
  });

  it('generates dependent type for dependent-mode FK fields', () => {
    const code = generateFormComponent('order', sampleContract);
    assert.ok(code.includes("type: 'dependent'"), 'should use dependent type for dependent-mode FK fields');
    assert.ok(code.includes("reference: 'BusinessPartnerLocation'"), 'should include reference for partnerAddress');
    assert.ok(code.includes("inputMode: 'dependent'"), 'should include inputMode dependent');
    assert.ok(code.includes("dependsOn: { field: 'businessPartner', filterKey: 'businessPartnerId' }"), 'should include dependsOn config');
  });

  it('does not render save/delete buttons or process actions', () => {
    const code = generateFormComponent('order', sampleContract);
    assert.ok(!code.includes('Save'), 'should NOT have Save button');
    assert.ok(!code.includes('completeOrder'), 'should NOT have process actions');
  });
});

describe('generatePageComponent', () => {
  it('generates thin component importing from contract-ui', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes("import { MasterDetailPage } from '@/components/contract-ui'"), 'should import MasterDetailPage from contract-ui');
    assert.ok(code.includes('export default function OrderPage'), 'should export OrderPage');
    assert.ok(code.includes('<MasterDetailPage'), 'should render MasterDetailPage component');
  });

  it('does NOT import useEntity or useState directly', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(!code.includes("from '@/hooks/useEntity'"), 'should NOT import useEntity (handled by MasterDetailPage)');
    assert.ok(!code.includes('useState'), 'should NOT import useState');
    assert.ok(!code.includes('fetch('), 'should NOT have fetch calls');
  });

  it('declares summary array from read-only fields (excluding status)', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes("key: 'documentNo'"), 'should include documentNo in summary');
    assert.ok(code.includes("label: 'Document No'"), 'should label Document No');
    assert.ok(code.includes("key: 'grandTotal'"), 'should include grandTotal in summary');
    assert.ok(code.includes("label: 'Grand Total'"), 'should label Grand Total');
  });

  it('declares statusField string', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes("const statusField = 'docStatus'"), 'should set statusField to docStatus');
  });

  it('declares processes array with style flags', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes("name: 'completeOrder'"), 'should include completeOrder process');
    assert.ok(code.includes("label: 'Complete Order'"), 'should label Complete Order');
    assert.ok(code.includes("style: 'positive'"), 'should mark complete as positive');
    assert.ok(code.includes("name: 'voidOrder'"), 'should include voidOrder process');
    assert.ok(code.includes("label: 'Void Order'"), 'should label Void Order');
    assert.ok(code.includes("style: 'destructive'"), 'should mark void as destructive');
  });

  it('includes reference in addLineFields entry for FK fields', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes("reference: 'Product'"), 'should include reference for product in addLineFields');
    assert.ok(code.includes("type: 'search'"), 'should use search type for search FK entry fields');
  });

  it('includes selector type for selector FK fields in addLineFields', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes("reference: 'Tax'"), 'should include reference for tax in addLineFields');
    assert.ok(code.includes("type: 'selector'"), 'should use selector type for selector FK entry fields');
    assert.ok(code.includes("inputMode: 'selector'"), 'should include inputMode selector in addLineFields');
  });

  it('declares addLineFields with entry and derived arrays', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes('addLineFields'), 'should declare addLineFields');
    assert.ok(code.includes('entry:'), 'should have entry section');
    assert.ok(code.includes('derived:'), 'should have derived section');
    assert.ok(code.includes("key: 'product'"), 'should include product in entry fields');
    assert.ok(code.includes("key: 'quantity'"), 'should include quantity in entry fields');
    assert.ok(code.includes('lookup: true'), 'should mark first entry field with lookup');
  });

  it('passes all config props to MasterDetailPage including catalogs', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes('entity="order"'), 'should pass entity prop');
    assert.ok(code.includes('detailEntity="orderLine"'), 'should pass detailEntity prop');
    assert.ok(code.includes('Table={OrderTable}'), 'should pass Table component');
    assert.ok(code.includes('Form={OrderForm}'), 'should pass Form component');
    assert.ok(code.includes('DetailTable={OrderLineTable}'), 'should pass DetailTable component');
    assert.ok(code.includes('summary={summary}'), 'should pass summary prop');
    assert.ok(code.includes('statusField={statusField}'), 'should pass statusField prop');
    assert.ok(code.includes('processes={processes}'), 'should pass processes prop');
    assert.ok(code.includes('addLineFields={addLineFields}'), 'should pass addLineFields prop');
    assert.ok(code.includes('catalogs={catalogs}'), 'should pass catalogs prop');
    assert.ok(code.includes('{...props}'), 'should spread remaining props');
  });

  it('imports mockCatalogs and child components', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes("import OrderTable from './OrderTable'"), 'should import OrderTable');
    assert.ok(code.includes("import OrderForm from './OrderForm'"), 'should import OrderForm');
    assert.ok(code.includes("import OrderLineTable from './OrderLineTable'"), 'should import OrderLineTable');
    assert.ok(code.includes("import catalogs from './mockCatalogs'"), 'should import mockCatalogs');
  });

  it('does NOT contain inline layout CSS (moved to generic components)', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(!code.includes('w-2/5'), 'should NOT have split view widths inline');
    assert.ok(!code.includes('animate-pulse'), 'should NOT have loading skeleton inline');
    assert.ok(!code.includes('bg-emerald-50'), 'should NOT have process button colors inline');
    assert.ok(!code.includes('bg-amber-50'), 'should NOT have process button colors inline');
    assert.ok(!code.includes('truncate'), 'should NOT have truncate class inline');
    assert.ok(!code.includes('shadow-sm'), 'should NOT have toolbar shadow inline');
  });

  it('passes entityLabel and detailLabel props', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes('entityLabel="Order"'), 'should pass entityLabel');
    assert.ok(code.includes('detailLabel="Order Line"'), 'should pass detailLabel');
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

  it('imports page component for header-detail entity', () => {
    const code = generateIndexComponent('order', 'orderLine');
    assert.ok(code.includes("import OrderPage from './OrderPage'"), 'should import OrderPage');
    assert.ok(code.includes('<OrderPage'), 'should render OrderPage');
  });

  it('handles single-entity without page component', () => {
    const code = generateIndexComponent('item', null);
    assert.ok(code.includes("import ItemTable"), 'should import ItemTable');
    assert.ok(!code.includes('Page'), 'should NOT have a Page component');
  });
});

describe('boolean field handling', () => {
  const boolContract = {
    frontendContract: {
      window: { id: '203', name: 'Price List', primaryEntity: 'priceList', category: 'reference' },
      entities: {
        priceList: {
          fields: [
            { name: 'name', type: 'string', tsType: 'string', visibility: 'editable', required: true, grid: true, form: true },
            { name: 'isDefault', type: 'boolean', tsType: 'boolean', visibility: 'editable', required: false, grid: false, form: true },
            { name: 'isActive', type: 'boolean', tsType: 'boolean', visibility: 'readOnly', required: true, grid: true, form: true },
          ],
          searchableFields: ['name'],
          computedFields: [],
        },
      },
    },
    backendContract: { processEndpoints: [] },
  };

  it('mapFieldType returns boolean for boolean fields in table columns', () => {
    const code = generateTableComponent('priceList', boolContract);
    assert.ok(code.includes("type: 'boolean'"), 'should map boolean fields to boolean type in table columns');
    assert.ok(code.includes("key: 'isActive'"), 'should include isActive boolean field in grid');
  });

  it('mapFormFieldType returns checkbox for boolean fields in form', () => {
    const code = generateFormComponent('priceList', boolContract);
    assert.ok(code.includes("type: 'checkbox'"), 'should map boolean fields to checkbox type in form');
    assert.ok(code.includes("key: 'isDefault'"), 'should include editable isDefault boolean in form');
  });

  it('excludes readOnly boolean fields from form (same rule as other readOnly fields)', () => {
    const code = generateFormComponent('priceList', boolContract);
    assert.ok(!code.includes("key: 'isActive'"), 'should NOT include readOnly isActive in form');
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

  it('generates mockCatalogs.js', () => {
    const files = generateAll(sampleContract);
    assert.ok(files['mockCatalogs.js'], 'should produce mockCatalogs.js');
    assert.ok(files['mockCatalogs.js'].includes('catalogs'), 'should export catalogs object');
    assert.ok(files['mockCatalogs.js'].includes('export default catalogs'), 'should have default export');
  });

  it('all generated files import from contract-ui (not individual UI components)', () => {
    const files = generateAll(sampleContract);
    for (const [name, code] of Object.entries(files)) {
      if (name.endsWith('Table.jsx') || name.endsWith('Form.jsx') || name.endsWith('Page.jsx')) {
        assert.ok(code.includes('@/components/contract-ui'), `${name} should import from contract-ui`);
        assert.ok(!code.includes('@/components/ui/table'), `${name} should NOT import from ui/table directly`);
        assert.ok(!code.includes('@/components/ui/input'), `${name} should NOT import from ui/input directly`);
      }
    }
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
    assert.ok(!files['ItemPage.jsx'], 'should NOT produce ItemPage.jsx for single entity');
  });
});

describe('generateMockCatalogs', () => {
  it('generates catalogs for all references in the contract', () => {
    const code = generateMockCatalogs(sampleContract);
    assert.ok(code.includes("catalogs['BusinessPartner']"), 'should include BusinessPartner catalog');
    assert.ok(code.includes("catalogs['Warehouse']"), 'should include Warehouse catalog');
    assert.ok(code.includes("catalogs['PriceList']"), 'should include PriceList catalog');
    assert.ok(code.includes("catalogs['Product']"), 'should include Product catalog');
    assert.ok(code.includes("catalogs['Tax']"), 'should include Tax catalog');
    assert.ok(code.includes("catalogs['BusinessPartnerLocation']"), 'should include BusinessPartnerLocation catalog');
  });

  it('catalog data has correct structure with id and name', () => {
    const code = generateMockCatalogs(sampleContract);
    // BusinessPartner should have id and name
    assert.ok(code.includes('"id"'), 'catalog items should have id');
    assert.ok(code.includes('"name"'), 'catalog items should have name');
    assert.ok(code.includes('bp-'), 'BusinessPartner ids should start with bp-');
    assert.ok(code.includes('Acme Corp'), 'should have realistic company names');
  });

  it('BusinessPartnerLocation items have businessPartnerId for dependent filtering', () => {
    const code = generateMockCatalogs(sampleContract);
    assert.ok(code.includes('"businessPartnerId"'), 'BPLocation should have businessPartnerId for filtering');
  });

  it('Tax catalog items have rate property', () => {
    const code = generateMockCatalogs(sampleContract);
    assert.ok(code.includes('"rate"'), 'Tax items should have rate');
  });

  it('Product catalog items have price and uomId', () => {
    const code = generateMockCatalogs(sampleContract);
    assert.ok(code.includes('"price"'), 'Product items should have price');
    assert.ok(code.includes('"uomId"'), 'Product items should have uomId');
  });

  it('exports catalogs as default export', () => {
    const code = generateMockCatalogs(sampleContract);
    assert.ok(code.includes('export default catalogs'), 'should export catalogs as default');
  });
});

describe('getReadOnlyFields', () => {
  it('returns only form fields with readOnly visibility', () => {
    const fields = getReadOnlyFields(sampleContract, 'order');
    assert.ok(fields.length > 0, 'should find readOnly fields');
    assert.ok(fields.every(f => f.visibility === 'readOnly'), 'all should be readOnly');
    assert.ok(fields.every(f => f.form === true), 'all should be form fields');
  });
});
