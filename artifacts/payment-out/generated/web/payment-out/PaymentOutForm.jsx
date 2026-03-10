import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'paymentDate', column: 'PaymentDate', type: 'date', required: true },
  { key: 'amount', column: 'Amount', type: 'number', required: true },
  { key: 'currency', column: 'C_Currency_ID', type: 'text', required: true },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', required: true, reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'status', column: 'Status', type: 'text', required: true, readOnly: true },
  { key: 'purchaseInvoice', column: 'C_Invoice_ID', type: 'search', reference: 'PurchaseInvoice', inputMode: 'search' },
];

export default function PaymentOutForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
