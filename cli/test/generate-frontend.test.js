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
    assert.ok(code.includes('space-y-3'), 'should use vertical stacking');
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
