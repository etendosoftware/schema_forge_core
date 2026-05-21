import { useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useSavedPreviewRecord() {
  const location = useLocation();
  const navigate = useNavigate();
  const [savedRecord, setSavedRecord] = useState(null);
  const effectiveRecord = savedRecord ?? location.state?.savedRecord ?? null;
  const clearSavedRecord = useCallback(() => {
    setSavedRecord(null);
    if (location.state?.savedRecord) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);
  return { effectiveRecord, clearSavedRecord };
}
