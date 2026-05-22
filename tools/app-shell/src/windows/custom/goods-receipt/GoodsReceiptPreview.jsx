import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { useUI, useLocaleSwitch, useMenuLabel } from '@/i18n';
import { formatCalendarDate } from '@/lib/dateOnly';
import { getStatusPillClass, statusLabel } from '@/lib/statusBadge.js';
import GenericPreviewModal, { EmptyPanel } from '@/windows/custom/shared/GenericPreviewModal.jsx';
import SendDocumentModal from '@/components/contract-ui/SendDocumentModal.jsx';

function SectionCard({ title, children }) {
  if (title) {
    return (
      <div className="mx-4 mt-5">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">{title}</span>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden px-4 py-2">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="mx-4 mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden px-4 py-2">
      {children}
    </div>
  );
}

function InfoRow({ label, value, link }) {
  return (
    <div className="flex justify-between items-center py-1.5 text-sm">
      <span className="text-gray-400">{label}</span>
      {link
        ? <a href={link} className="text-gray-900 font-medium text-right max-w-[55%] truncate underline decoration-gray-400 hover:decoration-gray-900">{value ?? '—'}</a>
        : <span className="text-gray-900 font-medium text-right max-w-[55%] truncate">{value ?? '—'}</span>
      }
    </div>
  );
}

function StatusBadge({ status, ui }) {
  const pillClass = getStatusPillClass(status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${pillClass}`}>
      {statusLabel(status, null, ui) ?? status}
    </span>
  );
}

function GeneralTab({ receipt, ui }) {
  const { locale } = useLocaleSwitch();
  const movementDate = receipt.movementDate
    ? formatCalendarDate(receipt.movementDate, locale)
    : '—';
  const originLabel = receipt.salesOrder$_identifier ?? null;
  const originLink = receipt.salesOrder ? `#/purchase-order/${receipt.salesOrder}` : null;

  return (
    <div className="pb-4">
      <SectionCard>
        <InfoRow label={ui('invoicePreviewDocumentNumber')} value={receipt.documentNo} />
        <InfoRow
          label={ui('goodsReceiptPreview.supplier')}
          value={receipt.businessPartner$_identifier ?? receipt.businessPartner}
        />
        <InfoRow
          label={ui('goodsReceiptPreview.warehouse')}
          value={receipt.warehouse$_identifier ?? receipt.warehouse}
        />
        <InfoRow label={ui('goodsReceiptPreview.movementDate')} value={movementDate} />
        <div className="flex justify-between items-center py-1.5 text-sm">
          <span className="text-gray-400">{ui('invoicePreviewStatus')}</span>
          <StatusBadge status={receipt.documentStatus} ui={ui} />
        </div>
      </SectionCard>
      {originLabel && (
        <SectionCard title={ui('goodsReceiptPreview.originOrder')}>
          <div className="py-1.5">
            {originLink
              ? <a href={originLink} className="text-sm font-medium text-blue-600 hover:underline break-all">{originLabel}</a>
              : <span className="text-sm text-gray-900">{originLabel}</span>
            }
          </div>
        </SectionCard>
      )}
    </div>
  );
}

export default function GoodsReceiptPreview({ receipt, token, apiBaseUrl, onClose, onEdit }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const [showSend, setShowSend] = useState(false);

  if (!receipt) return null;

  const isCompleted = receipt.documentStatus === 'CO';

  const windowLabel = tMenu('Goods Receipt');
  const docRef = receipt.orderReference || receipt.documentNo || '—';
  const title = `${windowLabel} ${docRef}`;
  const subtitle = receipt.businessPartner$_identifier ?? undefined;

  const attachmentConfig = {
    documentId: receipt.id,
    specName: 'goods-receipt',
    storeCondition: true,
    autoFetch: false,
    token,
    apiBaseUrl,
  };

  const tabs = [
    {
      key: 'general',
      label: ui('invoicePreviewGeneral'),
      content: <GeneralTab receipt={receipt} ui={ui} />,
    },
    {
      key: 'messages',
      label: ui('invoicePreviewMessages'),
      content: <EmptyPanel icon="💬" text={ui('invoicePreviewNoMessagesYet')} />,
    },
    {
      key: 'history',
      label: ui('invoicePreviewHistory'),
      content: <EmptyPanel icon="🕐" text={ui('invoicePreviewNoActivityRecorded')} />,
    },
  ];

  const actionButtons = ({ triggerEdit }) => (
    <>
      {isCompleted && (
        <Button
          size="sm"
          className="gap-1 px-2 py-1 h-8 rounded-lg text-sm font-medium bg-[#121217] hover:bg-[#2a2a30] text-white [&_svg]:size-5"
          onClick={() => setShowSend(true)}
        >
          <Mail />
          {ui('invoicePreviewSend')}
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        className="gap-1 px-2 py-1 h-8 rounded-lg text-sm font-medium bg-white border-[#D1D4DB] shadow-sm text-[#121217] [&_svg]:size-5"
        onClick={triggerEdit}
      >
        <Edit2 className="text-[#828FA3]" />
        {ui('invoicePreviewEdit')}
      </Button>
    </>
  );

  return (
    <>
      <GenericPreviewModal
        title={title}
        subtitle={subtitle}
        attachmentConfig={attachmentConfig}
        onClose={onClose}
        onEdit={() => onEdit?.(receipt.id)}
        tabs={tabs}
        actionButtons={actionButtons}
      />
      {showSend && createPortal(
        <SendDocumentModal
          documentType={tMenu('Goods Receipt')}
          documentNo={receipt.documentNo}
          bpName={receipt['businessPartner$_identifier']}
          bPartnerId={receipt.businessPartner}
          apiBaseUrl={apiBaseUrl}
          documentId={receipt.id}
          windowName="goods-receipt"
          token={token}
          onClose={() => setShowSend(false)}
        />,
        document.body,
      )}
    </>
  );
}
