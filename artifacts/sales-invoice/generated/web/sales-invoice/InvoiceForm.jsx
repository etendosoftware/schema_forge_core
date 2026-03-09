import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'businessPartner', label: 'Business Partner', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'partnerAddress', label: 'Partner Address', type: 'dependent', required: true, reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'businessPartnerId' } },
  { key: 'dateInvoiced', label: 'Date Invoiced', type: 'date', required: true },
  { key: 'dateAcct', label: 'Date Acct', type: 'date', required: true },
  { key: 'paymentTerms', label: 'Payment Terms', type: 'selector', required: true, reference: 'PaymentTerm', inputMode: 'selector' },
  { key: 'paymentMethod', label: 'Payment Method', type: 'selector', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'priceList', label: 'Price List', type: 'selector', required: true, reference: 'PriceList', inputMode: 'selector' },
  { key: 'currency', label: 'Currency', type: 'selector', required: true, reference: 'Currency', inputMode: 'selector' },
  { key: 'salesRep', label: 'Sales Rep', type: 'search', reference: 'User', inputMode: 'search' },
  { key: 'poReference', label: 'Po Reference', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true },
  { key: 'documentNo', label: 'Document No', type: 'text', required: true, readOnly: true },
  { key: 'docStatus', label: 'Doc Status', type: 'text', required: true, readOnly: true },
  { key: 'grandTotal', label: 'Grand Total', type: 'number', readOnly: true },
  { key: 'totalLines', label: 'Total Lines', type: 'number', readOnly: true },
  { key: 'isPaid', label: 'Is Paid', type: 'checkbox', readOnly: true },
];

export default function InvoiceForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
