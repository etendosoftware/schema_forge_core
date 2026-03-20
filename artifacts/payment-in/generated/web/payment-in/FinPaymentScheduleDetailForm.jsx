import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:finPaymentScheduleDetail
const fields = [
  { key: 'dueDate', column: 'DueDate', type: 'date', label: 'Due Date', readOnly: true, section: 'other' },
  { key: 'invoiceAmount', column: 'InvoiceAmount', type: 'number', label: 'Invoice Amount', readOnly: true, section: 'other' },
  { key: 'expected', column: 'ExpectedAmount', type: 'number', label: 'Expected Amount', readOnly: true, section: 'other' },
  { key: 'amount', column: 'Amount', type: 'number', label: 'Received Amount', required: true, section: 'principal' },
  { key: 'writeoffAmount', column: 'Writeoffamt', type: 'number', label: 'Write-off Amount', readOnly: true, section: 'other' },
  { key: 'orderPaymentSchedule', column: 'FIN_Payment_Schedule_Order', type: 'search', label: 'Order Payment Schedule', section: 'principal', inputMode: 'search' },
  { key: 'invoicePaymentSchedule', column: 'FIN_Payment_Schedule_Invoice', type: 'search', label: 'Invoice Payment Schedule', section: 'principal', inputMode: 'search' },
  { key: 'gLItem', column: 'C_Glitem_ID', type: 'search', label: 'G/L Item', section: 'principal', inputMode: 'search' },
  { key: 'canceled', column: 'Iscanceled', type: 'checkbox', label: 'Canceled', required: true, section: 'other' },
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'search', label: 'Business Partner', section: 'other', inputMode: 'search' },
];
// @sf-generated-end fields:finPaymentScheduleDetail

// @sf-generated-start component:FinPaymentScheduleDetailForm
export default function FinPaymentScheduleDetailForm(props) {
  // @sf-custom-slot hooks:FinPaymentScheduleDetailForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:FinPaymentScheduleDetailForm

// @sf-custom-slot section:FinPaymentScheduleDetailForm-custom
