import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'email', column: 'EMail', type: 'text' },
  { key: 'phone', column: 'Phone', type: 'text' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true },
];

export default function UserForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
