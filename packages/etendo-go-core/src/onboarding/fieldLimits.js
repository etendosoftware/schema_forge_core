/**
 * Maximum input lengths for the onboarding forms (ETP-4665).
 *
 * Every limit below is derived from the Etendo AD column the value ultimately
 * lands in — NOT from a generic UI convention. Provisioning writes these values
 * through `InitialClientSetup` / `InitialOrgSetup`, and Openbravo's DAL raises a
 * `ValidationException` at flush time when a value exceeds its column, which
 * rolls the whole tenant creation back. Capping the input is what keeps the user
 * out of that unrecoverable mid-transaction failure.
 *
 * Do not "round these up" to nicer numbers: shrinking headroom here means a
 * rollback with a raw `@CreateClientFailed@` on the user's screen.
 */

/**
 * `ETGO_ACCOUNT.NAME` is VARCHAR(255) and never reaches the AD, so storage does
 * not constrain this one. It is capped at the profile step's limit anyway
 * because `ProfileStep` PRE-FILLS "Nombre completo" with this value: `maxLength`
 * does not truncate a programmatically assigned value, so a looser cap here
 * would hand the user a pre-filled field already over its own limit, with
 * Continue disabled until they manually delete characters the system put there.
 * Keep this equal to FULL_NAME_MAX_LENGTH.
 */
export const ACCOUNT_NAME_MAX_LENGTH = 60;

/** The account email is copied verbatim into `AD_USER.USERNAME` and
 * `AD_USER.NAME`, both NVARCHAR(60). This is the exact overflow reported in
 * ETP-4665 (`ADUser.name: Value too long. Length 255, maximum allowed 60`). */
export const EMAIL_MAX_LENGTH = 60;

/** No storage constraint exists: `ETGO_ACCOUNT.PASSWORD_HASH` is VARCHAR(255)
 * and always holds a fixed-length `base64(salt):base64(sha256)` string (69
 * chars) regardless of how long the password is, and the tenant's
 * `AD_USER.PASSWORD` receives the hash of a server-generated UUID, not this
 * password. There is NO bcrypt anywhere in the stack, so the widely-cited
 * 72-byte bcrypt truncation does not apply. This cap is only a defensive bound
 * so an abusive client cannot make the server hash an unbounded payload. */
export const PASSWORD_MAX_LENGTH = 128;

/** Written to `AD_USER.NAME` NVARCHAR(60) by `applyClientAdminDisplayName`. */
export const FULL_NAME_MAX_LENGTH = 60;

/** The company name is written unchanged to `AD_CLIENT.NAME` NVARCHAR(60) *and*
 * `AD_CLIENT.VALUE` / `AD_ORG.VALUE`, both NVARCHAR(40) — the search keys are
 * the binding constraint. `AD_ROLE.NAME` also gets `clientName + " Admin"`,
 * which 40 keeps comfortably inside its own 60. */
export const CLIENT_NAME_MAX_LENGTH = 40;

/** `C_BPARTNER.TAXID` / `AD_ORGINFO.TAXID` are VARCHAR(20). Preventive: today
 * the tax id is only persisted in the onboarding draft and never reaches the
 * AD, but the cap keeps the value storable the day it does. */
export const FISCAL_ID_MAX_LENGTH = 20;

/** `C_LOCATION.ADDRESS1` is NVARCHAR(60). */
export const ADDRESS_MAX_LENGTH = 60;

/**
 * Freelancers have no company: `CompanyStep` reuses their personal full name as
 * the invoicing name, so for them the profile step's full name inherits the
 * stricter company-name limit.
 */
export const FREELANCER_FULL_NAME_MAX_LENGTH = CLIENT_NAME_MAX_LENGTH;

export const ONBOARDING_FIELD_LIMITS = {
  accountName: ACCOUNT_NAME_MAX_LENGTH,
  email: EMAIL_MAX_LENGTH,
  password: PASSWORD_MAX_LENGTH,
  fullName: FULL_NAME_MAX_LENGTH,
  clientName: CLIENT_NAME_MAX_LENGTH,
  fiscalId: FISCAL_ID_MAX_LENGTH,
  address: ADDRESS_MAX_LENGTH,
};

/**
 * Effective full-name limit for a given business type. Company/advisory keep the
 * `AD_USER.NAME` limit; freelancers fall back to the company-name limit because
 * their full name doubles as the client name.
 */
export function fullNameLimitFor(businessType) {
  return businessType === 'freelancer'
    ? FREELANCER_FULL_NAME_MAX_LENGTH
    : FULL_NAME_MAX_LENGTH;
}

/**
 * True when `value` is longer than `limit`. Counts Unicode code points rather
 * than UTF-16 units so an emoji or an astral character is not double-counted
 * against the user — matching the length constraint evaluator already used by
 * app-shell-core (`lib/validation/constraints/length.js`).
 */
export function exceedsLimit(value, limit) {
  if (typeof value !== 'string' || !Number.isFinite(limit)) return false;
  return [...value].length > limit;
}
