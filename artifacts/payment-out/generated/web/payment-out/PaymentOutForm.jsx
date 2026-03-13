import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:paymentOut
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'paymentDate', column: 'PaymentDate', type: 'date', required: true, section: 'principal' },
  { key: 'amount', column: 'Amount', type: 'number', required: true, section: 'principal' },
  { key: 'currency', column: 'C_Currency_ID', type: 'text', required: true, section: 'principal' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', required: true, section: 'other', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'status', column: 'Status', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'purchaseInvoice', column: 'C_Invoice_ID', type: 'search', section: 'other', reference: 'PurchaseInvoice', inputMode: 'search' },
];
// @sf-generated-end fields:paymentOut

// @sf-generated-start component:PaymentOutForm
export default function PaymentOutForm(props) {
  // @sf-custom-slot hooks:PaymentOutForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:PaymentOutForm

// @sf-custom-slot section:PaymentOutForm-custom
