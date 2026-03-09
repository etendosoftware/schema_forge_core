import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'code', label: 'Code', type: 'string' },
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'accountType', label: 'Account Type', type: 'string' },
  { key: 'parentAccount', label: 'Parent Account', type: 'string' },
  { key: 'debit', label: 'Debit', type: 'amount' },
  { key: 'credit', label: 'Credit', type: 'amount' },
  { key: 'balance', label: 'Balance', type: 'amount' },
  { key: 'isActive', label: 'Is Active', type: 'boolean' },
];

const filters = ['code', 'name', 'accountType'];

export default function AccountTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
