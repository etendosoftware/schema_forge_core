import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:returnMaterialReceipt
const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string', label: 'Document No.' },
  { key: 'movementDate', column: 'MovementDate', type: 'date', label: 'Movement Date' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string', label: 'Business Partner' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status', label: 'Document Status' },
];
// @sf-generated-end columns:returnMaterialReceipt

const filters = ['documentNo', 'movementDate', 'businessPartner', 'documentStatus'];

// @sf-generated-start component:ReturnMaterialReceiptTable
export default function ReturnMaterialReceiptTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:ReturnMaterialReceiptTable
