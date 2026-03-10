import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', required: true, reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'businessPartnerId' } },
  { key: 'orderDate', column: 'DateOrdered', type: 'date', required: true },
  { key: 'validUntil', column: 'DatePromised', type: 'date', required: true },
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', required: true, reference: 'PriceList', inputMode: 'selector' },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', required: true, reference: 'PaymentTerm', inputMode: 'selector' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'invoiceAddress', column: 'BillTo_ID', type: 'dependent', required: true, reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'businessPartnerId' } },
  { key: 'poReference', column: 'POReference', type: 'text' },
  { key: 'salesRep', column: 'SalesRep_ID', type: 'search', reference: 'User', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true },
  { key: 'grandTotal', column: 'GrandTotal', type: 'number', readOnly: true },
  { key: 'totalLines', column: 'TotalLines', type: 'number', readOnly: true },
  { key: 'currency', column: 'C_Currency_ID', type: 'text', required: true, readOnly: true },
];

export default function QuotationForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
