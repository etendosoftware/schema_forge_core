import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'searchKey', column: 'Value', type: 'text', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', required: true, reference: 'UOM', inputMode: 'selector' },
  { key: 'productCategory', column: 'M_Product_Category_ID', type: 'selector', required: true, reference: 'ProductCategory', inputMode: 'selector' },
  { key: 'listPrice', column: 'ListPrice', type: 'number' },
  { key: 'standardCost', column: 'StandardCost', type: 'number' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true },
];

export default function ProductForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
