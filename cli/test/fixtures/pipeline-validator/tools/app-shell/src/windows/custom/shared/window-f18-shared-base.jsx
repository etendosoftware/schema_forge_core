// Mirrors the real PaymentHeaderTableBase.jsx pattern: a single columns array
// shared by more than one window via thin prop-passing wrappers under
// artifacts/<window>/custom/. Not keyed to any one window — F18 only pulls
// this file in for a window whose own custom files actually import it.
import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', column: 'Name', type: 'string', required: true },
];

export default function SharedBase(props) {
  return <DataTable columns={columns} {...props} />;
}
