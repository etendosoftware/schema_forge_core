import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:landedCostCost
const fields = [
  { key: 'landedCostType', column: 'M_LandedCostType_ID', type: 'selector', required: true, section: 'principal', reference: 'LandedCostType', inputMode: 'selector' },
  { key: 'amount', column: 'Amt', type: 'number', required: true, section: 'principal' },
  { key: 'landedCostDistribution', column: 'LandedCostDistribution', type: 'text', required: true, section: 'principal' },
  { key: 'goodsReceipt', column: 'M_InOut_ID', type: 'search', section: 'principal', reference: 'GoodsReceipt', inputMode: 'search' },
  { key: 'goodsReceiptLine', column: 'M_InOutLine_ID', type: 'dependent', section: 'other', reference: 'GoodsReceiptLine', inputMode: 'dependent', dependsOn: { field: 'goodsReceipt', filterKey: 'goodsReceiptId' } },
  { key: 'invoiceLine', column: 'C_InvoiceLine_ID', type: 'search', section: 'other', reference: 'InvoiceLine', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'other' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, section: 'other' },
  { key: 'accountingDate', column: 'DateAcct', type: 'date', readOnly: true, section: 'other' },
];
// @sf-generated-end fields:landedCostCost

// @sf-generated-start component:LandedCostCostForm
export default function LandedCostCostForm(props) {
  // @sf-custom-slot hooks:LandedCostCostForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:LandedCostCostForm

// @sf-custom-slot section:LandedCostCostForm-custom
