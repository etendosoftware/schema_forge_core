import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'businessPartner', label: 'Business Partner', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'frequency', label: 'Frequency', type: 'selector', required: true, reference: 'Frequency', inputMode: 'selector' },
  { key: 'nextDate', label: 'Next Date', type: 'date', required: true },
  { key: 'amount', label: 'Amount', type: 'number', required: true },
  { key: 'currency', label: 'Currency', type: 'selector', required: true, reference: 'Currency', inputMode: 'selector' },
  { key: 'status', label: 'Status', type: 'selector', required: true, reference: 'RecurringStatus', inputMode: 'selector' },
  { key: 'startDate', label: 'Start Date', type: 'date', required: true },
  { key: 'endDate', label: 'End Date', type: 'date' },
  { key: 'lastGenerated', label: 'Last Generated', type: 'date', readOnly: true },
];

export default function RecurringInvoiceForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
