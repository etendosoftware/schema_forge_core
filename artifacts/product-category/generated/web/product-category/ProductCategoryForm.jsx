import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'searchKey', column: 'Value', type: 'text', required: true },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true },
];

export default function ProductCategoryForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
