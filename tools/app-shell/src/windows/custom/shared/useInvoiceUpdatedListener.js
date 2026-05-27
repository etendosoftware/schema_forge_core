import { useEffect } from 'react';

export function useInvoiceUpdatedListener(specName, recordId, onProcess) {
  useEffect(() => {
    if (!recordId) return;
    const handleInvoiceUpdated = (event) => {
      if (String(event.detail?.invoiceId) !== String(recordId)) return;
      onProcess?.();
    };
    const eventName = `${specName}:invoice-updated`;
    window.addEventListener(eventName, handleInvoiceUpdated);
    return () => window.removeEventListener(eventName, handleInvoiceUpdated);
  }, [specName, recordId, onProcess]);
}
