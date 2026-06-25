const observabilityMocks = vi.hoisted(() => ({
  track: vi.fn(),
}));

vi.mock('@/lib/observability.js', () => ({
  track: observabilityMocks.track,
}));

import {
  trackDocumentCompleted,
  trackRecordCreated,
  trackSearchPerformed,
  trackWindowOpened,
} from '../productUsageTelemetry.js';

describe('productUsageTelemetry', () => {
  beforeEach(() => {
    observabilityMocks.track.mockReset();
    observabilityMocks.track.mockResolvedValue(undefined);
  });

  it('tracks window openings with product usage defaults', () => {
    trackWindowOpened({ entity: 'salesOrder', specName: 'sales-order' });

    expect(observabilityMocks.track).toHaveBeenCalledWith('window_opened', {
      category: 'product_usage',
      entity: 'salesOrder',
      specName: 'sales-order',
      source: 'contract_ui',
    });
  });

  it('tracks searches without unsafe query or record properties', () => {
    trackSearchPerformed({
      entity: 'salesOrder',
      specName: 'sales-order',
      count: 2,
      query: 'Acme',
      recordId: '123',
    });

    expect(observabilityMocks.track).toHaveBeenCalledWith('search_performed', {
      attempt: 1,
      category: 'product_usage',
      count: 2,
      entity: 'salesOrder',
      source: 'list_filter',
      specName: 'sales-order',
      type: 'filter',
    });
  });

  it('tracks create and complete events with low-cardinality properties', () => {
    trackRecordCreated({ entity: 'invoice', specName: 'sales-invoice' });
    trackDocumentCompleted({ entity: 'invoice', specName: 'sales-invoice' });

    expect(observabilityMocks.track).toHaveBeenNthCalledWith(1, 'record_created', {
      category: 'product_usage',
      entity: 'invoice',
      operation: 'create',
      source: 'detail_view',
      specName: 'sales-invoice',
      value: 1,
    });
    expect(observabilityMocks.track).toHaveBeenNthCalledWith(2, 'document_completed', {
      category: 'product_usage',
      entity: 'invoice',
      operation: 'complete',
      source: 'detail_view',
      specName: 'sales-invoice',
      value: 1,
    });
  });
});
