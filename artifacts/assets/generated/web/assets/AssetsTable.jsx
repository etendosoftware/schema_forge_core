import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

function renderDepreciationProgress(row) {
  const depreciatedValue = row.depreciatedValue ?? 0;
  const depreciatedPlan = row.depreciatedPlan ?? 0;
  const depreciationAmt = row.depreciationAmt ?? 0;
  const denominator = depreciatedPlan > 0 ? depreciatedPlan : depreciationAmt;
  const pct = denominator > 0
    ? Math.min(100, Math.round((depreciatedValue / denominator) * 100))
    : (depreciatedValue > 0 ? 100 : null);
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
  { key: 'depreciationAmt', column: 'Amortizationvalueamt', type: 'amount', label: 'Depreciation Amt.', summable: true },
  { key: 'depreciatedValue', column: 'Depreciatedvalue', type: 'amount', label: 'Depreciated Value', summable: true },
  { key: 'fullyDepreciated', column: 'IsFullyDepreciated', type: 'status', label: 'Fully Depreciated', enumLabels: { 'true': 'assetsFullyDepreciated', 'false': 'assetsStillInProgress' }, render: renderDepreciationProgress, required: true, filterable: false },
];
// @sf-generated-end columns:assets

const filters = ['searchKey', 'name', 'assetCategory', 'depreciate', 'fullyDepreciated'];

// @sf-generated-start component:AssetsTable
const AssetsTable = forwardRef(function AssetsTable(props, ref) {
  // Inline-editable layout always uses InlineLinesPanel for existing rows so column
  // widths (flex layout) never shift when the add-row form opens. When addRow is
  // active we render a header-hidden, data-hidden DataTable below for just the
  // add-row form — it owns callouts, selectors, validation and the imperative flush
  // ref. The ref is forwarded to InlineLinesPanel so DetailView can flush pending
  // inline edits on global save.
  if (props.linesLayout === 'inlineEditable') {
    if (props.addRow?.active) {
      return (
        <>
          <InlineLinesPanel ref={ref} columns={columns} {...props} addRow={undefined} />
          <DataTable columns={columns} filters={filters} {...props} hideHeader hideDataRows />
        </>
      );
    }
    return <InlineLinesPanel ref={ref} columns={columns} {...props} />;
  }
  return <DataTable columns={columns} filters={filters} {...props} />;
});

export default AssetsTable;
// @sf-generated-end component:AssetsTable
