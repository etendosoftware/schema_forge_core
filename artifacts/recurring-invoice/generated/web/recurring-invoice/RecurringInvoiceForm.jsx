import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:recurringInvoice
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'frequency', column: 'Frequency', type: 'selector', required: true, section: 'principal', reference: 'Frequency', inputMode: 'selector' },
  { key: 'nextDate', column: 'NextDate', type: 'date', required: true, section: 'principal' },
  { key: 'amount', column: 'Amount', type: 'number', required: true, section: 'other' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', required: true, section: 'other', reference: 'Currency', inputMode: 'selector' },
  { key: 'status', column: 'Status', type: 'selector', required: true, section: 'other', reference: 'RecurringStatus', inputMode: 'selector' },
  { key: 'startDate', column: 'StartDate', type: 'date', required: true, section: 'other' },
  { key: 'endDate', column: 'EndDate', type: 'date', section: 'other' },
  { key: 'lastGenerated', column: 'LastGenerated', type: 'date', readOnly: true, section: 'other' },
];
// @sf-generated-end fields:recurringInvoice

// @sf-generated-start component:RecurringInvoiceForm
export default function RecurringInvoiceForm(props) {
  // @sf-custom-slot hooks:RecurringInvoiceForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:RecurringInvoiceForm

// @sf-custom-slot section:RecurringInvoiceForm-custom
