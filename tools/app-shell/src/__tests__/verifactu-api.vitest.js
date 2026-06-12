import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('@/components/contract-ui', () => ({
  ListView: vi.fn(() => null),
  DetailView: vi.fn(() => null),
}));

let vcApi, mvApi;

beforeAll(async () => {
  const [vcMod, mvMod] = await Promise.all([
    import('@generated/verifactu-config/generated/web/verifactu-config/CabeceraDeConfiguracionVerifactuPage.jsx'),
    import('@generated/monitor-verifactu/generated/web/monitor-verifactu/CabeceraDeEmisorPage.jsx'),
  ]);
  vcApi = vcMod.api;
  mvApi = mvMod.api;
});

// ─── verifactu-config ────────────────────────────────────────────────────────

describe('verifactu-config api contract (ETP-4237 — refreshData removed)', () => {
  it('specName is verifactu-config', () => {
    expect(vcApi.specName).toBe('verifactu-config');
  });

  it('baseUrl matches spec name', () => {
    expect(vcApi.baseUrl).toBe('/sws/neo/verifactu-config');
  });

  it('isReady action endpoint is declared', () => {
    const action = vcApi.actions.find((a) => a.field === 'isReady');
    expect(action).toBeDefined();
    expect(action.url).toContain('/action/isReady');
  });

  it('isReady action belongs to cabeceraDeConfiguraciónVerifactu entity', () => {
    const action = vcApi.actions.find((a) => a.field === 'isReady');
    expect(action.entity).toBe('cabeceraDeConfiguraciónVerifactu');
  });

  it('CRUD flags are all booleans', () => {
    const crud = vcApi.crud['cabeceraDeConfiguraciónVerifactu'];
    expect(crud).toBeDefined();
    for (const flag of ['get', 'getById', 'post', 'put', 'patch', 'delete']) {
      expect(typeof crud[flag]).toBe('boolean');
    }
  });

  it('window category is configuration', () => {
    expect(vcApi.window?.category).toBe('configuration');
  });
});

// ─── monitor-verifactu ───────────────────────────────────────────────────────

describe('monitor-verifactu api contract (ETP-4237 — refreshData removed)', () => {
  it('specName is monitor-verifactu', () => {
    expect(mvApi.specName).toBe('monitor-verifactu');
  });

  it('baseUrl matches spec name', () => {
    expect(mvApi.baseUrl).toBe('/sws/neo/monitor-verifactu');
  });

  it('isReady action endpoint is declared', () => {
    const action = mvApi.actions.find((a) => a.field === 'isReady');
    expect(action).toBeDefined();
    expect(action.url).toContain('/action/isReady');
  });

  it('isReady action belongs to cabeceraDeEmisor entity', () => {
    const action = mvApi.actions.find((a) => a.field === 'isReady');
    expect(action.entity).toBe('cabeceraDeEmisor');
  });

  it('CRUD flags are all booleans', () => {
    const crud = mvApi.crud['cabeceraDeEmisor'];
    expect(crud).toBeDefined();
    for (const flag of ['get', 'getById', 'post', 'put', 'patch', 'delete']) {
      expect(typeof crud[flag]).toBe('boolean');
    }
  });
});
