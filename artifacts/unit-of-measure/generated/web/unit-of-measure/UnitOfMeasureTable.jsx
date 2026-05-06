import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:unitOfMeasure
const columns = [
  { key: 'name', column: 'Name', type: 'string', label: 'Name' },
  { key: 'symbol', column: 'UOMSymbol', type: 'string', label: 'Symbol' },
  { key: 'uOMType', column: 'UOM_Type', type: 'enum', label: 'UOM Type', enumLabels: { 'A': 'Area', 'L': 'Length', 'T': 'Time', 'V': 'Volume', 'W': 'Weight' }, enumVariants: {"A":"orange","L":"blue","T":"purple","V":"teal","W":"yellow"} },
];
// @sf-generated-end columns:unitOfMeasure

const filters = ['name'];

// @sf-generated-start component:UnitOfMeasureTable
export default function UnitOfMeasureTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:UnitOfMeasureTable
