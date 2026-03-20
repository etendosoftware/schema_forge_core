import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:goodsShipment
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SE_InOut_Warehouse
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, section: 'principal', reference: 'Warehouse', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_InOut_BPartner
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', required: true, section: 'principal', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  // @sf-custom-slot callout:SL_InOut_AccountingDate
  { key: 'movementDate', column: 'MovementDate', type: 'date', required: true, section: 'other' },
  { key: 'deliveryLocation', column: 'Delivery_Location_ID', type: 'dependent', section: 'other', reference: 'BPartner_Location', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  { key: 'documentStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'accountingDate', column: 'DateAcct', type: 'date', required: true, section: 'other' },
  { key: 'salesOrder', column: 'C_Order_ID', type: 'search', readOnly: true, section: 'other', reference: 'Order', inputMode: 'search' },
  { key: 'orderReference', column: 'POReference', type: 'text', section: 'other' },
  { key: 'isnettingshipment', column: 'Isnettingshipment', type: 'checkbox', readOnly: true, section: 'other' },
  { key: 'externalBusinessPartnerReference', column: 'Bpartner_Extref', type: 'text', readOnly: true, section: 'other' },
  { key: 'createLinesFrom', column: 'CreateFrom', type: 'text', section: 'other' },
  { key: 'processGoodsJava', column: 'Process_Goods_Java', type: 'text', section: 'other' },
  { key: 'invoiceStatus', column: 'InvoiceStatus', type: 'number', readOnly: true, section: 'other' },
  { key: 'project', column: 'C_Project_ID', type: 'dependent', section: 'other', reference: 'Project', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' }, visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', section: 'other', reference: 'Costcenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'asset', column: 'A_Asset_ID', type: 'selector', section: 'other', reference: 'Asset', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'accounting-dimension' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', section: 'other', reference: 'User1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', section: 'other', reference: 'User2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro' },
  { key: 'completelyInvoiced', column: 'Iscompletelyinvoiced', type: 'checkbox', required: true, readOnly: true, section: 'other' },
  { key: 'invoicefromshipment', column: 'Invoicefromshipment', type: 'text', section: 'other' },
];
// @sf-generated-end fields:goodsShipment

// @sf-generated-start component:GoodsShipmentForm
export default function GoodsShipmentForm(props) {
  // @sf-custom-slot hooks:GoodsShipmentForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:GoodsShipmentForm

// @sf-custom-slot section:GoodsShipmentForm-custom
