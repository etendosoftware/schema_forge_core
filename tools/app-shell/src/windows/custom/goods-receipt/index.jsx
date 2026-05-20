import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import GoodsReceiptTable from '@generated/goods-receipt/generated/web/goods-receipt/GoodsReceiptTable';
import GeneratedApp from '@generated/goods-receipt/generated/web/goods-receipt/index.jsx';
import GoodsReceiptBottomPanel from './GoodsReceiptBottomPanel.jsx';
import GoodsReceiptPreview from './GoodsReceiptPreview.jsx';
import RelatedDocuments from './RelatedDocuments.jsx';
import { AttachmentsTab } from '@/components/attachments';
import BulkDocumentAction, { buildInOutActions } from '@/components/contract-ui/BulkDocumentAction';
import { useBulkActionToast } from '@/hooks/useBulkActionToast';
import { useUI } from '@/i18n';

const HEADER_COLUMNS = [
  { key: 'movementDate', column: 'MovementDate', type: 'date', dot: false },
  { key: 'orderReference', column: 'POReference', type: 'string' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector' },
  { key: 'invoiceStatus', column: 'InvoiceStatus', type: 'percent' },
];

const LABEL_OVERRIDES = {
  es_ES: {
    MovementDate: 'Fecha del movimiento',
    POReference: 'Nº documento',
    C_BPartner_ID: 'Contacto',
    DocStatus: 'Estado doc.',
    M_Warehouse_ID: 'Almacén',
    InvoiceStatus: 'Estado de facturación',
  },
  en_US: {
    MovementDate: 'Movement Date',
    POReference: 'Document No.',
    C_BPartner_ID: 'Contact',
    DocStatus: 'Document Status',
    M_Warehouse_ID: 'Warehouse',
    InvoiceStatus: 'Invoice Status',
  },
};

function CustomHeaderTable(props) {
  return <GoodsReceiptTable columns={HEADER_COLUMNS} {...props} />;
}

export default function GoodsReceiptWindow(props) {
  useBulkActionToast();
  const ui = useUI();
  const { token, apiBaseUrl, windowName } = props;
  const [searchParams] = useSearchParams();
  const docStatus = searchParams.get('DocStatus') || undefined;
  const customTabs = useMemo(() => ([
    { key: 'related', label: ui('relatedDocuments'), Component: RelatedDocuments },
    { key: 'attachments', labelKey: 'attachments', Component: AttachmentsTab, placement: 'tab', props: { tableName: 'M_InOut', config: {} } },
  ]), [ui]);
  return (
    <GeneratedApp
      {...props}
      Table={CustomHeaderTable}
      labelOverrides={LABEL_OVERRIDES}
      initialColumnFilters={docStatus ? { documentStatus: { mode: 'enumLabel', value: [docStatus] } } : undefined}
      secondaryTabs={[]}
      notesField="description"
      bottomSection={GoodsReceiptBottomPanel}
      customTabs={customTabs}
      bulkActions={(ctx) => (
        <BulkDocumentAction {...ctx} entity="goodsReceipt" buildActions={buildInOutActions} />
      )}
      renderPreview={({ row, onClose, onEdit }) => (
        <GoodsReceiptPreview
          receipt={row}
          token={token}
          apiBaseUrl={apiBaseUrl}
          windowName={windowName}
          onClose={onClose}
          onEdit={onEdit}
        />
      )}
    />
  );
}
