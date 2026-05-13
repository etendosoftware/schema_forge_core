import { useState, useEffect } from 'react';
import { neoBase } from '@/components/related-documents/helpers.js';

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / 86_400_000);
}

export function useCertExpiry(orgId, token, apiBaseUrl, { mockDaysLeft = null } = {}) {
  const [daysLeft, setDaysLeft] = useState(null);

  useEffect(() => {
    if (mockDaysLeft !== null) {
      setDaysLeft(mockDaysLeft);
      return;
    }
    if (!orgId || !token) return;
    fetch(`${neoBase(apiBaseUrl)}/certificate?orgId=${encodeURIComponent(orgId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data?.exists && data?.validTo) setDaysLeft(daysUntil(data.validTo));
      })
      .catch(() => {});
  }, [orgId, token, apiBaseUrl, mockDaysLeft]);

  return { daysLeft };
}
