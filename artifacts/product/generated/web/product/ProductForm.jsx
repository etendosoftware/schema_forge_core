import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'searchKey', label: 'Search Key', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'uom', label: 'Uom', type: 'selector', required: true, reference: 'UOM', inputMode: 'selector' },
  { key: 'productCategory', label: 'Product Category', type: 'selector', required: true, reference: 'ProductCategory', inputMode: 'selector' },
  { key: 'listPrice', label: 'List Price', type: 'number' },
  { key: 'standardCost', label: 'Standard Cost', type: 'number' },
];

export default function ProductForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
