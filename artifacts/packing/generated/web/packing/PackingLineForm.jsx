import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
  { key: 'quantity', column: 'Qty', type: 'number', required: true },
  { key: 'weight', column: 'Weight', type: 'number' },
  { key: 'packageNo', column: 'PackageNo', type: 'text', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, reference: 'UOM', inputMode: 'selector' },
];

export default function PackingLineForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
