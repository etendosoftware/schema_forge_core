/**
 * Shared structured-address composition (ETP-5806).
 *
 * Ports `StructuredAddressComposer.composeAddressLines` (com.etendoerp.go,
 * `src/com/etendoerp/go/schemaforge/util/StructuredAddressComposer.java`), which itself ports
 * Classic's `LocationSEPA.java::fillAddressLines` exactly — not the simplified "Line1=Street+Number
 * / Line2=BuildingName" rule from the ticket text or the design mockup. Keep this in exact lockstep
 * with the Java algorithm: same separators (", " and " - "), same 60-char line length, same
 * precedence of truncation cases.
 *
 * Canonical home for this logic: any UI that lets the user type Street/Number/Building Name and
 * wants a live preview of the computed Address1/Address2 MUST import this instead of
 * reimplementing it — it is published from `app-shell-core` so both `etendo_schema_forge`
 * (`LocationEditorModal.jsx`) and `etendo-go-core` (`CompanyStep.jsx`, onboarding) can share it.
 */

/** Length of `C_Location.Address1`/`Address2` — NOT the 70 of `EM_OBSEPA_StrtNm`. */
export const ADDRESS_LINE_MAX_LENGTH = 60;

/**
 * DB column lengths of the 3 structured SEPA fields themselves
 * (`org.openbravo.sepa.iso20022`'s `AD_COLUMN.FIELDLENGTH` for
 * `EM_OBSEPA_StrtNm`/`BldgNb`/`BldgNm`: VARCHAR(70)/(16)/(35)). Mirror
 * `StructuredAddressComposer`'s private constants of the same name.
 */
export const STREET_NAME_MAX_LENGTH = 70;
export const BUILDING_NUMBER_MAX_LENGTH = 16;
export const BUILDING_NAME_MAX_LENGTH = 35;

/** Concatenates two parts with `sep` only when BOTH are non-empty — mirrors Java's `append`. */
function appendPart(base, sep, part) {
  if (!base) return part;
  if (!part) return base;
  return `${base}${sep}${part}`;
}

/**
 * Computes the composed Address1/Address2 from the structured fields, replicating
 * `StructuredAddressComposer.composeAddressLines` / `LocationSEPA.fillAddressLines` line for
 * line. This is a client-side PREVIEW convenience — the backend recomputes the same thing
 * server-side for every channel (REST and MCP alike) and is the source of truth.
 *
 * @param {string} streetName
 * @param {string} buildingNumber
 * @param {string} buildingName
 * @returns {{address1: string, address2: string}}
 */
export function composeAddressLines(streetName, buildingNumber, buildingName) {
  const street = (streetName || '').trim();
  const number = (buildingNumber || '').trim();
  const name = (buildingName || '').trim();

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
