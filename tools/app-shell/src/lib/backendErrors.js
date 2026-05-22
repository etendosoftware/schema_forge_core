const BACKEND_ERROR_MAP = {
  'Country needed in an IBAN account.': 'backendError.countryIban',
  'Using IBAN for generating the Displayed Account requires to introduce the IBAN': 'backendError.ibanRequired',
  'Using the Generic Account No. for generating the Displayed Account requires to introduce a Generic Account Number': 'backendError.genericAccountRequired',
  'IBAN code entered is not correct. Please review the IBAN code and the country defined for the bank': 'backendError.ibanInvalid',
  'Using the SWIFT Code for generating the Displayed Account requires to introduce a SWIFT Code and the Generic Account No.': 'backendError.swiftRequired',
};

export function translateBackendError(msg, t) {
  if (!msg || typeof t !== 'function') return msg;
  const key = BACKEND_ERROR_MAP[msg.trim()];
  if (!key) return msg;
  const translated = t(key);
  // Guard: if t() returns the key itself the translation is missing — keep original
  return (translated && translated !== key) ? translated : msg;
}
