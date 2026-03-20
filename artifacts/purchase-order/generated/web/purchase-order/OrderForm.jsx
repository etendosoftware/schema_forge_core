import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:order
const fields = [
  // @sf-custom-slot callout:SL_Order_DocType
  { key: 'transactionDocument', column: 'C_DocTypeTarget_ID', type: 'search', label: 'Transaction Document', required: true, section: 'principal', reference: 'DocumentType', inputMode: 'search', readOnlyLogic: (record) => record.record.record.processed === true },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', label: 'Document No.', required: true, readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SL_Order_UpdateLinesDate
  { key: 'orderDate', column: 'DateOrdered', type: 'date', label: 'Order Date', required: true, section: 'principal', readOnlyLogic: (record) => record.record.record.processed === true },
  // @sf-custom-slot callout:SE_Order_BPartner
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', label: 'Business Partner', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro', readOnlyLogic: (record) => record.record.record.processed === true },
  // @sf-custom-slot callout:SE_Order_BPartnerLocation
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', label: 'Partner Address', required: true, section: 'principal', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' }, readOnlyLogic: (record) => record.record.record.processed === true },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', label: 'Warehouse', required: true, section: 'other', reference: 'Warehouse', inputMode: 'selector', readOnlyLogic: (record) => record.record.record.processed === true },
  // @sf-custom-slot callout:SL_Order_UpdateLinesDate
  { key: 'scheduledDeliveryDate', column: 'DatePromised', type: 'date', label: 'Scheduled Delivery Date', required: true, section: 'other', readOnlyLogic: (record) => record.record.record.processed === true },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', label: 'Payment Method', section: 'other', reference: 'PaymentMethod', inputMode: 'selector', readOnlyLogic: (record) => record.record.record.processed === true },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', label: 'Payment Terms', required: true, section: 'other', reference: 'PaymentTerm', inputMode: 'selector', readOnlyLogic: (record) => record.record.record.processed === true },
  // @sf-custom-slot callout:SL_Order_PriceList
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', label: 'Price List', required: true, section: 'other', reference: 'PriceList', inputMode: 'selector', readOnlyLogic: (record) => record.record.record.processed === true },
  { key: 'documentStatus', column: 'DocStatus', type: 'text', label: 'Document Status', required: true, readOnly: true, section: 'other' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'number', label: 'Total Gross Amount', required: true, readOnly: true, section: 'other' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'number', label: 'Total Net Amount', required: true, readOnly: true, section: 'other' },
  { key: 'deliveryNotes', column: 'Deliverynotes', type: 'textarea', label: 'Delivery notes', section: 'other', readOnlyLogic: (record) => record.record.record.processed === true },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'other', readOnlyLogic: (record) => record.record.record.processed === true },
  { key: 'orderReference', column: 'POReference', type: 'text', label: 'Order Reference', section: 'other', readOnlyLogic: (record) => record.record.record.processed === true },
  { key: 'invoiceAddress', column: 'BillTo_ID', type: 'dependent', label: 'Invoice From', required: true, section: 'other', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' }, readOnlyLogic: (record) => record.record.record.processed === true },
  { key: 'priceIncludesTax', column: 'IsTaxIncluded', type: 'checkbox', label: 'Price includes Tax', readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SE_Order_Project
  { key: 'project', column: 'C_Project_ID', type: 'dependent', label: 'Project', section: 'other', reference: 'Project', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' }, visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', label: 'Cost Center', section: 'other', reference: 'CostCenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'asset', column: 'A_Asset_ID', type: 'selector', label: 'Asset', section: 'other', reference: 'Asset', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', label: '1st Dimension', section: 'other', reference: 'UserDimension1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', label: '2nd Dimension', section: 'other', reference: 'UserDimension2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'deliveryStatusPurchase', column: 'DeliveryStatusPurchase', type: 'number', label: 'Delivery Status', readOnly: true, section: 'other' },
  { key: 'invoiceStatus', column: 'InvoiceStatus', type: 'number', label: 'Invoice Status', readOnly: true, section: 'other' },
  { key: 'formOfPayment', column: 'PaymentRule', type: 'text', label: 'Form of Payment', required: true, readOnly: true, section: 'other', visible: null, visibilitySource: 'server', displayLogicReason: 'session-variable' },
  { key: 'delivered', column: 'IsDelivered', type: 'checkbox', label: 'Delivered', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:order

// @sf-generated-start component:OrderForm
export default function OrderForm(props) {
  // @sf-custom-slot hooks:OrderForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:OrderForm

// @sf-custom-slot section:OrderForm-custom
