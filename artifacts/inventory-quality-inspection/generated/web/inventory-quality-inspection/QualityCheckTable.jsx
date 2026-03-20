import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'string' },
  { key: 'inspectionDate', column: 'InspectionDate', type: 'date' },
  { key: 'result', column: 'Result', type: 'string' },
  { key: 'inspector', column: 'Inspector', type: 'string' },
  { key: 'quantityInspected', column: 'QtyInspected', type: 'number' },
  { key: 'quantityAccepted', column: 'QtyAccepted', type: 'number' },
  { key: 'quantityRejected', column: 'QtyRejected', type: 'number' },
  { key: 'docStatus', column: 'DocStatus', type: 'status' },
];

const filters = ['documentNo', 'product', 'warehouse', 'inspectionDate', 'result', 'inspector', 'docStatus'];

export default function QualityCheckTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
