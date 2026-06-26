import { EntityForm } from '@/components/contract-ui';
import AccountCodeField from '../../../custom/AccountCodeField';

// @sf-generated-start fields:elementValue
const fields = [
  { key: 'searchKey', column: 'Value', type: 'text', label: 'Search Key', required: true, section: 'principal', customRenderer: AccountCodeField },
  { key: 'name', column: 'Name', type: 'text', label: 'Name', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'principal' },
  { key: 'accountType', column: 'AccountType', type: 'select', label: 'Account Type', required: true, section: 'principal', options: [{ value: 'A', label: 'Asset' }, { value: 'E', label: 'Expense' }, { value: 'L', label: 'Liability' }, { value: 'M', label: 'Memo' }, { value: 'O', label: 'Owner\'s Equity' }, { value: 'R', label: 'Revenue' }], defaultValue: 'E' },
  { key: 'active', column: 'IsActive', type: 'checkbox', label: 'Active', required: true, readOnly: true, section: 'other', defaultValue: 'Y' },
];
// @sf-generated-end fields:elementValue

// @sf-generated-start component:ElementValueForm
export default function ElementValueForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:ElementValueForm
