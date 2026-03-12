/**
 * Section markers for generated code preservation.
 *
 * These delimiters mark boundaries between generated and custom code in
 * Schema Forge frontend components. During regeneration, custom sections
 * are extracted from the old file and re-injected into the new one.
 *
 * @module custom-section-markers
 */

/** Marker prefix used for all Schema Forge section delimiters. */
export const SF_PREFIX = '@sf-';

/**
 * Delimiter templates for generated/custom code boundaries.
 *
 * IDs should be meaningful and stable across regenerations:
 *   - `fields:invoice`, `component:InvoiceForm`
 *   - `callout:BP_AutoFill_Address`, `handler:onBusinessPartnerChange`
 *   - `section:custom-logic`, `hooks:InvoiceForm`
 */
export const MARKERS = {
  /** Start of a generated code block (will be overwritten on regeneration). */
  GENERATED_START: (id) => `// @sf-generated-start ${id}`,
  /** End of a generated code block. */
  GENERATED_END: (id) => `// @sf-generated-end ${id}`,

  /** Start of a custom code block (preserved across regenerations). */
  CUSTOM_START: (id) => `// @sf-custom-start ${id}`,
  /** End of a custom code block. */
  CUSTOM_END: (id) => `// @sf-custom-end ${id}`,

  /** Placeholder slot where custom code can be inserted. */
  CUSTOM_SLOT: (id) => `// @sf-custom-slot ${id}`,
};

/**
 * Regex patterns for parsing marker lines.
 * Each captures the section ID in group 1.
 */
export const PATTERNS = {
  GENERATED_START: /^\/\/\s*@sf-generated-start\s+(.+)$/,
  GENERATED_END: /^\/\/\s*@sf-generated-end\s+(.+)$/,
  CUSTOM_START: /^\/\/\s*@sf-custom-start\s+(.+)$/,
  CUSTOM_END: /^\/\/\s*@sf-custom-end\s+(.+)$/,
  CUSTOM_SLOT: /^\/\/\s*@sf-custom-slot\s+(.+)$/,
};
