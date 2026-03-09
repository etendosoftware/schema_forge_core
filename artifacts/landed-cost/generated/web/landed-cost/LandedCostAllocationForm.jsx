import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'goodsReceiptLine', label: 'Goods Receipt Line', type: 'search', required: true, readOnly: true, reference: 'GoodsReceiptLine', inputMode: 'search' },
  { key: 'product', label: 'Product', type: 'search', required: true, readOnly: true, reference: 'Product', inputMode: 'search' },
  { key: 'amount', label: 'Amount', type: 'number', required: true, readOnly: true },
  { key: 'quantity', label: 'Quantity', type: 'number', readOnly: true },
  { key: 'baseAmount', label: 'Base Amount', type: 'number', readOnly: true },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true, readOnly: true },
];

export default function LandedCostAllocationForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
