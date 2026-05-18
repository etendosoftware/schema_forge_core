const BACKEND_ERROR_MAP = {
  'Country needed in an IBAN account.': 'backendError.countryIban',
  'Using IBAN for generating the Displayed Account requires to introduce the IBAN': 'backendError.ibanRequired',
  'Using the Generic Account No. for generating the Displayed Account requires to introduce a Generic Account Number': 'backendError.genericAccountRequired',
};

export function translateBackendError(msg, t) {
  if (!msg) return msg;
  const key = BACKEND_ERROR_MAP[msg.trim()];
  return (key && t(key)) || msg;
}
