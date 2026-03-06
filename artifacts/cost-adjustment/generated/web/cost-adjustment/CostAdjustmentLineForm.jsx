import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'product', label: 'Product', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'inventoryTransaction', label: 'Inventory Transaction', type: 'search', reference: 'MaterialTransaction', inputMode: 'search' },
  { key: 'adjustmentAmount', label: 'Adjustment Amount', type: 'number', required: true },
  { key: 'lineNo', label: 'Line No', type: 'number', required: true },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true },
];

export default function CostAdjustmentLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
