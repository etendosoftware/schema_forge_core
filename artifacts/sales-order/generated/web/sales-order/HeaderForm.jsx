import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:header
const fields = [
  // @sf-custom-slot callout:SL_Order_UpdateLinesDate
  { key: 'orderDate', column: 'DateOrdered', type: 'date', required: true, section: 'principal' },
  // @sf-custom-slot callout:SE_Order_BPartner
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  // @sf-custom-slot callout:SE_Order_BPartnerLocation
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', required: true, section: 'principal', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  // @sf-custom-slot callout:SL_Order_PriceList
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', required: true, section: 'principal', reference: 'PriceList', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_Order_UpdateLinesDate
  { key: 'scheduledDeliveryDate', column: 'DatePromised', type: 'date', required: true, section: 'other' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', section: 'other', reference: 'PaymentMethod', inputMode: 'selector' },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', required: true, section: 'other', reference: 'PaymentTerm', inputMode: 'selector' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'search', required: true, section: 'other', reference: 'Warehouse', inputMode: 'search' },
  { key: 'invoiceTerms', column: 'InvoiceRule', type: 'text', required: true, section: 'other' },
  { key: 'documentStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', required: true, readOnly: true, section: 'other', reference: 'Currency', inputMode: 'selector' },
  { key: 'reservationStatus', column: 'SO_Res_Status', type: 'text', readOnly: true, section: 'other', visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
  { key: 'orderReference', column: 'POReference', type: 'text', section: 'other' },
  { key: 'salesRepresentative', column: 'SalesRep_ID', type: 'search', section: 'other', reference: 'SalesRepresentative', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'invoiceAddress', column: 'BillTo_ID', type: 'dependent', required: true, section: 'other', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  { key: 'deliveryLocation', column: 'Delivery_Location_ID', type: 'dependent', section: 'other', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  { key: 'quotation', column: 'Quotation_ID', type: 'search', readOnly: true, section: 'other', reference: 'Order', inputMode: 'search' },
  { key: 'deliveryStatus', column: 'DeliveryStatus', type: 'number', readOnly: true, section: 'other' },
  { key: 'invoiceStatus', column: 'InvoiceStatus', type: 'number', readOnly: true, section: 'other' },
  { key: 'cancelledorder', column: 'Cancelledorder_id', type: 'search', readOnly: true, section: 'other', reference: 'Order', inputMode: 'search' },
  { key: 'replacedorder', column: 'Replacedorder_id', type: 'search', readOnly: true, section: 'other', reference: 'Order', inputMode: 'search' },
  { key: 'isCanceled', column: 'Iscancelled', type: 'checkbox', required: true, readOnly: true, section: 'other' },
  { key: 'externalBusinessPartnerReference', column: 'BPartner_ExtRef', type: 'text', readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SE_Order_Project
  { key: 'project', column: 'C_Project_ID', type: 'dependent', section: 'other', reference: 'Project', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', section: 'other', reference: 'Costcenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'asset', column: 'A_Asset_ID', type: 'search', section: 'other', reference: 'Asset', inputMode: 'search' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', section: 'other', reference: 'User1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', section: 'other', reference: 'User2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'cancelAndReplace', column: 'Cancelandreplace', type: 'text', section: 'other' },
  { key: 'confirmCancelAndReplace', column: 'Confirmcancelandreplace', type: 'text', section: 'other' },
  { key: 'delivered', column: 'IsDelivered', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:header

// @sf-generated-start component:HeaderForm
export default function HeaderForm(props) {
  // @sf-custom-slot hooks:HeaderForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:HeaderForm

// @sf-custom-slot section:HeaderForm-custom
