// Payment status search_keys from Etendo backend reference list (FIN_Payment.Status).
// Keys match the actual backend values — do NOT rename.
//
// Visual model (ETP-4121 update): the 8 backend statuses collapse into 5 user-facing
// families. Labels are single strings shared across all backend codes that map to the
// same family (e.g. RPAP + RPAE both render as "Borrador").

import { MOVEMENT_STATUS_FAMILY } from '@/components/financial-accounts/tokens';

const DRAFT     = { family: MOVEMENT_STATUS_FAMILY.PENDING,    labelKey: 'financeAccountMovementsStatusDraft' };
const VOIDED    = { family: MOVEMENT_STATUS_FAMILY.VOIDED,     labelKey: 'financeAccountMovementsStatusVoided' };
const COMPLETED = { family: MOVEMENT_STATUS_FAMILY.EXECUTED,   labelKey: 'financeAccountMovementsStatusCompleted' };
const IN_TRANSIT= { family: MOVEMENT_STATUS_FAMILY.IN_TRANSIT, labelKey: 'financeAccountMovementsStatusInTransit' };
const RECONCILED= { family: MOVEMENT_STATUS_FAMILY.CLEARED,    labelKey: 'financeAccountMovementsStatusReconciled' };

export const MOVEMENT_STATUS_CONFIG = {
  RPAP:   DRAFT,
  RPAE:   DRAFT,
  RPVOID: VOIDED,
  RPR:    COMPLETED,
  PPM:    COMPLETED,
  PWNC:   IN_TRANSIT,
  RDNC:   IN_TRANSIT,
  RPPC:   RECONCILED,
};

export const ALL_STATUSES = Object.keys(MOVEMENT_STATUS_CONFIG);
