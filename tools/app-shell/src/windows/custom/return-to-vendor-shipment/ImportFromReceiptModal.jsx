import ImportReturnLinesModal from '@/components/import-return-lines/ImportReturnLinesModal';

const ACTION_BASE = (base) =>
  `${base}/return-to-vendor-shipment/returnToVendorShipment/_/action`;

const RECEIPT_CONFIG = {
  fetchSourceDocs: async (base, bpId, headers) => {
    const res = await fetch(`${ACTION_BASE(base)}/availableReceipts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ businessPartner: bpId }),
    });
    if (!res.ok) return [];
    return (await res.json())?.response?.data || [];
  },
  fetchSourceLines: async (base, docId, headers) => {
    const res = await fetch(`${ACTION_BASE(base)}/availableReceiptLines`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ receiptId: docId }),
    });
    if (!res.ok) return [];
    return (await res.json())?.response?.data || [];
  },
  importActionUrl: (base, targetId) =>
    `${base}/return-to-vendor-shipment/returnToVendorShipment/${targetId}/action/importReceiptLines`,
  titleKey: 'importFromReceipt',
  searchPlaceholderKey: 'searchReceipt',
  noDocsKey: 'noCompletedReceiptsForThisVendor',
  noDocsMatchSearchKey: 'noReceiptsMatchYourSearch',
  successToastKey: 'linesImportedFromReceipt',
  dateField: 'movementDate',
  showAmount: false,
  qtyStep: 1,
};

export default function ImportFromReceiptModal(props) {
  return <ImportReturnLinesModal {...props} config={RECEIPT_CONFIG} />;
}
