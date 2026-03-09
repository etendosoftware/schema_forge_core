import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'code', label: 'Code', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'accountType', label: 'Account Type', type: 'text', required: true },
  { key: 'parentAccount', label: 'Parent Account', type: 'search', reference: 'Account', inputMode: 'search' },
  { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true, readOnly: true },
];

export default function AccountForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
