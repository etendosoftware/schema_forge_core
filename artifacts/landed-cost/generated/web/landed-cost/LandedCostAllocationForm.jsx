import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'goodsReceiptLine', column: 'M_InOutLine_ID', type: 'search', required: true, readOnly: true, reference: 'GoodsReceiptLine', inputMode: 'search' },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, readOnly: true, reference: 'Product', inputMode: 'search' },
  { key: 'amount', column: 'Amt', type: 'number', required: true, readOnly: true },
  { key: 'quantity', column: 'Qty', type: 'number', readOnly: true },
  { key: 'baseAmount', column: 'Base', type: 'number', readOnly: true },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true },
];

export default function LandedCostAllocationForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
