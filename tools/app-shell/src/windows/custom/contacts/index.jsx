import BusinessPartnerPage from '@generated/contacts/generated/web/contacts/BusinessPartnerPage';
import { ContactsProvider } from './ContactsContext';
import ContactsBusinessPartnerForm from './ContactsBusinessPartnerForm';

/* eslint-disable react/prop-types */

export default function ContactsWindow(props) {
  return (
    <ContactsProvider>
      <BusinessPartnerPage {...props} Form={ContactsBusinessPartnerForm} />
    </ContactsProvider>
  );
}
