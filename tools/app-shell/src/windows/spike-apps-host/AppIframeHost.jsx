import React, { useEffect, useState } from 'react';

async function fetchAppToken(appId, etendoToken) {
  const res = await fetch(`/sws/apps/token?appId=${encodeURIComponent(appId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${etendoToken}`,
    },
  });
  if (!res.ok) throw new Error(`token endpoint failed: ${res.status}`);
  const body = await res.json();
  return body.token;
}

export default function AppIframeHost({ appUrl, appId, token }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setError('Missing Etendo session token');
      return;
    }
    (async () => {
      try {
        const appToken = await fetchAppToken(appId, token);
        setSrc(`${appUrl}/#jwt=${appToken}`);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [appUrl, appId, token]);

  if (error) return <div className="p-8 text-red-600">App token error: {error}</div>;
  if (!src) return <div className="p-8 text-gray-500">Loading app…</div>;

  return (
    <iframe
      title={appId}
      src={src}
      sandbox="allow-scripts allow-same-origin allow-forms"
      className="w-full h-full border-0"
    />
  );
}
