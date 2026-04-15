import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:returnShipment
const columns = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'movementDate', column: 'MovementDate', type: 'date' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'string' },
  { key: 'returnReason', column: 'M_RMA_ID', type: 'string' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'docStatus', column: 'DocStatus', type: 'status' },
];
// @sf-generated-end columns:returnShipment

const filters = ['businessPartner', 'movementDate', 'warehouse', 'returnReason', 'orderReference', 'poReference', 'documentNo', 'docStatus'];

// @sf-generated-start component:ReturnShipmentTable
export default function ReturnShipmentTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:ReturnShipmentTable
