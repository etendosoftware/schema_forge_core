import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:product
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'searchKey', column: 'Value', type: 'text', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', required: true, section: 'principal', reference: 'UOM', inputMode: 'selector' },
  { key: 'productCategory', column: 'M_Product_Category_ID', type: 'selector', required: true, section: 'other', reference: 'ProductCategory', inputMode: 'selector' },
  { key: 'listPrice', column: 'ListPrice', type: 'number', section: 'other' },
  { key: 'standardCost', column: 'StandardCost', type: 'number', section: 'other' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:product

// @sf-generated-start component:ProductForm
export default function ProductForm(props) {
  // @sf-custom-slot hooks:ProductForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:ProductForm

// @sf-custom-slot section:ProductForm-custom
