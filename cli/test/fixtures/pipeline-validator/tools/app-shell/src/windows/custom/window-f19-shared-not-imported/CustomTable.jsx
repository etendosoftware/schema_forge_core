// Does NOT import shared/window-f19-shared-base.jsx — this window renders its
// own table with no shared component. Its contract's 'name' field
// intentionally disagrees with the shared base's required:true for 'name'
// (this contract has required:false), to prove that field is never checked
// here: nothing in this window's custom files imports the shared file, so
// the one-hop shared/ resolution must never pull it in for this window.
import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'description', column: 'Description', type: 'string', required: true },
];

export default function CustomTable(props) {
  return <DataTable columns={columns} {...props} />;
}
