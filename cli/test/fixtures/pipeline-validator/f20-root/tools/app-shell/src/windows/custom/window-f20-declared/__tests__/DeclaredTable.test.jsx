// Fixture: a violating column inside __tests__ — F20 must never scan this file.
export const columns = [
  { key: 'outstandingAmount', column: 'OutstandingAmt', type: 'custom', render: () => null },
];
