import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:unitOfMeasure
const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'symbol', column: 'UOMSymbol', type: 'string' },
  { key: 'uOMType', column: 'UOM_Type', type: 'enum', enumLabels: { 'A': 'uomTypeArea', 'L': 'uomTypeLength', 'T': 'uomTypeTime', 'V': 'uomTypeVolume', 'W': 'uomTypeWeight' }, enumVariants: { 'A': 'orange', 'L': 'blue', 'T': 'purple', 'V': 'teal', 'W': 'yellow' } },
];
// @sf-generated-end columns:unitOfMeasure

const filters = ['name'];

// @sf-generated-start component:UnitOfMeasureTable
export default function UnitOfMeasureTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:UnitOfMeasureTable
