import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'product', label: 'Product', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'movementQty', label: 'Movement Qty', type: 'number', required: true },
  { key: 'locator', label: 'Locator', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
  { key: 'lineNo', label: 'Line No', type: 'number', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'returnOrderLine', label: 'Return Order Line', type: 'dependent', reference: 'SalesOrderLine', inputMode: 'dependent', dependsOn: { field: 'returnReceipt.orderReference', filterKey: 'cOrderId' } },
  { key: 'rmaLine', label: 'Rma Line', type: 'dependent', reference: 'ReturnMaterialAuthorizationLine', inputMode: 'dependent', dependsOn: { field: 'returnReceipt.returnReason', filterKey: 'mRmaId' } },
];

export default function ReturnReceiptLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
