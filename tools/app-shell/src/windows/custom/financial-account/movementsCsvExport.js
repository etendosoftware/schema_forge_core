// CSV export for the Movements tab. Mirrors the columns Classic generates from
// the "Export Data" action of the Transactions tab so the file can be opened
// alongside Classic exports without surprises.

/**
 * Escapes a single CSV field per RFC 4180: wrap in double quotes and double-up
 * embedded quotes. Numbers come through as-is.
 */
function csvField(value) {
  if (value === null || value === undefined || value === '') return '""';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '"true"' : '"false"';
  return `"${String(value).replace(/"/g, '""')}"`;
}

function formatDateDDMMYYYY(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

const TRX_TYPE_LABEL = {
  BPW: 'BP Withdrawal',
  BPD: 'BP Deposit',
};

/**
 * Resolves the long status label Classic emits ("Withdrawn not Cleared",
 * "Deposited not Cleared", "Payment Cleared", ...). The map is the dual of
 * movementStatusConfig — backend code → human label as used in the Classic
 * CSV. Falls back to the raw code if we don't recognise it.
 */
const STATUS_TO_CLASSIC_LABEL = {
  RPAP:   'Awaiting Payment',
  RPAE:   'Awaiting Execution',
  RPVOID: 'Voided',
  RPR:    'Payment Received',
  PPM:    'Payment Made',
  PWNC:   'Withdrawn not Cleared',
  RDNC:   'Deposited not Cleared',
  RPPC:   'Payment Cleared',
};

function resolveStatusLabel(paymentStatus) {
  if (!paymentStatus) return '';
  return STATUS_TO_CLASSIC_LABEL[paymentStatus] ?? paymentStatus;
}

/**
 * `amount` in our payload is signed (positive = deposit, negative = withdrawal).
 * Classic splits it into two columns. Withdrawals are exported as positive
 * numbers in the "Withdrawal Amount" column.
 */
function splitAmount(amount) {
  const n = Number(amount) || 0;
  return n >= 0
    ? { deposit: n, withdrawal: 0 }
    : { deposit: 0, withdrawal: -n };
}

/**
 * Builds the synthetic "Payment" column Classic uses: `{docno} - {date} - {bp} - {abs(amount)}`.
 * When the row has no document/bp we still emit the segments we have so the column
 * shape stays consistent.
 */
function buildPaymentLabel(movement) {
  const docNo = movement.documentNo || '';
  const date = formatDateDDMMYYYY(movement.date);
  const bp = movement.contact || '';
  const amount = Math.abs(Number(movement.amount) || 0);
  return [docNo, date, bp, amount].filter((s) => s !== '').join(' - ');
}

const HEADER = [
  'Transaction Type',
  'Payment',
  'Transaction Date',
  'Business Partner',
  'Payment No.',
  'G/L Item',
  'Description',
  'Deposit Amount',
  'Withdrawal Amount',
  'Currency',
  'Status',
  'Foreign  Amount', // matches Classic's double space (legacy quirk)
  'Foreign Currency',
  'Processed',
];

/**
 * Returns the CSV body for the given movements. Status labels here are the
 * English ones Classic emits ({@link STATUS_TO_CLASSIC_LABEL}), not the
 * localised badge labels.
 *
 * @param {Array<object>} movements - rows from useAccountMovements (filtered or raw)
 * @returns {string} CSV text starting with the header row
 */
export function buildMovementsCsv(movements) {
  const lines = [HEADER.map(csvField).join(',')];

  for (const m of movements) {
    const { deposit, withdrawal } = splitAmount(m.amount);
    const row = [
      TRX_TYPE_LABEL[m.trxType] ?? m.trxType ?? '',
      buildPaymentLabel(m),
      formatDateDDMMYYYY(m.date),
      m.contact || '',
      m.documentNo || '',
      m.glItem || '',
      m.description || '',
      deposit,
      withdrawal,
      m.currencyIso || '',
      resolveStatusLabel(m.paymentStatus),
      '',                          // Foreign Amount — not exposed yet
      '',                          // Foreign Currency — not exposed yet
      m.paymentStatus !== 'RPAP' && m.paymentStatus !== 'RPAE',
    ];
    lines.push(row.map(csvField).join(','));
  }

  return lines.join('\n');
}

/**
 * Builds a CSV from `movements` and triggers a browser download. The BOM prefix
 * makes Excel open it as UTF-8 instead of Windows-1252.
 *
 * @param {Array<object>} movements
 * @param {string} fileName - suggested file name (without extension)
 */
export function downloadMovementsCsv(movements, fileName) {
  const csv = buildMovementsCsv(movements);
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
