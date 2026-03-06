import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'description', label: 'Description', type: 'text' },
];

export default function UserForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
