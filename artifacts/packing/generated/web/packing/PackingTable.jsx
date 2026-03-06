import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'docStatus', label: 'Doc Status', type: 'status' },
  { key: 'packDate', label: 'Pack Date', type: 'date' },
  { key: 'shipment', label: 'Shipment', type: 'string' },
  { key: 'businessPartner', label: 'Business Partner', type: 'string' },
  { key: 'warehouse', label: 'Warehouse', type: 'string' },
  { key: 'carrier', label: 'Carrier', type: 'string' },
  { key: 'trackingNo', label: 'Tracking No', type: 'string' },
];

const filters = ['documentNo', 'docStatus', 'packDate', 'shipment', 'businessPartner', 'carrier', 'trackingNo'];

export default function PackingTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
