import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:landedCostAllocation
const fields = [
  { key: 'goodsReceiptLine', column: 'M_InOutLine_ID', type: 'search', required: true, readOnly: true, section: 'other', reference: 'GoodsReceiptLine', inputMode: 'search' },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, readOnly: true, section: 'other', reference: 'Product', inputMode: 'search' },
  { key: 'amount', column: 'Amt', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'quantity', column: 'Qty', type: 'number', readOnly: true, section: 'other' },
  { key: 'baseAmount', column: 'Base', type: 'number', readOnly: true, section: 'other' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:landedCostAllocation

// @sf-generated-start component:LandedCostAllocationForm
export default function LandedCostAllocationForm(props) {
  // @sf-custom-slot hooks:LandedCostAllocationForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:LandedCostAllocationForm

// @sf-custom-slot section:LandedCostAllocationForm-custom
