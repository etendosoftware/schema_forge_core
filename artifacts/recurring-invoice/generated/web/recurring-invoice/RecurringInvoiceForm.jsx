import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'frequency', column: 'Frequency', type: 'selector', required: true, reference: 'Frequency', inputMode: 'selector' },
  { key: 'nextDate', column: 'NextDate', type: 'date', required: true },
  { key: 'amount', column: 'Amount', type: 'number', required: true },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', required: true, reference: 'Currency', inputMode: 'selector' },
  { key: 'status', column: 'Status', type: 'selector', required: true, reference: 'RecurringStatus', inputMode: 'selector' },
  { key: 'startDate', column: 'StartDate', type: 'date', required: true },
  { key: 'endDate', column: 'EndDate', type: 'date' },
  { key: 'lastGenerated', column: 'LastGenerated', type: 'date', readOnly: true },
];

export default function RecurringInvoiceForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
