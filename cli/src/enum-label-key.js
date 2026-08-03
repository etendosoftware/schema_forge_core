function toWords(str) {
  return String(str || '')
    // Preserve +/- as meaningful words instead of dropping them as mere
    // separators — e.g. AD_Ref_List's MovementType has "Production -" and
    // "Production +" as distinct values that must not collapse to one key.
    .replace(/\+/g, ' Plus ')
    .replace(/-/g, ' Minus ')
    // Split PascalCase/camelCase compounds (e.g. "ProductType") into words
    // before splitting on non-alphanumeric separators.
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Builds a stable, column-scoped i18n key for a List-reference (AD_Ref_List)
 * value, e.g. buildEnumLabelKey('ProductType', 'Item') -> 'productTypeItem'.
 *
 * Scoping by column name (rather than a global key by Value alone) avoids
 * collisions between unrelated reference lists that happen to share a short
 * code (e.g. 'I', 'S') across different tables — see ETP-4685.
 */
export function buildEnumLabelKey(columnName, valueName) {
  const words = [...toWords(columnName), ...toWords(valueName)];
  const pascal = words.map(capitalize).join('');
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
