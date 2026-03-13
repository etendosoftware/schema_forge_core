import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:invoice
const fields = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', required: true, section: 'principal', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'businessPartnerId' } },
  { key: 'invoiceDate', column: 'DateInvoiced', type: 'date', required: true, section: 'principal' },
  { key: 'supplierReference', column: 'POReference', type: 'text', section: 'principal' },
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', required: true, section: 'other', reference: 'PriceList', inputMode: 'selector' },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', required: true, section: 'other', reference: 'PaymentTerm', inputMode: 'selector' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', required: true, section: 'other', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'project', column: 'C_Project_ID', type: 'search', section: 'other', reference: 'Project', inputMode: 'search' },
  { key: 'costCenter', column: 'C_Costcenter_ID', type: 'selector', section: 'other', reference: 'CostCenter', inputMode: 'selector' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'documentStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'grandTotal', column: 'GrandTotal', type: 'number', readOnly: true, section: 'other' },
  { key: 'totalLines', column: 'TotalLines', type: 'number', readOnly: true, section: 'other' },
  { key: 'currency', column: 'C_Currency_ID', type: 'search', required: true, readOnly: true, section: 'other', reference: 'Currency' },
  { key: 'paymentComplete', column: 'Ispaid', type: 'checkbox', readOnly: true, section: 'other' },
  { key: 'purchaseOrder', column: 'C_Order_ID', type: 'search', readOnly: true, section: 'other', reference: 'Order', inputMode: 'search' },
  { key: 'totalOutstanding', column: 'OutstandingAmt', type: 'number', readOnly: true, section: 'other' },
  { key: 'totalPaid', column: 'Totalpaid', type: 'number', readOnly: true, section: 'other' },
  { key: 'amountDue', column: 'DueAmt', type: 'number', readOnly: true, section: 'other' },
  { key: 'daysTillDue', column: 'DaysTillDue', type: 'number', readOnly: true, section: 'other' },
];
// @sf-generated-end fields:invoice

// @sf-generated-start component:InvoiceForm
export default function InvoiceForm(props) {
  // @sf-custom-slot hooks:InvoiceForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InvoiceForm

// @sf-custom-slot section:InvoiceForm-custom
