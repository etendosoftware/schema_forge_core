import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'invoiceLine', label: 'Invoice Line', type: 'search', readOnly: true, reference: 'InvoiceLine', inputMode: 'search' },
  { key: 'commissionAmount', label: 'Commission Amount', type: 'number', required: true, readOnly: true },
  { key: 'actualQuantity', label: 'Actual Quantity', type: 'number', readOnly: true },
  { key: 'actualAmount', label: 'Actual Amount', type: 'number', readOnly: true },
  { key: 'convertedAmount', label: 'Converted Amount', type: 'number', readOnly: true },
  { key: 'lineNo', label: 'Line No', type: 'number', required: true, readOnly: true },
];

export default function CommissionAmountForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
