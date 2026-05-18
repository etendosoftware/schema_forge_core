import { useCallback } from 'react';

export const INVOICE_DRAFT_MODE = {
  enabled: true,
  processField: 'documentAction',
  processValue: 'CO',
  label: 'Confirm',
  disableWhenEmpty: true,
};

export function buildInvoiceRowQuickActions(navigate, windowName, setCloneTargets, setEmailRow, requestDelete) {
  return {
    enabled: true,
    editMode: 'navigate',
    documentPreview: true,
    actions: {
      edit: { show: true },
      duplicate: { show: true },
      email: { show: true },
      delete: { show: true },
    },
    onEdit: (row) => navigate(`/${windowName}/${row.id}`),
    onClone: (row) => setCloneTargets([row]),
    onEmail: (row) => setEmailRow(row),
    onDelete: requestDelete,
  };
}

export function useClearSavedRecord(setSavedRecord, location, navigate) {
  return useCallback(() => {
    setSavedRecord(null);
    // Clear navigation state so the modal doesn't reappear on browser back/forward
    if (location.state?.savedRecord) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [setSavedRecord, location, navigate]);
}
