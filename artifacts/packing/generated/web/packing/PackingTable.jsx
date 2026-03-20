import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'docStatus', column: 'DocStatus', type: 'status' },
  { key: 'packDate', column: 'PackDate', type: 'date' },
  { key: 'shipment', column: 'M_InOut_ID', type: 'string' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'string' },
  { key: 'carrier', column: 'Carrier', type: 'string' },
  { key: 'trackingNo', column: 'TrackingNo', type: 'string' },
];

const filters = ['documentNo', 'docStatus', 'packDate', 'shipment', 'businessPartner', 'carrier', 'trackingNo'];

export default function PackingTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
