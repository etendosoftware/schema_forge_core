import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:finPaymentScheduleDetail
const fields = [
  { key: 'dueDate', column: 'DueDate', type: 'date', readOnly: true, section: 'other' },
  { key: 'invoiceAmount', column: 'InvoiceAmount', type: 'number', readOnly: true, section: 'other' },
  { key: 'expected', column: 'ExpectedAmount', type: 'number', readOnly: true, section: 'other' },
  { key: 'amount', column: 'Amount', type: 'number', required: true, section: 'principal' },
  { key: 'orderPaymentSchedule', column: 'FIN_Payment_Schedule_Order', type: 'search', section: 'principal', inputMode: 'search' },
  { key: 'invoicePaymentSchedule', column: 'FIN_Payment_Schedule_Invoice', type: 'search', section: 'principal', inputMode: 'search' },
  { key: 'gLItem', column: 'C_Glitem_ID', type: 'search', section: 'principal', inputMode: 'search' },
  { key: 'canceled', column: 'Iscanceled', type: 'checkbox', required: true, section: 'other' },
  { key: 'businessPartner', column: 'C_Bpartner_ID', type: 'search', section: 'other', inputMode: 'search' },
];
// @sf-generated-end fields:finPaymentScheduleDetail

// @sf-generated-start component:FinPaymentScheduleDetailForm
export default function FinPaymentScheduleDetailForm(props) {
  // @sf-custom-slot hooks:FinPaymentScheduleDetailForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:FinPaymentScheduleDetailForm

// @sf-custom-slot section:FinPaymentScheduleDetailForm-custom
