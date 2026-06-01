import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:lines
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.', required: true, readOnly: true, section: 'other', defaultValue: '@SQL=SELECT COALESCE(MAX(Line),0)+10 AS DefaultValue FROM C_OrderLine WHERE C_Order_ID=@C_Order_ID@', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'product', column: 'M_Product_ID', type: 'search', label: 'Product', required: true, readOnly: true, section: 'other', reference: 'Product', inputMode: 'search', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text', label: 'Attribute Set Value', readOnly: true, section: 'other', readOnlyLogic: (record) => record['processed'] === true || record['aTTRIBUTESETINSTANCIABLE'] === 'Y' },
  { key: 'cReturnReasonID', column: 'C_Return_Reason_ID', type: 'selector', label: 'Return Reason', readOnly: true, section: 'other', reference: 'Return_Reason', inputMode: 'selector' },
  { key: 'operativeQuantity', column: 'Aumqty', type: 'number', label: 'Operative Quantity', readOnly: true, section: 'other', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'operativeUOM', column: 'C_Aum', type: 'search', label: 'Alternative UOM', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'search', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'number', label: 'Return', required: true, readOnly: true, section: 'other', defaultValue: '1', readOnlySource: 'server', readOnlyLogicReason: 'session-variable' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', label: 'UOM', required: true, readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector', readOnlyLogic: (record) => record['uomManagement'] === 'Y' },
  { key: 'unitPrice', column: 'PriceActual', type: 'number', label: 'Net Unit Price', required: true, readOnly: true, section: 'other', readOnlyLogic: (record) => record['processed'] === true || record['gROSSPRICE'] === 'Y' },
  { key: 'grossUnitPrice', column: 'Gross_Unit_Price', type: 'number', label: 'Gross Unit Price', readOnly: true, section: 'other', defaultValue: '0', readOnlyLogic: (record) => record['processed'] === true || record['gROSSPRICE'] === 'N' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', label: 'Line Net Amount', required: true, readOnly: true, section: 'other', readOnlyLogic: (record) => record['editLineAmount'] !== true || record['gROSSPRICE'] === 'Y' },
  { key: 'lineGrossAmount', column: 'Line_Gross_Amount', type: 'number', label: 'Line Gross Amount', readOnly: true, section: 'other', defaultValue: '0' },
  { key: 'goodsShipmentLine', column: 'M_Inoutline_ID', type: 'selector', label: 'Goods Receipt Line', readOnly: true, section: 'other', reference: 'InOutLine', inputMode: 'selector' },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', label: 'Tax', required: true, readOnly: true, section: 'other', reference: 'Tax', inputMode: 'selector', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'principal' },
  { key: 'deliveredQuantity', column: 'QtyDelivered', type: 'number', label: 'Delivered Quantity', required: true, readOnly: true, section: 'other' },
  { key: 'project', column: 'C_Project_ID', type: 'search', label: 'Project', section: 'principal', reference: 'Project', inputMode: 'search', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro', readOnlyLogic: (record) => record['posted'] === 'Y' },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', label: 'Cost Center', section: 'principal', reference: 'Costcenter', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro', readOnlyLogic: (record) => record['posted'] === 'Y' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', label: '1st Dimension', section: 'principal', reference: 'User1', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro', readOnlyLogic: (record) => record['posted'] === 'Y' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', label: '2nd Dimension', section: 'other', reference: 'User2', inputMode: 'selector', visible: null, visibilitySource: 'server', displayLogicReason: 'server-macro', readOnlyLogic: (record) => record['posted'] === 'Y' },
];
// @sf-generated-end fields:lines

// @sf-generated-start component:LinesForm
export default function LinesForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:LinesForm
