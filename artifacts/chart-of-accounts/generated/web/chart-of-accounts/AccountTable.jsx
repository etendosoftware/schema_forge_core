import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'code', column: 'Code', type: 'string' },
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'accountType', column: 'AccountType', type: 'string' },
  { key: 'parentAccount', column: 'Parent_ID', type: 'string' },
  { key: 'debit', column: 'Debit', type: 'amount' },
  { key: 'credit', column: 'Credit', type: 'amount' },
  { key: 'balance', column: 'Balance', type: 'amount' },
  { key: 'isActive', column: 'IsActive', type: 'boolean' },
];

const filters = ['code', 'name', 'accountType'];

export default function AccountTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
