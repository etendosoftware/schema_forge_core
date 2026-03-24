import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:customerReturnLine
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, section: 'principal' },
  // @sf-custom-slot callout:SL_Order_Product
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, readOnly: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text', section: 'other' },
  { key: 'cReturnReasonID', column: 'C_Return_Reason_ID', type: 'search', section: 'other', reference: 'Return_Reason', inputMode: 'search' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'text', required: true, section: 'principal', readOnlySource: 'server', readOnlyLogicReason: 'session-variable' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', required: true, readOnly: true, section: 'principal', reference: 'UOM', inputMode: 'selector' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'unitPrice', column: 'PriceActual', type: 'text', required: true, readOnly: true, section: 'principal' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', required: true, readOnly: true, section: 'principal' },
  // @sf-custom-slot callout:SL_Order_Amt
  { key: 'tax', column: 'C_Tax_ID', type: 'selector', required: true, readOnly: true, section: 'principal', reference: 'Tax', inputMode: 'selector' },
  { key: 'goodsShipmentLine', column: 'M_Inoutline_ID', type: 'search', section: 'principal', reference: 'InOutLine', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
];
// @sf-generated-end fields:customerReturnLine

// @sf-generated-start component:CustomerReturnLineForm
export default function CustomerReturnLineForm(props) {
  // @sf-custom-slot hooks:CustomerReturnLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:CustomerReturnLineForm

// @sf-custom-slot section:CustomerReturnLineForm-custom
