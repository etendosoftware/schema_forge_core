import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'landedCostType', column: 'M_LandedCostType_ID', type: 'selector', required: true, reference: 'LandedCostType', inputMode: 'selector' },
  { key: 'amount', column: 'Amt', type: 'number', required: true },
  { key: 'landedCostDistribution', column: 'LandedCostDistribution', type: 'text', required: true },
  { key: 'goodsReceipt', column: 'M_InOut_ID', type: 'search', reference: 'GoodsReceipt', inputMode: 'search' },
  { key: 'goodsReceiptLine', column: 'M_InOutLine_ID', type: 'dependent', reference: 'GoodsReceiptLine', inputMode: 'dependent', dependsOn: { field: 'goodsReceipt', filterKey: 'goodsReceiptId' } },
  { key: 'invoiceLine', column: 'C_InvoiceLine_ID', type: 'search', reference: 'InvoiceLine', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true },
  { key: 'accountingDate', column: 'DateAcct', type: 'date', readOnly: true },
];

export default function LandedCostCostForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
