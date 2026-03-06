import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'businessPartner', label: 'Business Partner', type: 'string' },
  { key: 'documentDate', label: 'Document Date', type: 'date' },
  { key: 'returnDate', label: 'Return Date', type: 'date' },
  { key: 'originalShipment', label: 'Original Shipment', type: 'string' },
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'docStatus', label: 'Doc Status', type: 'status' },
  { key: 'totalAmount', label: 'Total Amount', type: 'amount' },
];

const filters = ['businessPartner', 'documentDate', 'originalShipment', 'returnReason', 'documentNo', 'docStatus'];

export default function CustomerReturnTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
