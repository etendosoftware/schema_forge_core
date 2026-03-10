import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'inventoryTransaction', column: 'M_Transaction_ID', type: 'search', reference: 'MaterialTransaction', inputMode: 'search' },
  { key: 'adjustmentAmount', column: 'AdjustmentAmount', type: 'number', required: true },
  { key: 'lineNo', column: 'Line', type: 'number', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true },
  { key: 'isSource', column: 'IsSource', type: 'checkbox', required: true, readOnly: true },
  { key: 'isRelated', column: 'IsRelated', type: 'checkbox', required: true, readOnly: true },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', readOnly: true, reference: 'Currency', inputMode: 'selector' },
];

export default function CostAdjustmentLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
