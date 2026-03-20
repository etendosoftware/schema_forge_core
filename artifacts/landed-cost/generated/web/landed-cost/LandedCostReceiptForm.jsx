import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:landedCostReceipt
const fields = [
  { key: 'goodsReceipt', column: 'M_InOut_ID', type: 'search', required: true, section: 'principal', reference: 'GoodsReceipt', inputMode: 'search' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, section: 'principal' },
  { key: 'documentNo', column: 'M_InOut_ID$DocumentNo', type: 'text', readOnly: true, section: 'other' },
];
// @sf-generated-end fields:landedCostReceipt

// @sf-generated-start component:LandedCostReceiptForm
export default function LandedCostReceiptForm(props) {
  // @sf-custom-slot hooks:LandedCostReceiptForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:LandedCostReceiptForm

// @sf-custom-slot section:LandedCostReceiptForm-custom
