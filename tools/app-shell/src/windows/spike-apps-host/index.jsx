import React from 'react';
import AppIframeHost from './AppIframeHost.jsx';

export default function SpikeHelloAppWindow() {
  return (
    <AppIframeHost
      appUrl={import.meta.env.VITE_SPIKE_APP_URL || 'http://localhost:5173'}
      appId="spike-hello-app"
    />
  );
}
