import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', required: true, reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'businessPartnerId' } },
  { key: 'dateInvoiced', column: 'DateInvoiced', type: 'date', required: true },
  { key: 'dateAcct', column: 'DateAcct', type: 'date', required: true },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', required: true, reference: 'PaymentTerm', inputMode: 'selector' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', required: true, reference: 'PriceList', inputMode: 'selector' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', required: true, reference: 'Currency', inputMode: 'selector' },
  { key: 'poReference', column: 'POReference', type: 'text' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true },
  { key: 'grandTotal', column: 'GrandTotal', type: 'number', readOnly: true },
  { key: 'totalLines', column: 'TotalLines', type: 'number', readOnly: true },
  { key: 'isPaid', column: 'IsPaid', type: 'checkbox', readOnly: true },
];

export default function InvoiceForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
