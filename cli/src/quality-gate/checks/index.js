import { runParseCheck } from './parse.js';
import { runImportsCheck } from './imports.js';
import { runContractCheck } from './contract.js';
import { runInvariantsCheck } from './invariants.js';
import { runI18nCheck } from './i18n.js';

export const QUALITY_GATE_CHECKS = {
  parse: runParseCheck,
  imports: runImportsCheck,
  contract: runContractCheck,
  invariants: runInvariantsCheck,
  i18n: runI18nCheck,
};
