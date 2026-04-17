import React, { useEffect, useState } from 'react';

async function fetchAppToken(appId) {
  const res = await fetch(`/etendo/neo/apps/token?appId=${encodeURIComponent(appId)}`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`token endpoint failed: ${res.status}`);
  const body = await res.json();
  return body.token;
}

export default function AppIframeHost({ appUrl, appId }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await fetchAppToken(appId);
        setSrc(`${appUrl}/#jwt=${token}`);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [appUrl, appId]);

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
