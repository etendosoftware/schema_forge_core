import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:order
const fields = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'selector', required: true, reference: 'BusinessPartnerLocation', inputMode: 'selector' },
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', required: true, reference: 'PriceList', inputMode: 'selector' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', required: true, reference: 'PaymentTerm', inputMode: 'selector' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'search', required: true, reference: 'Warehouse', inputMode: 'search' },
  { key: 'salesRepresentative', column: 'SalesRep_ID', type: 'search', reference: 'SalesRepresentative', inputMode: 'search' },
  { key: 'invoiceAddress', column: 'BillTo_ID', type: 'search', required: true, reference: 'BusinessPartnerLocation', inputMode: 'search' },
  { key: 'deliveryLocation', column: 'Delivery_Location_ID', type: 'search', reference: 'BusinessPartnerLocation', inputMode: 'search' },
  { key: 'project', column: 'C_Project_ID', type: 'search', reference: 'Project', inputMode: 'search' },
  { key: 'costCenter', column: 'C_Costcenter_ID', type: 'search', reference: 'CostCenter', inputMode: 'search' },
  { key: 'asset', column: 'A_Asset_ID', type: 'search', reference: 'Asset', inputMode: 'search' },
  { key: 'dimension1', column: 'User1_ID', type: 'search', reference: 'UserDimension1', inputMode: 'search' },
  { key: 'dimension2', column: 'User2_ID', type: 'search', reference: 'UserDimension2', inputMode: 'search' },
  { key: 'orderDate', column: 'DateOrdered', type: 'date', required: true },
  { key: 'scheduledDeliveryDate', column: 'DatePromised', type: 'date', required: true },
  { key: 'invoiceTerms', column: 'InvoiceRule', type: 'text', required: true },
  { key: 'orderReference', column: 'POReference', type: 'text' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'cancelAndReplace', column: 'Cancelandreplace', type: 'text' },
  { key: 'confirmCancelAndReplace', column: 'Confirmcancelandreplace', type: 'text' },
  { key: 'totalGrossAmount', column: 'GrandTotal', type: 'number', required: true, readOnly: true },
  { key: 'totalNetAmount', column: 'TotalLines', type: 'number', required: true, readOnly: true },
  { key: 'quotation', column: 'Quotation_ID', type: 'search', readOnly: true, reference: 'Order', inputMode: 'search' },
  { key: 'canceledOrder', column: 'Cancelledorder_id', type: 'search', readOnly: true, reference: 'Order', inputMode: 'search' },
  { key: 'replacedOrder', column: 'Replacedorder_id', type: 'search', readOnly: true, reference: 'Order', inputMode: 'search' },
  { key: 'isCanceled', column: 'Iscancelled', type: 'checkbox', required: true, readOnly: true },
  { key: 'delivered', column: 'IsDelivered', type: 'checkbox', required: true, readOnly: true },
  { key: 'crmReference', column: 'BPartner_ExtRef', type: 'text', readOnly: true },
];
// @sf-generated-end fields:order

// @sf-generated-start component:OrderForm
export default function OrderForm(props) {
  // @sf-custom-slot hooks:OrderForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:OrderForm

// @sf-custom-slot section:OrderForm-custom
