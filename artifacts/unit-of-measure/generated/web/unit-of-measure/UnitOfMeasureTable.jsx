import { DataTable } from '@/components/contract-ui';

const TYPE_LABELS = { A: 'Área', L: 'Longitud', T: 'Tiempo', V: 'Volumen', W: 'Peso' };
const TYPE_COLORS = {
  A: 'bg-orange-100 text-orange-700',
  L: 'bg-blue-100 text-blue-700',
  T: 'bg-purple-100 text-purple-700',
  V: 'bg-cyan-100 text-cyan-700',
  W: 'bg-amber-100 text-amber-700',
};

const TypeBadge = ({ value }) => {
  if (!value) return null;
  const label = TYPE_LABELS[value] ?? value;
  const color = TYPE_COLORS[value] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
};

// @sf-generated-start columns:unitOfMeasure
const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'symbol', column: 'UOMSymbol', type: 'string' },
  { key: 'uOMType', column: 'UOM_Type', type: 'string', render: (row) => <TypeBadge value={row?.uOMType} /> },
  { key: 'isActive', column: 'IsActive', type: 'boolean' },
];
// @sf-generated-end columns:unitOfMeasure

const filters = ['name'];

// @sf-generated-start component:UnitOfMeasureTable
export default function UnitOfMeasureTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:UnitOfMeasureTable
