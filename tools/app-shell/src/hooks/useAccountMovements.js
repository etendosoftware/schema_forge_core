import { useMemo } from 'react';

// TODO: replace mock with real fetch from
// /sws/neo/account-movement?FIN_FinancialAccount_ID={accountId}
// once the FIN_FinAcc_Transaction NEO spec is pushed via push-to-neo.js

/** @type {Array<import('../windows/custom/financial-account/movementStatusConfig.js').MovementRow>} */
const MOCK_MOVEMENTS = [
  {
    id: 'm-001',
    date: '2025-05-01T10:00:00Z',
    documentNo: 'FAP-2025-001',
    contact: 'Proveedor SA',
    description: 'Pago factura compra 001',
    paymentStatus: 'PPM',
    transactionType: 'OUT',
    typeLabel: 'Outgoing Payment',
    amount: -1500.0,
    balance: 48500.0,
    currencyIso: 'EUR',
  },
  {
    id: 'm-002',
    date: '2025-05-03T14:30:00Z',
    documentNo: 'FAR-2025-010',
    contact: 'Cliente XYZ',
    description: 'Cobro factura venta 010',
    paymentStatus: 'RPR',
    transactionType: 'IN',
    typeLabel: 'Incoming Payment',
    amount: 3200.0,
    balance: 51700.0,
    currencyIso: 'EUR',
  },
  {
    id: 'm-003',
    date: '2025-05-05T09:15:00Z',
    documentNo: 'FAP-2025-002',
    contact: 'Proveedor Global',
    description: 'Transferencia saliente pendiente',
    paymentStatus: 'RPAP',
    transactionType: 'OUT',
    typeLabel: 'Outgoing Transfer',
    amount: -800.0,
    balance: 50900.0,
    currencyIso: 'EUR',
  },
  {
    id: 'm-004',
    date: '2025-05-08T16:00:00Z',
    documentNo: 'FAR-2025-011',
    contact: 'Cliente ABC',
    description: 'Cobro pendiente ejecución',
    paymentStatus: 'RPAE',
    transactionType: 'IN',
    typeLabel: 'Incoming Payment',
    amount: 5000.0,
    balance: 55900.0,
    currencyIso: 'EUR',
  },
  {
    id: 'm-005',
    date: '2025-05-10T11:45:00Z',
    documentNo: 'FAP-2025-003',
    contact: 'Suministros SL',
    description: 'Pago anulado',
    paymentStatus: 'RPVOID',
    transactionType: 'OUT',
    typeLabel: 'Outgoing Payment',
    amount: -250.0,
    balance: 55650.0,
    currencyIso: 'EUR',
  },
  {
    id: 'm-006',
    date: '2025-05-12T08:30:00Z',
    documentNo: 'FAR-2025-012',
    contact: 'Distribuidor Norte',
    description: 'Depósito en tránsito',
    paymentStatus: 'RDNC',
    transactionType: 'IN',
    typeLabel: 'Deposit',
    amount: 12000.0,
    balance: 67650.0,
    currencyIso: 'EUR',
  },
  {
    id: 'm-007',
    date: '2025-05-15T13:00:00Z',
    documentNo: 'FAP-2025-004',
    contact: 'Oficina Suministros',
    description: 'Retirada sin liquidar',
    paymentStatus: 'PWNC',
    transactionType: 'OUT',
    typeLabel: 'Withdrawal',
    amount: -400.0,
    balance: 67250.0,
    currencyIso: 'EUR',
  },
  {
    id: 'm-008',
    date: '2025-05-18T10:20:00Z',
    documentNo: 'FAR-2025-013',
    contact: 'Cliente Premium',
    description: 'Pago compensado',
    paymentStatus: 'RPPC',
    transactionType: 'IN',
    typeLabel: 'Incoming Payment',
    amount: 7800.0,
    balance: 75050.0,
    currencyIso: 'EUR',
  },
  {
    id: 'm-009',
    date: '2025-05-20T15:30:00Z',
    documentNo: 'FAP-2025-005',
    contact: 'Proveedor SA',
    description: 'Pago trimestral servicios',
    paymentStatus: 'PPM',
    transactionType: 'OUT',
    typeLabel: 'Outgoing Payment',
    amount: -3500.0,
    balance: 71550.0,
    currencyIso: 'EUR',
  },
  {
    id: 'm-010',
    date: '2025-05-22T09:00:00Z',
    documentNo: 'FAR-2025-014',
    contact: 'Cliente Nuevo',
    description: 'Primera factura cobrada',
    paymentStatus: 'RPR',
    transactionType: 'IN',
    typeLabel: 'Incoming Payment',
    amount: 1900.0,
    balance: 73450.0,
    currencyIso: 'EUR',
  },
];

/**
 * Returns mock movements and computed KPI totals for a given account.
 *
 * @param {string} _accountId — not used in mock; will be used when real endpoint is wired.
 * @param {object} _filters — not used in mock; filtering will be server-side.
 * @returns {{ movements: typeof MOCK_MOVEMENTS, totals: { balance: number, inflows: number, outflows: number, currency: string }, loading: boolean, error: null, reload: () => void }}
 */
export function useAccountMovements(_accountId, _filters) {
  const totals = useMemo(() => {
    const currency = MOCK_MOVEMENTS[0]?.currencyIso ?? 'EUR';
    const lastMovement = MOCK_MOVEMENTS[MOCK_MOVEMENTS.length - 1];
    const balance = lastMovement?.balance ?? 0;
    const inflows = MOCK_MOVEMENTS.filter((m) => m.amount > 0).reduce((acc, m) => acc + m.amount, 0);
    const outflows = Math.abs(MOCK_MOVEMENTS.filter((m) => m.amount < 0).reduce((acc, m) => acc + m.amount, 0));
    return { balance, inflows, outflows, currency };
  }, []);

  return {
    movements: MOCK_MOVEMENTS,
    totals,
    loading: false,
    error: null,
    reload: () => {},
  };
}
