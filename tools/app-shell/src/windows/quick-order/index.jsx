import React from 'react';
import AppIframeHost from '../spike-apps-host/AppIframeHost.jsx';
import { findAppById } from '../../apps-registry.js';

const APP = findAppById('quick-order');
if (!APP) throw new Error('quick-order not found in apps registry');

export default function QuickOrderWindow({ token }) {
  // `type` comes from the menu entry via the window's query params (wired in
  // Task 5). Default to 'sales' if the menu entry forgot to set it.
  const type = new URLSearchParams(window.location.search).get('type') || 'sales';
  const iframeUrl = `${APP.iframeUrl}?type=${encodeURIComponent(type)}`;
  return <AppIframeHost appUrl={iframeUrl} appId={APP.appId} token={token} />;
}
