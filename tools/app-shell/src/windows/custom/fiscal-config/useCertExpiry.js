import { useState, useEffect } from 'react';
import { neoBase } from '@/components/related-documents/helpers.js';
import { daysUntil } from './certExpiryUtils.js';

export { daysUntil };

export function useCertExpiry(orgId, token, apiBaseUrl, { mockDaysLeft = null } = {}) {
  const [daysLeft, setDaysLeft] = useState(null);

  useEffect(() => {
    if (mockDaysLeft !== null) {
      setDaysLeft(mockDaysLeft);
      return;
    }
    if (!orgId || !token) {
      setDaysLeft(null);
      return;
    }
    setDaysLeft(null);
    const controller = new AbortController();
    fetch(`${neoBase(apiBaseUrl)}/certificate?orgId=${encodeURIComponent(orgId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(data => {
        if (controller.signal.aborted) return;
        if (data?.exists && data?.validTo) {
          setDaysLeft(daysUntil(data.validTo));
        } else {
          setDaysLeft(null);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [orgId, token, apiBaseUrl, mockDaysLeft]);

  return { daysLeft };
}
