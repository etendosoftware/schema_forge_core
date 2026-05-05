import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Extract JWT from URL fragment and wrap fetch so every /api call carries it.
const hash = new URLSearchParams(window.location.hash.slice(1));
const jwt = hash.get('jwt');
if (jwt) {
  const rawFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('/api')) {
      const headers = new Headers(init.headers || {});
      headers.set('Authorization', `Bearer ${jwt}`);
      return rawFetch(input, { ...init, headers });
    }
    return rawFetch(input, init);
  };
  // Clear JWT from URL so it doesn't linger in browser history.
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

createRoot(document.getElementById('root')).render(<App />);
