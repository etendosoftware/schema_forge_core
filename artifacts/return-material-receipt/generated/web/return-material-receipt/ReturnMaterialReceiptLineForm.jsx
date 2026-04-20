import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:returnMaterialReceiptLine
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.', required: true, readOnly: true, section: 'principal' },
  { key: 'product', column: 'M_Product_ID', type: 'search', label: 'Product', readOnly: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'movementQuantity', column: 'MovementQty', type: 'text', label: 'Movement Quantity', required: true, readOnly: true, section: 'principal' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'search', label: 'UOM', required: true, readOnly: true, section: 'principal', reference: 'UOM', inputMode: 'search' },
  { key: 'salesOrderLine', column: 'C_OrderLine_ID', type: 'search', label: 'Return from Customer line', readOnly: true, section: 'other', reference: 'OrderLine', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'other' },
  { key: 'orderQuantity', column: 'QuantityOrder', type: 'text', label: 'Order Quantity', readOnly: true, section: 'other' },
];
// @sf-generated-end fields:returnMaterialReceiptLine

// @sf-generated-start component:ReturnMaterialReceiptLineForm
export default function ReturnMaterialReceiptLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
ReturnMaterialReceiptLineForm.hasCollapsedFields = false;
// @sf-generated-end component:ReturnMaterialReceiptLineForm
