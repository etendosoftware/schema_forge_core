import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:returnMaterial
const columns = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'documentDate', column: 'DateOrdered', type: 'date' },
  { key: 'returnDate', column: 'DateDelivered', type: 'date' },
  { key: 'originalReceipt', column: 'InOut_ID', type: 'string' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'docStatus', column: 'DocStatus', type: 'status' },
  { key: 'totalAmount', column: 'Amt', type: 'amount' },
];
// @sf-generated-end columns:returnMaterial

const filters = ['businessPartner', 'documentDate', 'originalReceipt', 'returnReason', 'documentNo', 'docStatus'];

// @sf-generated-start component:ReturnMaterialTable
export default function ReturnMaterialTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:ReturnMaterialTable
