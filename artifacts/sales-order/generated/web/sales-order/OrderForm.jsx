import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:order
const fields = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'selector', required: true, section: 'principal', reference: 'BusinessPartnerLocation', inputMode: 'selector' },
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', required: true, section: 'principal', reference: 'PriceList', inputMode: 'selector' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', section: 'principal', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', required: true, section: 'other', reference: 'PaymentTerm', inputMode: 'selector' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'search', required: true, section: 'other', reference: 'Warehouse', inputMode: 'search' },
  { key: 'salesRepresentative', column: 'SalesRep_ID', type: 'search', section: 'other', reference: 'SalesRepresentative', inputMode: 'search' },
  { key: 'invoiceAddress', column: 'BillTo_ID', type: 'search', required: true, section: 'other', reference: 'BusinessPartnerLocation', inputMode: 'search' },
  { key: 'deliveryLocation', column: 'Delivery_Location_ID', type: 'search', section: 'other', reference: 'BusinessPartnerLocation', inputMode: 'search' },
  { key: 'project', column: 'C_Project_ID', type: 'search', section: 'other', reference: 'Project', inputMode: 'search' },
  { key: 'costCenter', column: 'C_Costcenter_ID', type: 'search', section: 'other', reference: 'CostCenter', inputMode: 'search' },
  { key: 'asset', column: 'A_Asset_ID', type: 'search', section: 'other', reference: 'Asset', inputMode: 'search' },
  { key: 'dimension1', column: 'User1_ID', type: 'search', section: 'other', reference: 'UserDimension1', inputMode: 'search' },
  { key: 'dimension2', column: 'User2_ID', type: 'search', section: 'other', reference: 'UserDimension2', inputMode: 'search' },
  { key: 'orderDate', column: 'DateOrdered', type: 'date', required: true, section: 'other' },
  { key: 'scheduledDeliveryDate', column: 'DatePromised', type: 'date', required: true, section: 'other' },
  { key: 'invoiceTerms', column: 'InvoiceRule', type: 'text', required: true, section: 'other' },
  { key: 'orderReference', column: 'POReference', type: 'text', section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'cancelAndReplace', column: 'Cancelandreplace', type: 'text', section: 'other' },
  { key: 'confirmCancelAndReplace', column: 'Confirmcancelandreplace', type: 'text', section: 'other' },
  { key: 'totalGrossAmount', column: 'GrandTotal', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'totalNetAmount', column: 'TotalLines', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'quotation', column: 'Quotation_ID', type: 'search', readOnly: true, section: 'other', reference: 'Order', inputMode: 'search' },
  { key: 'canceledOrder', column: 'Cancelledorder_id', type: 'search', readOnly: true, section: 'other', reference: 'Order', inputMode: 'search' },
  { key: 'replacedOrder', column: 'Replacedorder_id', type: 'search', readOnly: true, section: 'other', reference: 'Order', inputMode: 'search' },
  { key: 'isCanceled', column: 'Iscancelled', type: 'checkbox', required: true, readOnly: true, section: 'other' },
  { key: 'delivered', column: 'IsDelivered', type: 'checkbox', required: true, readOnly: true, section: 'other' },
  { key: 'crmReference', column: 'BPartner_ExtRef', type: 'text', readOnly: true, section: 'other' },
];
// @sf-generated-end fields:order

// @sf-generated-start component:OrderForm
export default function OrderForm(props) {
  // @sf-custom-slot hooks:OrderForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:OrderForm

// @sf-custom-slot section:OrderForm-custom
