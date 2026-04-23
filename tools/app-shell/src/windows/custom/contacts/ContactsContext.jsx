import { createContext, useContext, useState, useMemo } from 'react';

const ContactsContext = createContext(null);

export function ContactsProvider({ children }) {
  const [personType, setPersonType] = useState('company');
  const value = useMemo(() => ({ personType, setPersonType }), [personType]);
  return <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>;
}

export function useContactsType() {
  const ctx = useContext(ContactsContext);
  if (!ctx) throw new Error('useContactsType must be used inside ContactsProvider');
  return ctx;
}
