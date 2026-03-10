import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'code', column: 'Code', type: 'text', required: true },
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'accountType', column: 'AccountType', type: 'text', required: true },
  { key: 'parentAccount', column: 'Parent_ID', type: 'search', reference: 'Account', inputMode: 'search' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true },
];

export default function AccountForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
