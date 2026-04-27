import BusinessPartnerPage from '@generated/contacts/generated/web/contacts/BusinessPartnerPage';
import { ContactsProvider } from './ContactsContext';
import ContactsBusinessPartnerForm from './ContactsBusinessPartnerForm';

/* eslint-disable react/prop-types */

const CONTACTS_WRAPPER = '[&_tr[data-empty-state]]:hidden';

export default function ContactsWindow(props) {
  return (
    <ContactsProvider>
      <div className={CONTACTS_WRAPPER}>
        <BusinessPartnerPage {...props} Form={ContactsBusinessPartnerForm} enableSecondaryRowDelete={true} sidebarClassName="w-[30%] shrink-0 overflow-y-auto border-l border-[#E8EAEF]" noHeaderBorder={true} toolbarBorderBottom={true} />
      </div>
    </ContactsProvider>
  );
}
