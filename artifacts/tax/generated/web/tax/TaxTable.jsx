import { DataTable } from '@/components/contract-ui';

const ScopePills = ({ value }) => {
  const showSales    = value === 'B' || value === 'S';
  const showPurchase = value === 'B' || value === 'P';
  if (!showSales && !showPurchase) return value ?? '';
  return (
    <span className="inline-flex items-center gap-1">
      {showSales    && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Sales</span>}
      {showPurchase && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">Purchase</span>}
    </span>
  );
};

const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  {
    key: 'rate',
    column: 'Rate',
    type: 'number',
    render: (row) => {
      const val = row?.rate;
      if (val == null) return '';
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
          +{val} %
        </span>
      );
    },
  },
  {
    key: 'applicableTo',
    column: 'SOPOType',
    type: 'string',
    render: (row) => <ScopePills value={row?.applicableTo} />,
  },
];

const filters = ['name'];

export default function TaxTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
