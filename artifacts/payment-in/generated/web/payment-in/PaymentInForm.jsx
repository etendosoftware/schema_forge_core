import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:paymentIn
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'paymentDate', column: 'PaymentDate', type: 'date', required: true, section: 'principal' },
  { key: 'amount', column: 'Amount', type: 'number', required: true, section: 'principal' },
  { key: 'currency', column: 'C_Currency_ID', type: 'text', required: true, section: 'principal' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', required: true, section: 'other', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'status', column: 'Status', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'salesInvoice', column: 'C_Invoice_ID', type: 'search', section: 'other', reference: 'SalesInvoice', inputMode: 'search' },
];
// @sf-generated-end fields:paymentIn

// @sf-generated-start component:PaymentInForm
export default function PaymentInForm(props) {
  // @sf-custom-slot hooks:PaymentInForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:PaymentInForm

// @sf-custom-slot section:PaymentInForm-custom
