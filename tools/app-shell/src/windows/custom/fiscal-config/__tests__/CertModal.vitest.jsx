import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dirname, '..', 'CertModal.jsx'), 'utf8');

// ---------------------------------------------------------------------------
// Exports & imports
// ---------------------------------------------------------------------------

describe('CertModal — exports and imports', () => {
  it('exports a default function component named CertModal', () => {
    expect(src).toMatch(/export default function CertModal/);
  });

  it('imports useApiFetch from @/auth/useApiFetch.js', () => {
    expect(src).toMatch(/useApiFetch.*from.*@\/auth\/useApiFetch\.js/);
  });
});

// ---------------------------------------------------------------------------
// performUpload function
// ---------------------------------------------------------------------------

describe('CertModal — performUpload function', () => {
  it('defines a performUpload function', () => {
    expect(src).toMatch(/function performUpload/);
  });

  it('POSTs to /certificate endpoint', () => {
    expect(src).toMatch(/apiFetch\(`\/certificate`/);
    expect(src).toMatch(/method:\s*['"]POST['"]/);
  });

  it('sends a FormData body', () => {
    expect(src).toMatch(/new FormData\(\)/);
    expect(src).toMatch(/formData\.append/);
  });
});

// ---------------------------------------------------------------------------
// State declarations
// ---------------------------------------------------------------------------

describe('CertModal — state variables', () => {
  it('declares pendingNif / setPendingNif state', () => {
    expect(src).toMatch(/pendingNif.*setPendingNif.*useState/);
  });

  it('declares certDetails / setCertDetails state', () => {
    expect(src).toMatch(/certDetails.*setCertDetails.*useState/);
  });

  it('initialises step state to "pick"', () => {
    expect(src).toMatch(/useState\(.*['"]pick['"]\)/);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('CertModal — error handling', () => {
  it('reads data?.error?.message for error display', () => {
    expect(src).toMatch(/data\?\.error\?\.message/);
  });
});

// ---------------------------------------------------------------------------
// Step transitions
// ---------------------------------------------------------------------------

describe('CertModal — step transitions', () => {
  it('calls setStep("pick") on upload failure', () => {
    expect(src).toMatch(/setStep\(['"]pick['"]\)/);
  });

  it('calls setStep("done") on upload success', () => {
    expect(src).toMatch(/setStep\(['"]done['"]\)/);
  });

  it('calls setStep("confirmNif") for pending NIF flow', () => {
    expect(src).toMatch(/setStep\(['"]confirmNif['"]\)/);
  });

  it('does NOT simulate success with a bare setTimeout setStep("done") on the same line', () => {
    expect(src).not.toMatch(/setTimeout.*setStep\(['"]done['"]\)/);
  });
});

// ---------------------------------------------------------------------------
// UI structure
// ---------------------------------------------------------------------------

describe('CertModal — UI structure', () => {
  it('renders a password input with bullet placeholder', () => {
    expect(src).toMatch(/placeholder=["']•+["']/);
  });

  it('renders a file input element', () => {
    expect(src).toMatch(/type=["']file["']/);
  });
});
