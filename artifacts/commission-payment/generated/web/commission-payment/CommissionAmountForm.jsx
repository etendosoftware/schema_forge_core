import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'invoiceLine', column: 'C_InvoiceLine_ID', type: 'search', readOnly: true, reference: 'InvoiceLine', inputMode: 'search' },
  { key: 'commissionAmount', column: 'CommissionAmt', type: 'number', required: true, readOnly: true },
  { key: 'actualQuantity', column: 'ActualQty', type: 'number', readOnly: true },
  { key: 'actualAmount', column: 'ActualAmt', type: 'number', readOnly: true },
  { key: 'convertedAmount', column: 'ConvertedAmt', type: 'number', readOnly: true },
  { key: 'lineNo', column: 'Line', type: 'number', required: true, readOnly: true },
];

export default function CommissionAmountForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
