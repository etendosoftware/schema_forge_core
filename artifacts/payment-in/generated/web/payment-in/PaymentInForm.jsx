import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'documentNo', label: 'Document No', type: 'text', required: true, readOnly: true },
  { key: 'businessPartner', label: 'Business Partner', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'paymentDate', label: 'Payment Date', type: 'date', required: true },
  { key: 'amount', label: 'Amount', type: 'number', required: true },
  { key: 'currency', label: 'Currency', type: 'text', required: true },
  { key: 'paymentMethod', label: 'Payment Method', type: 'selector', required: true, reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'status', label: 'Status', type: 'text', required: true, readOnly: true },
  { key: 'salesInvoice', label: 'Sales Invoice', type: 'search', reference: 'SalesInvoice', inputMode: 'search' },
];

export default function PaymentInForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
