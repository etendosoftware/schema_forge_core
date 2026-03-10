import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'movementQty', column: 'MovementQty', type: 'number', required: true },
  { key: 'locator', column: 'M_Locator_ID', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
  { key: 'lineNo', column: 'Line', type: 'number', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'returnOrderLine', column: 'C_OrderLine_ID', type: 'dependent', reference: 'SalesOrderLine', inputMode: 'dependent', dependsOn: { field: 'returnReceipt.orderReference', filterKey: 'cOrderId' } },
  { key: 'rmaLine', column: 'M_RMALine_ID', type: 'dependent', reference: 'ReturnMaterialAuthorizationLine', inputMode: 'dependent', dependsOn: { field: 'returnReceipt.returnReason', filterKey: 'mRmaId' } },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
];

export default function ReturnReceiptLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
