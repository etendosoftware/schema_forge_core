import BusinessPartnerPage from '@generated/contacts/generated/web/contacts/BusinessPartnerPage';
import { ContactsProvider } from './ContactsContext';
import ContactsBusinessPartnerForm from './ContactsBusinessPartnerForm';
import { useUI } from '@/i18n';
import { SortIcon, RefreshIcon } from '@/components/ui/custom-icons';

/* eslint-disable react/prop-types */

const CONTACTS_WRAPPER = 'flex-1 min-h-0 flex flex-col [&_tr[data-empty-state]]:hidden [&_button[role=checkbox]]:h-full contacts-rows';

const isPerson = (r) => r.etgoIsperson === true || r.etgoIsperson === 'Y';

// Overrides the generated BusinessPartnerPage's subsetFilters (Todos/Clientes/Proveedores)
// with Todos/Personas/Empresas. Works because the generated page spreads {...props} after
// its hardcoded subsetFilters, so this value wins via JSX prop precedence (last wins).
const SUBSET_FILTERS = [
  { label: 'all' },
  { label: 'persons',  rowFilter: isPerson },
  { label: 'companies', rowFilter: (r) => !isPerson(r) },
];

export default function ContactsWindow(props) {
  const ui = useUI();
  return (
    <ContactsProvider>
      <div className={CONTACTS_WRAPPER}>
        <BusinessPartnerPage {...props} Form={ContactsBusinessPartnerForm} subsetFilters={SUBSET_FILTERS} autoSaveOnBlur={true} enableSecondaryRowDelete={true} sidebarClassName="w-[30%] shrink-0 overflow-y-auto border-l border-[#E8EAEF]" noHeaderBorder={true} toolbarBorderBottom={true} toolbarPaddingX="px-2" newLabel={ui('newContact')} listbarPaddingX="px-2" SortIconComponent={SortIcon} RefreshIconComponent={RefreshIcon} iconButtonHover="hover:bg-[#F5F7F9]" tablePaddingX="px-2" hoverRowActions={true} />
      </div>
    </ContactsProvider>
  );
}
