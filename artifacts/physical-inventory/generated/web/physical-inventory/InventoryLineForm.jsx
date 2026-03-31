import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:inventoryLine
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', label: 'Line No.', section: 'principal', defaultValue: '@SQL=SELECT COALESCE(MAX(Line),0)+10 AS DefaultValue FROM M_InventoryLine WHERE M_Inventory_ID=@M_Inventory_ID@' },
  // @sf-custom-slot callout:SL_Inventory_Product
  { key: 'product', column: 'M_Product_ID', type: 'search', label: 'Product', required: true, lookup: true, section: 'principal', reference: 'Product', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'principal' },
  { key: 'quantityOrderBook', column: 'QuantityOrderBook', type: 'number', label: 'Quantity order book', readOnly: true, section: 'other', defaultValue: '0' },
  { key: 'quantityCount', column: 'QtyCount', type: 'number', label: 'User Count', required: true, section: 'principal' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', label: 'UOM', required: true, readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
  { key: 'bookQuantity', column: 'QtyBook', type: 'number', label: 'System Count', required: true, readOnly: true, section: 'other' },
  { key: 'cost', column: 'Cost', type: 'number', label: 'Cost', section: 'other' },
];
// @sf-generated-end fields:inventoryLine

// @sf-generated-start component:InventoryLineForm
export default function InventoryLineForm(props) {
  // @sf-custom-start hooks:InventoryLineForm
  // SL_Inventory_Product: map product selector aux fields to form fields
  // _QTY → bookQuantity (System Count), _UOM → uOM
  const _rawOnChange = props.onChange;
  // eslint-disable-next-line no-param-reassign
  props = { ...props, onChange: (key, val, col) => {
    _rawOnChange?.(key, val, col);
    if (key === 'product_QTY') _rawOnChange?.('bookQuantity', val);
    else if (key === 'product_UOM') _rawOnChange?.('uOM', val);
    else if (key === 'product_uOM' || key === 'productuOM') _rawOnChange?.('uOM$_identifier', val);
  } };
  // @sf-custom-end hooks:InventoryLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:InventoryLineForm

// @sf-custom-slot section:InventoryLineForm-custom
