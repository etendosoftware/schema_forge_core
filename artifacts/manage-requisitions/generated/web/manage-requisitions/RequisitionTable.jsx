import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'docStatus', column: 'DocStatus', type: 'status' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'dateRequired', column: 'DateRequired', type: 'date' },
  { key: 'dateDoc', column: 'DateDoc', type: 'date' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'string' },
  { key: 'totalLines', column: 'TotalLines', type: 'amount' },
  { key: 'grandTotal', column: 'GrandTotal', type: 'amount' },
  { key: 'user', column: 'AD_User_ID', type: 'string' },
  { key: 'organization', column: 'AD_Org_ID', type: 'string' },
  { key: 'cCurrencyId', column: 'C_Currency_ID', type: 'string' },
];

const filters = ['documentNo', 'docStatus', 'businessPartner', 'dateRequired', 'dateDoc', 'warehouse', 'user', 'organization', 'description'];

export default function RequisitionTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
