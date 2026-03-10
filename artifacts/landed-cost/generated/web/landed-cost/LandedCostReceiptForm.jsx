import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'goodsReceipt', column: 'M_InOut_ID', type: 'search', required: true, reference: 'GoodsReceipt', inputMode: 'search' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true },
  { key: 'documentNo', column: 'M_InOut_ID$DocumentNo', type: 'text', readOnly: true },
];

export default function LandedCostReceiptForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
