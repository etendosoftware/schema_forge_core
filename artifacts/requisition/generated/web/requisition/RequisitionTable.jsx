import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'dateRequired', column: 'DateRequired', type: 'date' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'string' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'docStatus', column: 'DocStatus', type: 'status' },
  { key: 'totalLines', column: 'TotalLines', type: 'amount' },
  { key: 'grandTotal', column: 'GrandTotal', type: 'amount' },
  { key: 'user', column: 'AD_User_ID', type: 'string' },
];

const filters = ['businessPartner', 'dateRequired', 'description', 'documentNo', 'docStatus'];

export default function RequisitionTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
