// Payment status search_keys from Etendo backend reference list (FIN_Payment.Status).
// These match the actual backend values — do NOT translate the keys.
// Follow-up: once a reference endpoint is exposed, this map can be fetched dynamically.

import { MOVEMENT_STATUS_FAMILY } from '@/components/financial-accounts/tokens';

export const MOVEMENT_STATUS_CONFIG = {
  RPAP:   { family: MOVEMENT_STATUS_FAMILY.PENDING,    labelKey: 'financeAccountMovementsStatusRPAP' },
  RPAE:   { family: MOVEMENT_STATUS_FAMILY.PENDING,    labelKey: 'financeAccountMovementsStatusRPAE' },
  RPVOID: { family: MOVEMENT_STATUS_FAMILY.VOIDED,     labelKey: 'financeAccountMovementsStatusRPVOID' },
  RPR:    { family: MOVEMENT_STATUS_FAMILY.EXECUTED,   labelKey: 'financeAccountMovementsStatusRPR' },
  PPM:    { family: MOVEMENT_STATUS_FAMILY.EXECUTED,   labelKey: 'financeAccountMovementsStatusPPM' },
  PWNC:   { family: MOVEMENT_STATUS_FAMILY.IN_TRANSIT, labelKey: 'financeAccountMovementsStatusPWNC' },
  RDNC:   { family: MOVEMENT_STATUS_FAMILY.IN_TRANSIT, labelKey: 'financeAccountMovementsStatusRDNC' },
  RPPC:   { family: MOVEMENT_STATUS_FAMILY.CLEARED,    labelKey: 'financeAccountMovementsStatusRPPC' },
};

export const ALL_STATUSES = Object.keys(MOVEMENT_STATUS_CONFIG);
