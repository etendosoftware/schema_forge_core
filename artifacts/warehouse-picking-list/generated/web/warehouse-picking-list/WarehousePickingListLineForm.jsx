import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'locator', column: 'M_Locator_ID', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
  { key: 'quantityRequired', column: 'QtyRequired', type: 'number', required: true },
  { key: 'quantityPicked', column: 'QtyPicked', type: 'number' },
  { key: 'salesOrder', column: 'C_Order_ID', type: 'search', reference: 'SalesOrder', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
];

export default function WarehousePickingListLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
