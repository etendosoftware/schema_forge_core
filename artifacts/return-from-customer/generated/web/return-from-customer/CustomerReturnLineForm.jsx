import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:customerReturnLine
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.', required: true, section: 'principal', defaultValue: '@SQL=SELECT COALESCE(MAX(Line),0)+10 AS DefaultValue FROM C_OrderLine WHERE C_Order_ID=@C_Order_ID@', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'product', column: 'M_Product_ID', type: 'search', label: 'Product', required: true, readOnly: true, section: 'principal', reference: 'Product', inputMode: 'search', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text', label: 'Attribute Set Value', section: 'other', readOnlyLogic: (record) => record['processed'] === true || record['aTTRIBUTESETINSTANCIABLE'] === 'Y' },
  { key: 'cReturnReasonID', column: 'C_Return_Reason_ID', type: 'search', label: 'Return Reason', section: 'other', reference: 'Return_Reason', inputMode: 'search' },
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'number', label: 'Returned Quantity', required: true, section: 'principal', defaultValue: '1', readOnlySource: 'server', readOnlyLogicReason: 'session-variable' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', label: 'UOM', required: true, readOnly: true, section: 'principal', reference: 'UOM', inputMode: 'selector', readOnlyLogic: (record) => record['uomManagement'] === 'Y' },
  { key: 'unitPrice', column: 'PriceActual', type: 'number', label: 'Net Unit Price', required: true, readOnly: true, section: 'principal', readOnlyLogic: (record) => record['processed'] === true || record['gROSSPRICE'] === 'Y' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', label: 'Line Net Amount', required: true, readOnly: true, section: 'principal', readOnlyLogic: (record) => record['editLineAmount'] !== true || record['gROSSPRICE'] === 'Y' },
  { key: 'lineGrossAmount', column: 'Line_Gross_Amount', type: 'number', label: 'Line Gross Amount', readOnly: true, section: 'other', defaultValue: '0' },
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', label: 'Tax', required: true, readOnly: true, section: 'principal', reference: 'Tax', inputMode: 'selector', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'goodsShipmentLine', column: 'M_Inoutline_ID', type: 'search', label: 'Goods Shipment Line', section: 'principal', reference: 'InOutLine', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'other' },
];
// @sf-generated-end fields:customerReturnLine

// @sf-generated-start component:CustomerReturnLineForm
export default function CustomerReturnLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:CustomerReturnLineForm
