import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:header
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', label: 'Document No.', required: true, readOnly: true, section: 'principal', readOnlyLogic: (record) => record['processed'] === 'Y' || record['documentStatus'] === 'TMP' },
  // @sf-custom-slot callout:SE_Order_BPartner
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', label: 'Business Partner', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search', readOnlyLogic: (record) => record['processed'] === 'Y' || record['documentStatus'] === 'TMP' },
  // @sf-custom-slot callout:SL_Order_UpdateLinesDate
  { key: 'orderDate', column: 'DateOrdered', type: 'date', label: 'Order Date', required: true, section: 'principal', defaultValue: '@#Date@', readOnlyLogic: (record) => record['processed'] === 'Y' },
  // @sf-custom-slot callout:SL_Order_UpdateLinesDate
  { key: 'scheduledDeliveryDate', column: 'DatePromised', type: 'date', label: 'Scheduled Delivery Date', required: true, section: 'principal', defaultValue: '@#Date@', readOnlyLogic: (record) => record['processed'] === 'Y' },
  // @sf-custom-slot callout:SL_Order_DocType
  { key: 'transactionDocument', column: 'C_DocTypeTarget_ID', type: 'search', label: 'Transaction Document', required: true, section: 'other', reference: 'DocumentType', readOnlyLogic: (record) => record['processed'] === 'Y' || record['documentStatus'] === 'TMP' },
  // @sf-custom-slot callout:SE_Order_BPartnerLocation
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', label: 'Partner Address', required: true, section: 'other', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' }, readOnlyLogic: (record) => record['processed'] === 'Y' || record['documentStatus'] === 'TMP' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', label: 'Warehouse', required: true, section: 'other', reference: 'Warehouse', inputMode: 'selector', readOnlyLogic: (record) => record['processed'] === 'Y' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', label: 'Payment Method', section: 'other', reference: 'PaymentMethod', inputMode: 'selector', readOnlyLogic: (record) => record['processed'] === 'Y' },
  { key: 'paymentTerms', column: 'C_PaymentTerm_ID', type: 'selector', label: 'Payment Terms', required: true, section: 'other', reference: 'PaymentTerm', inputMode: 'selector', readOnlyLogic: (record) => record['processed'] === 'Y' },
  // @sf-custom-slot callout:SL_Order_PriceList
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', label: 'Price List', required: true, section: 'other', reference: 'PriceList', inputMode: 'selector', readOnlyLogic: (record) => record['processed'] === 'Y' || record['documentStatus'] === 'TMP' },
  { key: 'deliveryNotes', column: 'Deliverynotes', type: 'textarea', label: 'Delivery notes', section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'other' },
  { key: 'orderReference', column: 'POReference', type: 'text', label: 'Order Reference', section: 'other' },
  { key: 'invoiceFrom', column: 'BillTo_ID', type: 'dependent', label: 'Invoice From', required: true, section: 'other', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' }, readOnlyLogic: (record) => record['processed'] === 'Y' || record['documentStatus'] === 'TMP' },
  { key: 'priceIncludesTax', column: 'IsTaxIncluded', type: 'checkbox', label: 'Price includes Tax', readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SE_Order_Project
  { key: 'project', column: 'C_Project_ID', type: 'search', label: 'Project', section: 'other', reference: 'Project', inputMode: 'search', readOnlyLogic: (record) => record['posted'] === 'Y' },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', label: 'Cost Center', section: 'other', reference: 'CostCenter', inputMode: 'selector', readOnlyLogic: (record) => record['posted'] === 'Y' },
  { key: 'asset', column: 'A_Asset_ID', type: 'selector', label: 'Asset', section: 'other', reference: 'Asset', inputMode: 'selector', readOnlyLogic: (record) => record['posted'] === 'Y' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', label: '1st Dimension', section: 'other', reference: 'UserDimension1', inputMode: 'selector', readOnlyLogic: (record) => record['posted'] === 'Y' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', label: '2nd Dimension', section: 'other', reference: 'UserDimension2', inputMode: 'selector', readOnlyLogic: (record) => record['posted'] === 'Y' },
];
// @sf-generated-end fields:header

// @sf-generated-start component:HeaderForm
export default function HeaderForm(props) {
  // @sf-custom-slot hooks:HeaderForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:HeaderForm

// @sf-custom-slot section:HeaderForm-custom
