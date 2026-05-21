import { describe, it, expect } from 'vitest';
import { buildMonitorFetchPlan, computeKpis } from '../fiscalMonitor.utils.js';

// ---------------------------------------------------------------------------
// buildMonitorFetchPlan
// ---------------------------------------------------------------------------

describe('buildMonitorFetchPlan — known profiles', () => {
  it('returns sii-monitor for "sii"', () => {
    expect(buildMonitorFetchPlan('sii')).toEqual(['sii-monitor']);
  });

  it('returns sii-monitor for "sii-navarra"', () => {
    expect(buildMonitorFetchPlan('sii-navarra')).toEqual(['sii-monitor']);
  });

  it('returns tbai spec for "tbai"', () => {
    expect(buildMonitorFetchPlan('tbai')).toEqual(['tbai-facturas-enviadas']);
  });

  it('returns both specs for "sii+tbai"', () => {
    expect(buildMonitorFetchPlan('sii+tbai')).toEqual(['sii-monitor', 'tbai-facturas-enviadas']);
  });

  it('returns verifactu spec for "verifactu"', () => {
    expect(buildMonitorFetchPlan('verifactu')).toEqual(['monitor-verifactu']);
  });
});

describe('buildMonitorFetchPlan — unknown / null profiles', () => {
  it('returns empty array for null', () => {
    expect(buildMonitorFetchPlan(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(buildMonitorFetchPlan(undefined)).toEqual([]);
  });

  it('returns empty array for unknown string', () => {
    expect(buildMonitorFetchPlan('unknown-profile')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(buildMonitorFetchPlan('')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeKpis
// ---------------------------------------------------------------------------

describe('computeKpis — sii profile', () => {
  it('populates kpis.sii with counts from monitorData', () => {
    const data = {
      sii: {
        issued:           { totalCount: 10 },
        received:         { totalCount: 5 },
        issuedPrevious:   { totalCount: 3 },
        receivedPrevious: { totalCount: 2 },
      },
    };
    const kpis = computeKpis('sii', data);
    expect(kpis.sii).toEqual({ issued: 10, received: 5, issuedPrevious: 3, receivedPrevious: 2 });
    expect(kpis.tbai).toBeUndefined();
    expect(kpis.verifactu).toBeUndefined();
  });

  it('defaults missing counts to 0', () => {
    const kpis = computeKpis('sii', {});
    expect(kpis.sii).toEqual({ issued: 0, received: 0, issuedPrevious: 0, receivedPrevious: 0 });
  });
});

describe('computeKpis — sii-navarra profile', () => {
  it('populates kpis.sii and no tbai/verifactu', () => {
    const kpis = computeKpis('sii-navarra', {});
    expect(kpis.sii).toBeDefined();
    expect(kpis.tbai).toBeUndefined();
    expect(kpis.verifactu).toBeUndefined();
  });
});

describe('computeKpis — tbai profile', () => {
  it('populates kpis.tbai with counts', () => {
    const data = {
      tbai: { totalCount: 20, receivedCount: 15, rejectedCount: 2, errorCount: 1, pendingCount: 2 },
    };
    const kpis = computeKpis('tbai', data);
    expect(kpis.tbai).toEqual({ total: 20, received: 15, rejected: 2, error: 1, pending: 2 });
    expect(kpis.sii).toBeUndefined();
    expect(kpis.verifactu).toBeUndefined();
  });

  it('defaults missing tbai counts to 0', () => {
    const kpis = computeKpis('tbai', {});
    expect(kpis.tbai).toEqual({ total: 0, received: 0, rejected: 0, error: 0, pending: 0 });
  });
});

describe('computeKpis — sii+tbai profile', () => {
  it('populates both kpis.sii and kpis.tbai', () => {
    const data = {
      sii:  { issued: { totalCount: 7 }, received: { totalCount: 3 }, issuedPrevious: { totalCount: 1 }, receivedPrevious: { totalCount: 1 } },
      tbai: { totalCount: 4, receivedCount: 4, rejectedCount: 0, errorCount: 0, pendingCount: 0 },
    };
    const kpis = computeKpis('sii+tbai', data);
    expect(kpis.sii).toBeDefined();
    expect(kpis.tbai).toBeDefined();
    expect(kpis.verifactu).toBeUndefined();
    expect(kpis.sii.issued).toBe(7);
    expect(kpis.tbai.total).toBe(4);
  });
});

describe('computeKpis — verifactu profile', () => {
  it('populates kpis.verifactu with counts', () => {
    const data = {
      verifactu: {
        accepted:          { totalCount: 100 },
        partiallyAccepted: { totalCount: 5 },
        rejected:          { totalCount: 2 },
        invalid:           { totalCount: 1 },
      },
    };
    const kpis = computeKpis('verifactu', data);
    expect(kpis.verifactu).toEqual({ accepted: 100, partiallyAccepted: 5, rejected: 2, invalid: 1 });
    expect(kpis.sii).toBeUndefined();
    expect(kpis.tbai).toBeUndefined();
  });

  it('defaults missing verifactu counts to 0', () => {
    const kpis = computeKpis('verifactu', {});
    expect(kpis.verifactu).toEqual({ accepted: 0, partiallyAccepted: 0, rejected: 0, invalid: 0 });
  });
});

describe('computeKpis — null / unknown profile', () => {
  it('returns empty kpis for null profile', () => {
    expect(computeKpis(null, {})).toEqual({});
  });

  it('returns empty kpis for unknown profile', () => {
    expect(computeKpis('unknown', {})).toEqual({});
  });

  it('handles null monitorData gracefully', () => {
    expect(computeKpis('sii', null)).toEqual({
      sii: { issued: 0, received: 0, issuedPrevious: 0, receivedPrevious: 0 },
    });
  });
});
