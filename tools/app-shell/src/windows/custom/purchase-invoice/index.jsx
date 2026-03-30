import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { useEntity } from '@/hooks/useEntity';
import InvoiceTable from '@generated/purchase-invoice/generated/web/purchase-invoice/InvoiceTable';
import InvoicePage from '@generated/purchase-invoice/generated/web/purchase-invoice/InvoicePage';
import InvoicePreviewModal from './InvoicePreviewModal.jsx';

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
  const { recordId } = props;

  if (recordId) {
    // Edit / new mode — delegate to the standard generated page
    return <InvoicePage {...props} />;
  }

  return <PurchaseInvoiceListView {...props} />;
}
