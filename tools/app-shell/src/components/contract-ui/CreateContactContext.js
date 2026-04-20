import { createContext } from 'react';

/**
 * Context used by SearchInput to offer a "Create contact" option at the
 * bottom of the dropdown for specific FK fields.
 *
 * Provided by custom windows (SalesOrderWindow, PurchaseOrderWindow) when a
 * recordId is present (detail / form view) and the user may need to create a
 * new Business Partner on the fly.
 *
 * Shape when provided:
 *   {
 *     fieldKey: string,          // e.g. 'businessPartner'
 *     onOpen: (query: string, onSelect: (opt: { id, name }) => void) => void
 *   }
 *
 * When the value is null (default), SearchInput renders normally without the
 * create option.
 */
export const CreateContactContext = createContext(null);
