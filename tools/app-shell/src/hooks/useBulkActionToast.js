import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useUI } from '@schema-forge/app-shell-core';

const STORAGE_KEY = 'bulkActionResult';

function normalizeBulkActionResult(result) {
  return {
    ok: Number(result?.ok || 0),
    failed: Array.isArray(result?.failed) ? result.failed : [],
  };
}

function showBulkActionToast(ui, result) {
  const { ok, failed } = normalizeBulkActionResult(result);
  const msg = ui('processExecuted')
    .replace('{ok}', String(ok))
    .replace('{failed}', String(failed.length));
  if (failed.length === 0) {
    toast.success(msg);
  } else if (ok > 0) {
    toast.warning(msg);
  } else {
    toast.error(msg);
  }
}

export function persistBulkActionResult(result) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeBulkActionResult(result)));
}

export function useBulkActionToast() {
  const ui = useUI();

  const showResult = useCallback((result, { persist = false } = {}) => {
    if (persist) {
      persistBulkActionResult(result);
    }
    showBulkActionToast(ui, result);
  }, [ui]);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    sessionStorage.removeItem(STORAGE_KEY);
    let parsed;
    try {
      parsed = JSON.parse(stored);
    } catch {
      return;
    }
    showBulkActionToast(ui, parsed);
  }, [ui]);

  return { showResult };
}
