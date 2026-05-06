import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useUI } from '@/i18n';
import { neoBase } from '@/components/related-documents/helpers.js';
import CertModal from './CertModal.jsx';

export default function CertSection({ context, orgId, token, apiBaseUrl }) {
  const ui = useUI();
  const [cert, setCert]   = useState(null);
  const [open, setOpen]   = useState(false);

  useEffect(() => {
    if (!orgId || !token) return;
    fetch(`${neoBase(apiBaseUrl)}/certificate?orgId=${encodeURIComponent(orgId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data?.exists) setCert({ name: ui('fiscal.cert.loaded'), validTo: data.validTo ?? '' });
      })
      .catch(() => {});
  }, [orgId, token, apiBaseUrl]);

  return (
    <>
      <fieldset className="space-y-3 border-0 p-0 m-0">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{ui('fiscal.cert.section.legend')}</legend>

        {cert ? (
          <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0 text-sm">📄</span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-green-800 truncate">{cert.name}</div>
                <div className="text-xs text-green-700/70 mt-0.5">{ui('fiscal.cert.validUntil', { date: cert.validTo })}</div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="flex-shrink-0" onClick={() => setOpen(true)}>{ui('fiscal.cert.replace')}</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3 gap-4">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0 text-sm">📄</span>
              <div>
                <div className="text-sm font-medium">{ui('fiscal.cert.none.title')}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{ui('fiscal.cert.none.hint')}</div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="flex-shrink-0" onClick={() => setOpen(true)}>{ui('fiscal.cert.upload')}</Button>
          </div>
        )}
      </fieldset>

      {open && (
        <CertModal
          context={context}
          orgId={orgId}
          token={token}
          apiBaseUrl={apiBaseUrl}
          onClose={() => setOpen(false)}
          onUpload={(c) => { setCert(c); setOpen(false); }}
        />
      )}
    </>
  );
}
