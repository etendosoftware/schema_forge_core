import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { useEntity } from '@/hooks/useEntity';
import InvoiceTable from '@generated/purchase-invoice/generated/web/purchase-invoice/InvoiceTable';
import InvoicePage from '@generated/purchase-invoice/generated/web/purchase-invoice/InvoicePage';
import InvoiceTaxTable from '@generated/purchase-invoice/generated/web/purchase-invoice/InvoiceTaxTable';
import BasicDiscountsTable from '@generated/purchase-invoice/generated/web/purchase-invoice/BasicDiscountsTable';
import InvoiceLineTableCustom from './InvoiceLineTableCustom.jsx';
import PaymentDetailsPanelCustom from './PaymentDetailsPanelCustom.jsx';
import InvoicePreviewModal from './InvoicePreviewModal.jsx';

// Secondary tabs: Tax, Basic Discounts, Payment Details (no Payment Plan / Reversed Invoices / Accounting)
const SECONDARY_TABS = [
  { key: 'invoiceTax', label: 'Tax', Table: InvoiceTaxTable },
  { key: 'basicDiscounts', label: 'Basic Discounts', Table: BasicDiscountsTable },
  { key: 'paymentDetails', label: 'Payment Details', Panel: PaymentDetailsPanelCustom },
];

// Payment status badges: shows Pending (orange) or Paid (green) based on paymentComplete field
const EXTRA_BADGES = [
  { key: 'paymentComplete', when: false, prefix: 'Payment Status', label: 'Pending', style: 'warning' },
  { key: 'paymentComplete', when: true,  prefix: 'Payment Status', label: 'Paid',    style: 'success' },
];

// Summary bar: only the four relevant totals
const SUMMARY = [
  { key: 'summedLineAmount', column: 'TotalLines', type: 'amount', label: 'Total Net Amount' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount', label: 'Total Gross Amount' },
  { key: 'totalPaid', column: 'Totalpaid', type: 'amount', label: 'Paid Amount' },
  { key: 'outstandingAmount', column: 'OutstandingAmt', type: 'amount', label: 'Outstanding Amount' },
];

/**
 * PurchaseInvoiceListView — custom list view with Holded-style preview modal.
 *
 * Clicking a row opens a preview modal instead of navigating away.
 * The "+ New" button navigates to the create route as usual.
 */
function PurchaseInvoiceListView({ windowName, token, apiBaseUrl, api, ...rest }) {
  const navigate = useNavigate();
  const hook = useEntity('invoice', null, { token, apiBaseUrl });
  const [previewRow, setPreviewRow] = useState(null);

  const count = hook.items?.length ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* List header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">Purchase Invoices</h1>
          {count > 0 && (
            <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Search placeholder */}
          <input
            type="text"
            placeholder="Search invoices..."
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            disabled
          />
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => navigate(`/${windowName}/new`)}
          >
            <Plus size={14} />
            New
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <InvoiceTable
          data={hook.items}
          loading={hook.loading}
          loadingMore={hook.loadingMore}
          sortColumn={hook.sortColumn}
          sortDirection={hook.sortDirection}
          token={token}
          apiBaseUrl={apiBaseUrl}
          windowName={windowName}
          onNavigate={(row) => setPreviewRow(row)}
        />
      </div>

      {/* Preview modal */}
      {previewRow && (
        <InvoicePreviewModal
          invoice={previewRow}
          token={token}
          apiBaseUrl={apiBaseUrl}
          windowName={windowName}
          onClose={() => setPreviewRow(null)}
          onEdit={(id) => {
            setPreviewRow(null);
            navigate(`/${windowName}/${id}`);
          }}
        />
      )}
    </div>
  );
}

/**
 * Main entry point for the purchase-invoice custom window.
 *
 * Routing:
 *   - recordId present  → standard InvoicePage (new / edit mode)
 *   - no recordId       → custom list view with preview modal
 */
export default function PurchaseInvoiceWindow(props) {
  const { recordId, token, apiBaseUrl, windowName } = props;
  const navigate = useNavigate();
  const [savedRecord, setSavedRecord] = useState(null);

  const handleAfterSave = useCallback((record) => {
    if (record) setSavedRecord(record);
  }, []);

  if (recordId) {
    return (
      <>
        <InvoicePage
          {...props}
          DetailTable={InvoiceLineTableCustom}
          secondaryTabs={SECONDARY_TABS}
          summary={SUMMARY}
          extraBadges={EXTRA_BADGES}
          statusFieldLabel="Document Status"
          onAfterSave={handleAfterSave}
        />
        {savedRecord && (
          <InvoicePreviewModal
            invoice={savedRecord}
            token={token}
            apiBaseUrl={apiBaseUrl}
            windowName={windowName}
            onClose={() => setSavedRecord(null)}
            onEdit={(id) => {
              setSavedRecord(null);
              navigate(`/${windowName}/${id}`);
            }}
          />
        )}
      </>
    );
  }

  return <PurchaseInvoiceListView {...props} />;
}
