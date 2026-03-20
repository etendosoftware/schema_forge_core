import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:commissionAmount
const fields = [
  { key: 'invoiceLine', column: 'C_InvoiceLine_ID', type: 'search', readOnly: true, section: 'other', reference: 'InvoiceLine', inputMode: 'search' },
  { key: 'commissionAmount', column: 'CommissionAmt', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'actualQuantity', column: 'ActualQty', type: 'number', readOnly: true, section: 'other' },
  { key: 'actualAmount', column: 'ActualAmt', type: 'number', readOnly: true, section: 'other' },
  { key: 'convertedAmount', column: 'ConvertedAmt', type: 'number', readOnly: true, section: 'other' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:commissionAmount

// @sf-generated-start component:CommissionAmountForm
export default function CommissionAmountForm(props) {
  // @sf-custom-slot hooks:CommissionAmountForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:CommissionAmountForm

// @sf-custom-slot section:CommissionAmountForm-custom
