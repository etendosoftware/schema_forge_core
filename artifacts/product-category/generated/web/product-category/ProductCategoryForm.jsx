import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'searchKey', label: 'Search Key', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'text' },
];

export default function ProductCategoryForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
