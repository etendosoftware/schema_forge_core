import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'organization', column: 'AD_Org_ID', type: 'string' },
  { key: 'documentDate', column: 'DateAcct', type: 'date' },
  { key: 'referenceNo', column: 'ReferenceNo', type: 'string' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'docStatus', column: 'DocStatus', type: 'status' },
];

const filters = ['organization', 'documentDate', 'description', 'referenceNo', 'documentNo', 'docStatus'];

export default function CostAdjustmentTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
