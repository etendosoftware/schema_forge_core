import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'documentDate', column: 'DateOrdered', type: 'date' },
  { key: 'returnDate', column: 'DateDelivered', type: 'date' },
  { key: 'originalShipment', column: 'InOut_ID', type: 'string' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'docStatus', column: 'DocStatus', type: 'status' },
  { key: 'totalAmount', column: 'Amt', type: 'amount' },
];

const filters = ['businessPartner', 'documentDate', 'originalShipment', 'returnReason', 'documentNo', 'docStatus'];

export default function CustomerReturnTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
