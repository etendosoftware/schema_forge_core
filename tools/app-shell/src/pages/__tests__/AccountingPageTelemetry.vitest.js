import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, '../AccountingPage.jsx'), 'utf8');

describe('AccountingPage KPI telemetry', () => {
  it('tracks the accounting dashboard weekly adoption event', () => {
    expect(source).toMatch(/trackKpiEvent\(track,\s*'accounting_dashboard_viewed'/);
    expect(source).toMatch(/kpiId:\s*'kpi_adopt_accounting_board_weekly'/);
    expect(source).toMatch(/module:\s*'accounting'/);
    expect(source).toMatch(/source:\s*'accounting_dashboard'/);
    expect(source).toMatch(/status:\s*'success'/);
  });

  it('uses fire-and-forget dispatch', () => {
    expect(source).toMatch(/Promise\.resolve\(trackKpiEvent/);
    expect(source).toMatch(/\.catch\(\(\) => \{\}\)/);
  });
});
