import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'movementDate', column: 'MovementDate', type: 'date' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'string' },
  { key: 'returnReason', column: 'M_RMA_ID', type: 'string' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'docStatus', column: 'DocStatus', type: 'status' },
];

const filters = ['businessPartner', 'movementDate', 'warehouse', 'returnReason', 'orderReference', 'poReference', 'documentNo', 'docStatus'];

export default function ReturnReceiptTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
