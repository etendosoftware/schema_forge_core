import { countryDisplayName, countryFlagEmoji } from './countries.js';

/**
 * International dialling code of every country, by ISO 3166-1 alpha-2 code.
 *
 * Several countries share a code (+1 for the NANP countries, +7 for Russia and Kazakhstan):
 * each keeps its own entry so the selector shows the country the user recognises, and the
 * stored phone only carries the code.
 */
export const COUNTRY_DIAL_CODES = {
  AD: '376', AE: '971', AF: '93', AG: '1', AL: '355', AM: '374', AO: '244', AR: '54',
  AT: '43', AU: '61', AZ: '994', BA: '387', BB: '1', BD: '880', BE: '32', BF: '226',
  BG: '359', BH: '973', BI: '257', BJ: '229', BN: '673', BO: '591', BR: '55', BS: '1',
  BT: '975', BW: '267', BY: '375', BZ: '501', CA: '1', CD: '243', CF: '236', CG: '242',
  CH: '41', CI: '225', CL: '56', CM: '237', CN: '86', CO: '57', CR: '506', CU: '53',
  CV: '238', CY: '357', CZ: '420', DE: '49', DJ: '253', DK: '45', DM: '1', DO: '1',
  DZ: '213', EC: '593', EE: '372', EG: '20', ER: '291', ES: '34', ET: '251', FI: '358',
  FJ: '679', FM: '691', FR: '33', GA: '241', GB: '44', GD: '1', GE: '995', GH: '233',
  GM: '220', GN: '224', GQ: '240', GR: '30', GT: '502', GW: '245', GY: '592', HK: '852',
  HN: '504', HR: '385', HT: '509', HU: '36', ID: '62', IE: '353', IL: '972', IN: '91',
  IQ: '964', IR: '98', IS: '354', IT: '39', JM: '1', JO: '962', JP: '81', KE: '254',
  KG: '996', KH: '855', KI: '686', KM: '269', KN: '1', KP: '850', KR: '82', KW: '965',
  KZ: '7', LA: '856', LB: '961', LC: '1', LI: '423', LK: '94', LR: '231', LS: '266',
  LT: '370', LU: '352', LV: '371', LY: '218', MA: '212', MC: '377', MD: '373', ME: '382',
  MG: '261', MH: '692', MK: '389', ML: '223', MM: '95', MN: '976', MO: '853', MR: '222',
  MT: '356', MU: '230', MV: '960', MW: '265', MX: '52', MY: '60', MZ: '258', NA: '264',
  NE: '227', NG: '234', NI: '505', NL: '31', NO: '47', NP: '977', NR: '674', NZ: '64',
  OM: '968', PA: '507', PE: '51', PG: '675', PH: '63', PK: '92', PL: '48', PR: '1',
  PS: '970', PT: '351', PW: '680', PY: '595', QA: '974', RO: '40', RS: '381', RU: '7',
  RW: '250', SA: '966', SB: '677', SC: '248', SD: '249', SE: '46', SG: '65', SI: '386',
  SK: '421', SL: '232', SM: '378', SN: '221', SO: '252', SR: '597', SS: '211', ST: '239',
  SV: '503', SY: '963', SZ: '268', TD: '235', TG: '228', TH: '66', TJ: '992', TL: '670',
  TM: '993', TN: '216', TO: '676', TR: '90', TT: '1', TV: '688', TW: '886', TZ: '255',
  UA: '380', UG: '256', US: '1', UY: '598', UZ: '998', VA: '39', VC: '1', VE: '58',
  VN: '84', VU: '678', WS: '685', YE: '967', ZA: '27', ZM: '260', ZW: '263',
};

/**
 * The national part of the phone: `ETGO_ACCOUNT.PHONE` is VARCHAR(40) and holds
 * "+<code> <number>", so the number keeps room for the longest code and the separator.
 */
export const PHONE_NUMBER_MAX_LENGTH = 30;

const PHONE_NUMBER_PATTERN = /^[0-9 ()\-.]+$/;
const MIN_PHONE_DIGITS = 4;

/**
 * The prefix selector's options, ordered by country code. The selector shows only the two-letter
 * code and the dialling code ("ES +34"), so it stays narrow next to the number; the country name
 * in the UI language goes in `name`, for the option's tooltip.
 */
export function buildPhonePrefixOptions(locale) {
  return Object.entries(COUNTRY_DIAL_CODES)
    .map(([code, dialCode]) => ({
      value: code,
      dialCode,
      label: `${code} +${dialCode}`,
      name: countryDisplayName(code, locale),
      flag: countryFlagEmoji(code),
    }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

/** The prefix to preselect: the given country when it has a dialling code, otherwise none. */
export function defaultPhonePrefix(countryCode) {
  const code = String(countryCode || '').toUpperCase();
  return COUNTRY_DIAL_CODES[code] ? code : '';
}

/**
 * Whether the typed national number can be stored. Empty is valid: the phone is optional.
 * Otherwise only digits and the usual separators, with at least a few digits.
 */
export function isValidPhoneNumber(number) {
  const value = String(number || '').trim();
  if (!value) return true;
  if (value.length > PHONE_NUMBER_MAX_LENGTH || !PHONE_NUMBER_PATTERN.test(value)) return false;
  return value.replace(/\D/g, '').length >= MIN_PHONE_DIGITS;
}

/**
 * The single value stored on the account and sent to HubSpot, e.g. "+34 600123456".
 * Empty when there is no number or no known prefix: a number without its prefix is not sent.
 */
export function composePhone(prefixCountryCode, number) {
  const value = String(number || '').trim();
  const dialCode = COUNTRY_DIAL_CODES[String(prefixCountryCode || '').toUpperCase()];
  if (!value || !dialCode || !isValidPhoneNumber(value)) return '';
  return `+${dialCode} ${value}`;
}
