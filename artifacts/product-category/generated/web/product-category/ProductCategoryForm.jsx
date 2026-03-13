import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:productCategory
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'searchKey', column: 'Value', type: 'text', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:productCategory

// @sf-generated-start component:ProductCategoryForm
export default function ProductCategoryForm(props) {
  // @sf-custom-slot hooks:ProductCategoryForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:ProductCategoryForm

// @sf-custom-slot section:ProductCategoryForm-custom
