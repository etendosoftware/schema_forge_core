import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'organization', label: 'Organization', type: 'string' },
  { key: 'documentDate', label: 'Document Date', type: 'date' },
  { key: 'referenceNo', label: 'Reference No', type: 'string' },
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'docStatus', label: 'Doc Status', type: 'status' },
];

const filters = ['organization', 'documentDate', 'description', 'referenceNo', 'documentNo', 'docStatus'];

export default function CostAdjustmentTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
