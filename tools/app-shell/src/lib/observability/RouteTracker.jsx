import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { page } from '../observability.js';

export function ObservabilityRouteTracker({ trackPage = page }) {
  const location = useLocation();
  const lastPathRef = useRef(null);

  useEffect(() => {
    const currentPath = location.pathname || '/';
    if (lastPathRef.current === currentPath) return;
    lastPathRef.current = currentPath;
    trackPage(currentPath);
  }, [location.pathname, trackPage]);

  return null;
}
