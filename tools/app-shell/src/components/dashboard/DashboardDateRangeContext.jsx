import { createContext, useContext, useState, useCallback } from 'react';

const STORAGE_KEY = 'dashboard_date_range';

const VALID_RANGES = new Set(['lastYear', 'last90d', 'last30d', 'mtd', 'ytd']);

function readStoredRange() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_RANGES.has(stored)) return stored;
  } catch {
    // ignore
  }
  return 'lastYear';
}

const DashboardDateRangeContext = createContext(null);

export function DashboardDateRangeProvider({ children }) {
  const [range, setRangeState] = useState(readStoredRange);

  const setRange = useCallback((value) => {
    if (!VALID_RANGES.has(value)) return;
    setRangeState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
  }, []);

  return (
    <DashboardDateRangeContext.Provider value={{ range, setRange }}>
      {children}
    </DashboardDateRangeContext.Provider>
  );
}

export function useDashboardDateRange() {
  const ctx = useContext(DashboardDateRangeContext);
  if (!ctx) throw new Error('useDashboardDateRange must be used inside DashboardDateRangeProvider');
  return ctx;
}
