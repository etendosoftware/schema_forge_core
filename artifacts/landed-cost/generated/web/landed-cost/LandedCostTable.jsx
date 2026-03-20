import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'organization', column: 'AD_Org_ID', type: 'string' },
  { key: 'dateAcct', column: 'DateAcct', type: 'date' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'docStatus', column: 'DocStatus', type: 'status' },
];

const filters = ['organization', 'dateAcct', 'description', 'documentNo', 'docStatus'];

export default function LandedCostTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
