import BusinessPartnerPage from '@generated/contacts/generated/web/contacts/BusinessPartnerPage';
import { ContactsProvider } from './ContactsContext';
import ContactsBusinessPartnerForm from './ContactsBusinessPartnerForm';
import ContactsProfileProgress from './ContactsProfileProgress';

/* eslint-disable react/prop-types */

const TABLE_CELL_BORDERS = [
  '[&_thead_th]:border-r',
  '[&_thead_th]:border-r-[#E8EAEF]',
  '[&_tbody_td]:border-r',
  '[&_tbody_td]:border-r-[#E8EAEF]',
  '[&_thead_th:last-child]:border-r-0',
  '[&_tbody_td:last-child]:border-r-0',
  '[&_tr[data-empty-state]]:hidden',
].join(' ');

export default function ContactsWindow(props) {
  return (
    <ContactsProvider>
      <div className={TABLE_CELL_BORDERS}>
        <BusinessPartnerPage {...props} Form={ContactsBusinessPartnerForm} enableSecondaryRowDelete={true} sidebarClassName="w-[30%] shrink-0 overflow-y-auto border-l border-[#E8EAEF]" noHeaderBorder={true} toolbarBorderBottom={true} tabsBarRightDivider="30%" tabsBarRight={ContactsProfileProgress} />
      </div>
    </ContactsProvider>
  );
}
