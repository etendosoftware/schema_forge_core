import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

function renderDepreciationProgress(row) {
  const pct = row.assetValue > 0
    ? Math.min(100, Math.round(((row.depreciatedValue ?? 0) / row.assetValue) * 100))
    : null;
  if (pct == null) return null;
  const color = pct === 100 ? '#10b981' : '#f59e0b';
  return (
    <div className="flex items-center gap-1.5" style={{ minWidth: 80 }}>
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs tabular-nums w-8 text-right" style={{ color: '#6b7280' }}>{pct}%</span>
    </div>
  );
}

// @sf-generated-start columns:assets
const columns = [
  { key: 'name', column: 'Name', type: 'string', label: 'Name', required: true },
  { key: 'assetCategory', column: 'A_Asset_Group_ID', type: 'selector', label: 'Asset Category', required: true },
  { key: 'purchaseDate', column: 'Datepurchased', type: 'date', label: 'Purchase Date' },
  { key: 'depreciationStartDate', column: 'Amortizationstartdate', type: 'date', label: 'Depreciation Start Date' },
  { key: 'assetValue', column: 'AssetValueAmt', type: 'amount', label: 'Asset Value', summable: true },
  { key: 'depreciatedValue', column: 'Depreciatedvalue', type: 'amount', label: 'Depreciated Value', summable: true },
  { key: 'fullyDepreciated', column: 'IsFullyDepreciated', type: 'boolean', label: 'Fully Depreciated', render: renderDepreciationProgress, required: true },
];
// @sf-generated-end columns:assets

const filters = ['searchKey', 'name', 'assetCategory', 'depreciate', 'fullyDepreciated'];

// @sf-generated-start component:AssetsTable
const AssetsTable = forwardRef(function AssetsTable(props, ref) {
  // Inline-editable layout owns rendering of the existing rows. The add-line flow keeps
  // using the proven DataTable inline-add row (callouts, focus management, defaults) —
  // when addRow.active flips on, we hand off to DataTable so the user can fill the new
  // line, then return to InlineLinesPanel once addRow.active flips off again. The ref
  // is forwarded so DetailView can imperatively flush pending edits on global save.
  if (props.linesLayout === 'inlineEditable' && !props.addRow?.active) {
    return <InlineLinesPanel ref={ref} columns={columns} {...props} />;
  }
  return <DataTable columns={columns} filters={filters} {...props} />;
});

export default AssetsTable;
// @sf-generated-end component:AssetsTable
