/**
 * Shared structured-address composition (ETP-5806, ETP-6206).
 *
 * The browser copy of the `structured-address-for-sepa` address rules. The canonical rule is
 * `StructuredAddressComposer` in com.etendoerp.go
 * (`src/com/etendoerp/go/schemaforge/util/StructuredAddressComposer.java`), whose
 * `composeAddressLines` ports Classic's `LocationSEPA.java::fillAddressLines` exactly. Keep this in
 * exact lockstep with the Java algorithm: same separators (", " and " - "), same 60-char line
 * length, same precedence of truncation cases, same "s/n" fallback.
 *
 * The backend recomputes everything here server-side for every channel (REST and MCP alike) and is
 * the source of truth. This module exists so browser callers cannot drift from each other or from
 * the backend: any UI or descriptor that builds a `locationAddress` payload, or previews the
 * computed Address1/Address2, MUST import it instead of reimplementing it (the Location editor
 * `LocationEditorModal.jsx` and the Contacts import `contactsImportDescriptor.js` in
 * etendo_schema_forge).
 *
 * Plain module (no React, no `@/` imports) so a plain descriptor or a `node --test` suite can use it.
 */

/** Length of `C_Location.Address1`/`Address2` — NOT the 70 of `EM_OBSEPA_StrtNm`. */
export const ADDRESS_LINE_MAX_LENGTH = 60;

/**
 * `BUILDING_NUMBER_MAX_LENGTH`/`BUILDING_NAME_MAX_LENGTH` mirror the DB column lengths of
 * `org.openbravo.sepa.iso20022`'s `AD_COLUMN.FIELDLENGTH` for `EM_OBSEPA_BldgNb`/`BldgNm`
 * (VARCHAR(16)/(35)) — `StructuredAddressComposer`'s constants of the same name.
 *
 * `STREET_NAME_MAX_LENGTH` is deliberately NOT the matching 70 of `EM_OBSEPA_StrtNm` (that column
 * stays VARCHAR(70) in the DB — other SEPA consumers, e.g. the actual SEPA XML export, legitimately
 * need up to 70 chars, and the column is never altered for this). It is Etendo Go's own, stricter
 * business-rule cap: capping it at 60 — the same width as `ADDRESS_LINE_MAX_LENGTH` — guarantees
 * `composeAddressLines` below never needs to cut a street mid-value to fit Address1/Address2,
 * because the street alone can never exceed the line it would have to share. QA (Isa, Pasada 2)
 * confirmed a 70-char street still produced a mid-word cut in the composed preview; rather than
 * widening the UI or accepting silent truncation, the fix is to reject a street over 60 chars up
 * front (see `fieldsExceedingMaxLength` in `StructuredAddressComposer`), so the overflow branch in
 * `composeAddressLines` that truncates `street` is now structurally unreachable through any
 * validated caller — see the note on that branch below, which it does NOT contradict: the
 * truncation logic is kept as a defensive fallback for a direct/unvalidated call, it simply never
 * fires for input that passed validation.
 */
export const STREET_NAME_MAX_LENGTH = 60;
export const BUILDING_NUMBER_MAX_LENGTH = 16;
export const BUILDING_NAME_MAX_LENGTH = 35;

/**
 * Building Number used when the number is blank but a street is present — the Spanish "sin número"
 * convention, same literal as `StructuredAddressComposer.EMPTY_BUILDING_NUMBER_FALLBACK`. Not
 * translated: it is the same abbreviation in every locale.
 */
export const EMPTY_BUILDING_NUMBER_FALLBACK = 's/n';

/** `String(x ?? '').trim()` — accepts numbers, null and undefined. */
function toTrimmed(value) {
  return String(value ?? '').trim();
}

/**
 * The Building Number to persist, mirroring `StructuredAddressComposer.effectiveBuildingNumber`:
 * the trimmed number when there is one; "s/n" when it is blank but a street is present; `null`
 * otherwise (there is nothing to anchor "no number" to without a street). Unlike Java, which
 * returns the raw blank value in that last case, the blank is normalised to `null`.
 *
 * @param {string|number|null|undefined} streetName
 * @param {string|number|null|undefined} buildingNumber
 * @returns {string|null}
 */
export function effectiveBuildingNumber(streetName, buildingNumber) {
  const number = toTrimmed(buildingNumber);
  if (number) return number;
  return toTrimmed(streetName) ? EMPTY_BUILDING_NUMBER_FALLBACK : null;
}

/** Concatenates two parts with `sep` only when BOTH are non-empty — mirrors Java's `append`. */
function appendPart(base, sep, part) {
  if (!base) return part;
  if (!part) return base;
  return `${base}${sep}${part}`;
}

/**
 * Computes the composed Address1/Address2 from the structured fields, as the backend writes them:
 * `StructuredAddressComposer.composeAddressLines(street, effectiveBuildingNumber(street, number),
 * name)`.
 *
 * - No street → both lines empty: a composed line always needs a street as its base (the backend
 *   never composes one without it; a lone Number must not read as a complete address).
 * - Blank number with a street → composes as "s/n" (see `effectiveBuildingNumber`).
 * - `"Street, Number - Name"` when it fits in 60 chars; otherwise `"Street, Number"` on line 1 and
 *   the name (cut to 60) on line 2; when even `"Street, Number"` overflows, the street cut to 60 on
 *   line 1 and `"Number - Name"` cut to 60 on line 2.
 *
 * The street-cut branch above (CP-6, restored in ETP-5806 to match Classic's
 * `LocationSEPA.fillAddressLines`) is kept as a defensive fallback for a caller that bypasses
 * validation, but it is now structurally unreachable for any validated input: since
 * `STREET_NAME_MAX_LENGTH` (60) caps `street` itself at the same width as `ADDRESS_LINE_MAX_LENGTH`,
 * `street` can never be long enough to need cutting. A 70-char street (the old cap) is rejected
 * up front by validation instead of ever reaching this function and being cut mid-word — the
 * failure QA (Isa, Pasada 2) confirmed against the old 70-char limit.
 *
 * @param {string|number|null|undefined} streetName
 * @param {string|number|null|undefined} buildingNumber
 * @param {string|number|null|undefined} buildingName
 * @returns {{address1: string, address2: string}}
 */
export function composeAddressLines(streetName, buildingNumber, buildingName) {
  const street = toTrimmed(streetName);
  if (!street) {
    return { address1: '', address2: '' };
  }
  const number = effectiveBuildingNumber(street, buildingNumber);
  const name = toTrimmed(buildingName);

  const streetAndNumber = appendPart(street, ', ', number);
  const wholeAddress = appendPart(streetAndNumber, ' - ', name);

  if (wholeAddress.length <= ADDRESS_LINE_MAX_LENGTH) {
    return { address1: wholeAddress, address2: '' };
  }
  if (streetAndNumber.length <= ADDRESS_LINE_MAX_LENGTH) {
    return { address1: streetAndNumber, address2: name.slice(0, ADDRESS_LINE_MAX_LENGTH) };
  }
  return {
    address1: street.slice(0, ADDRESS_LINE_MAX_LENGTH),
    address2: appendPart(number, ' - ', name).slice(0, ADDRESS_LINE_MAX_LENGTH),
  };
}
