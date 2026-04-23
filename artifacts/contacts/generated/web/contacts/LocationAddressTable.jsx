import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:locationAddress
const columns = [
  { key: 'name', column: 'Name', type: 'string', labels: {"en_US":"Location / Address","es_ES":"Dirección"}, label: 'Name' },
  { key: 'shipToAddress', column: 'IsShipTo', type: 'boolean', labels: {"en_US":"Shipping Address","es_ES":"Dir.envíos"}, label: 'Shipping Address' },
  { key: 'invoiceToAddress', column: 'IsBillTo', type: 'boolean', labels: {"en_US":"Invoicing Address","es_ES":"Dir.factura"}, label: 'Invoicing Address' },
];
// @sf-generated-end columns:locationAddress

const filters = ['name'];

// @sf-generated-start component:LocationAddressTable
export default function LocationAddressTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:LocationAddressTable
