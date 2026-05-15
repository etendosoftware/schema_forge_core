import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import GoodsReceiptTable from '@generated/goods-receipt/generated/web/goods-receipt/GoodsReceiptTable';
import GeneratedApp from '@generated/goods-receipt/generated/web/goods-receipt/index.jsx';
import GoodsReceiptBottomPanel from './GoodsReceiptBottomPanel.jsx';
import RelatedDocuments from './RelatedDocuments.jsx';
import { AttachmentsTab } from '@/components/attachments';
import BulkDocumentAction, { buildInOutActions } from '@/components/contract-ui/BulkDocumentAction';
import { useBulkActionToast } from '@/hooks/useBulkActionToast';
import { useUI } from '@/i18n';

const HEADER_COLUMNS = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'string' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'movementDate', column: 'MovementDate', type: 'date', dot: false },
  { key: 'orderReference', column: 'POReference', type: 'string' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status' },
];

function CustomHeaderTable(props) {
  return <GoodsReceiptTable columns={HEADER_COLUMNS} {...props} />;
}

export default function GoodsReceiptWindow(props) {
  useBulkActionToast();
  const ui = useUI();
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
      initialColumnFilters={docStatus ? { documentStatus: docStatus } : undefined}
      secondaryTabs={[]}
      notesField="description"
      bottomSection={GoodsReceiptBottomPanel}
      customTabs={customTabs}
      bulkActions={(ctx) => (
        <BulkDocumentAction {...ctx} entity="goodsReceipt" buildActions={buildInOutActions} />
      )}
    />
  );
}
