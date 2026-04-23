export const contactModalConfig = {
  headerFields: [
    { id: 'name', labelKey: 'contactName', type: 'text', required: true },
    {
      id: 'taxIdType',
      labelKey: 'taxIdTypeField',
      type: 'dynamicSelect',
      optionsKey: 'taxIdTypes',
    },
    { id: 'taxID', labelKey: 'taxIDField', type: 'text', placeholder: 'B-12345678', required: true },
  ],
  sections: [
    {
      id: 'general',
      labelKey: 'direccionTab',
      component: 'AddressSection',
    },
    {
      id: 'financial',
      labelKey: 'financieroTab',
      component: 'FinancialSection',
    },
    {
      id: 'contacts',
      labelKey: 'contactPersonTab',
      repeatable: true,
      initialRows: 1,
      noHeaders: true,
      countsToProgress: true,
      emptyTextKey: 'noContactsYet',
      addLabelKey: 'addContactPerson',
      fields: [
        { id: 'firstName', labelKey: 'contactFirstName', type: 'text' },
        { id: 'lastName', labelKey: 'contactLastName', type: 'text' },
        { id: 'email', labelKey: 'contactEmail', type: 'email' },
        { id: 'phone', labelKey: 'contactPhone', type: 'tel' },
      ],
    },
    {
      id: 'bankAccount',
      labelKey: 'bankTab',
      repeatable: true,
      initialRows: 1,
      noHeaders: true,
      countsToProgress: true,
      emptyTextKey: 'noBankAccountsYet',
      addLabelKey: 'addBankAccount',
      fields: [
        { id: 'bankName', labelKey: 'bankNameField', type: 'text' },
        { id: 'bankAccountFormat', labelKey: 'bankAccountFormatField', type: 'select', options: [
          { id: 'GENERIC', label: 'Generic account no.' },
          { id: 'IBAN', label: 'IBAN' },
          { id: 'SWIFT', label: 'SWIFT + Generic account no.' },
          { id: 'SPANISH', label: 'Spanish' },
        ]},
        { id: 'genericAccountNo', labelKey: 'genericAccountNoField', type: 'text' },
        { id: 'iban', labelKey: 'ibanField', type: 'text' },
      ],
    },
    {
      id: 'more',
      labelKey: 'masTab',
      plain: true,
      fields: [
        { id: 'etgoEmail', labelKey: 'contactEmail', type: 'email' },
        { id: 'etgoPhone', labelKey: 'contactPhone', type: 'tel' },
        { id: 'etgoWeb', labelKey: 'websiteField', type: 'text' },
      ],
    },
  ],
  requiredFields: ['name', 'taxID', 'country'],
  progressFields: ['name', 'taxID', 'taxIdType', 'address', 'country', 'city'],
};
