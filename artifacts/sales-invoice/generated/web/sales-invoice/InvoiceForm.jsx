import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:invoice
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'principal' },
  // @sf-custom-slot callout:SE_Invoice_AccountingDate
  { key: 'invoiceDate', column: 'DateInvoiced', type: 'date', required: true, section: 'principal' },
  // @sf-custom-slot callout:SE_Invoice_BPartner
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  // @sf-custom-slot callout:SE_Invoice_BPartnerLocation
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', required: true, section: 'principal', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', required: true, section: 'principal', reference: 'PaymentTerm', inputMode: 'selector' },
  // @sf-custom-slot callout:SE_Invoice_BPartner
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', required: true, section: 'principal', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', required: true, section: 'other', reference: 'Currency', inputMode: 'selector' },
  { key: 'outstandingAmount', column: 'OutstandingAmt', type: 'number', required: true, readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SL_Invoice_PriceList
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', required: true, section: 'other', reference: 'PriceList', inputMode: 'selector' },
  { key: 'salesRepresentative', column: 'SalesRep_ID', type: 'selector', section: 'other', reference: 'User', inputMode: 'selector' },
  { key: 'orderReference', column: 'POReference', type: 'text', section: 'other' },
  // @sf-custom-slot callout:SE_Invoice_TaxDate
  { key: 'accountingDate', column: 'DateAcct', type: 'date', required: true, section: 'other' },
];
// @sf-generated-end fields:invoice

// @sf-generated-start component:InvoiceForm
export default function InvoiceForm(props) {
  // @sf-custom-slot hooks:InvoiceForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InvoiceForm

// @sf-custom-slot section:InvoiceForm-custom
