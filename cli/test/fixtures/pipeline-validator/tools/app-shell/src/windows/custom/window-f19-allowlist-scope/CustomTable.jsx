// Same drifted key ('asset') and same shape as window-f19-allowlisted, but a
// DIFFERENT artifact. The F19 allowlist entry for
// { artifact: "window-f19-allowlisted", key: "asset" } must NOT suppress this
// window's drift — the allowlist scopes by (artifact, key) pair, not by key
// alone.
import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'asset', column: 'A_Asset_ID', type: 'selector', required: true },
];

export default function CustomTable(props) {
  return <DataTable columns={columns} {...props} />;
}
