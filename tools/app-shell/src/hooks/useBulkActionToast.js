import { useEffect } from 'react';
import { toast } from 'sonner';
import { useUI } from '@/i18n';

const STORAGE_KEY = 'bulkActionResult';

export function useBulkActionToast() {
  const ui = useUI();
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    sessionStorage.removeItem(STORAGE_KEY);
    const { ok, failed } = JSON.parse(stored);
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
  }, []);
}
