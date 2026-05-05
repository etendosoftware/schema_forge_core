import { financeProposals } from './finance.js';
import { localizationProposals } from './localization.js';
import { salesProposals } from './sales.js';
import { purchasingProposals } from './purchasing.js';
import { operationsProposals } from './operations.js';

export const windowProposals = {
  ...financeProposals,
  ...localizationProposals,
  ...salesProposals,
  ...purchasingProposals,
  ...operationsProposals,
};
