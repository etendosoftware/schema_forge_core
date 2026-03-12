import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', required: true, reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'businessPartnerId' } },
  { key: 'orderDate', column: 'DateOrdered', type: 'date', required: true },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', required: true, reference: 'PriceList', inputMode: 'selector' },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', required: true, reference: 'PaymentTerm', inputMode: 'selector' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'invoiceAddress', column: 'BillTo_ID', type: 'dependent', required: true, reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'businessPartnerId' } },
  { key: 'deliveryLocation', column: 'DeliveryLocation', type: 'search', reference: 'Location' },
  { key: 'orderReference', column: 'POReference', type: 'text' },
  { key: 'salesRepresentative', column: 'SalesRep_ID', type: 'search', reference: 'User', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'documentStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'number', readOnly: true },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'number', readOnly: true },
  { key: 'currency', column: 'C_Currency_ID', type: 'search', required: true, readOnly: true, reference: 'Currency' },
  { key: 'delivered', column: 'IsDelivered', type: 'checkbox', readOnly: true },
  { key: 'quotation', column: 'Quotation_ID', type: 'search', readOnly: true, reference: 'Order', inputMode: 'search' },
  { key: 'invoiceTerms', column: 'InvoiceRule', type: 'text', required: true },
  { key: 'cancelled', column: 'Iscancelled', type: 'checkbox', readOnly: true },
];

export default function OrderForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
