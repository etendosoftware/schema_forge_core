import { DataTable } from '@/components/contract-ui';

// 'name' is required=true in the contract but the local flag was never set
// (absent = false) — this is the drift F19 must catch.
const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'searchKey', column: 'Value', type: 'string', required: false },
];

export default function CustomTable(props) {
  return <DataTable columns={columns} {...props} />;
}
