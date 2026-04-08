import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useMenuLabel } from '@/i18n';
import { Button } from '@/components/ui/button.jsx';
import { useEntity } from '@/hooks/useEntity';
import HeaderTable from '@generated/sales-invoice/generated/web/sales-invoice/HeaderTable';
import HeaderPage from '@generated/sales-invoice/generated/web/sales-invoice/HeaderPage';
import InvoicePreviewModal from '../purchase-invoice/InvoicePreviewModal.jsx';
import InvoiceTopbarExtra from '@generated/sales-invoice/custom/InvoiceTopbarExtra.jsx';
import InvoiceBottomPanel from '@generated/sales-invoice/custom/InvoiceBottomPanel.jsx';
import RelatedDocuments from '@generated/sales-invoice/custom/RelatedDocuments.jsx';
import InvoiceHeaderTable from '@generated/sales-invoice/custom/InvoiceHeaderTable.jsx';

// List view columns for sales invoice
const LIST_COLUMNS = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string', label: 'Document No.' },
  { key: 'invoiceDate', column: 'DateInvoiced', type: 'date', label: 'Invoice Date' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string', label: 'Business Partner' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status', label: 'Status' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount', label: 'Total Gross Amount' },
];

/**
 * SalesInvoiceListView — custom list view with Holded-style preview modal.
 *
 * Clicking a row opens a lateral preview panel instead of navigating away.
 * The "+ New" button navigates to the create route as usual.
 */
function SalesInvoiceListView({ windowName, token, apiBaseUrl, api, ...rest }) {
  const navigate = useNavigate();
  const hook = useEntity('header', null, { token, apiBaseUrl });
  const [previewRow, setPreviewRow] = useState(null);
  const tMenu = useMenuLabel();

  const count = hook.items?.length ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* List header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{tMenu('Sales Invoice')}</h1>
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
        <HeaderTable
          columns={LIST_COLUMNS}
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

      {/* Preview panel */}
      {previewRow && (
        <InvoicePreviewModal
          specName="sales-invoice"
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
 * Main entry point for the sales-invoice custom window.
 *
 * Routing:
 *   - recordId present  → standard HeaderPage (new / edit mode)
 *   - no recordId       → custom list view with lateral preview panel
 */
export default function SalesInvoiceWindow(props) {
  const { recordId, token, apiBaseUrl, windowName } = props;
  const navigate = useNavigate();
  const location = useLocation();
  const [savedRecord, setSavedRecord] = useState(null);

  // Pick up the saved record from navigation state when arriving at the list view
  const effectiveRecord = savedRecord ?? location.state?.savedRecord ?? null;

  const clearSavedRecord = useCallback(() => {
    setSavedRecord(null);
    // Clear navigation state so the panel does not reappear on browser back/forward
    if (location.state?.savedRecord) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  if (recordId) {
    return (
      <HeaderPage
        {...props}
        DetailTable={InvoiceHeaderTable}
        bottomSection={InvoiceBottomPanel}
        topbarRight={InvoiceTopbarExtra}
        notesField="description"
        customTabs={[{ key: 'related', label: 'Related Documents', Component: RelatedDocuments }]}
        onAfterSave={true}
      />
    );
  }

  return (
    <>
      <SalesInvoiceListView {...props} />
      {effectiveRecord && (
        <InvoicePreviewModal
          specName="sales-invoice"
          invoice={effectiveRecord}
          token={token}
          apiBaseUrl={apiBaseUrl}
          windowName={windowName}
          onClose={clearSavedRecord}
          onEdit={(id) => {
            clearSavedRecord();
            navigate(`/${windowName}/${id}`);
          }}
        />
      )}
    </>
  );
}
