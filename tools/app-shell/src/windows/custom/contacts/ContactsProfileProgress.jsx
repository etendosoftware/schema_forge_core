import { useMemo } from 'react';
import { useUI } from '@/i18n';
import { useContactsType } from './ContactsContext';

const PROGRESS_FIELDS = {
  company: ['name', 'taxID', 'etgoEmail', 'etgoPhone', 'etgoWeb'],
  person: ['etgoFirstname', 'etgoLastname', 'taxID', 'etgoEmail', 'etgoPhone'],
};

/* eslint-disable react/prop-types */
export default function ContactsProfileProgress({ data }) {
  const ui = useUI();
  const { personType } = useContactsType();

  const progress = useMemo(() => {
    if (!data) return 0;
    const fields = PROGRESS_FIELDS[personType] ?? PROGRESS_FIELDS.company;
    const filled = fields.filter(id => {
      const val = data[id];
      return val !== undefined && val !== null && val !== '' && val !== false;
    }).length;
    return Math.round((filled / fields.length) * 100);
  }, [data, personType]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#374151', flexShrink: 0 }}>
      <span style={{ whiteSpace: 'nowrap' }}>{ui('profileComplete')}</span>
      <div style={{ width: '64px', height: '6px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: '#121217', borderRadius: '999px', width: `${progress}%`, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', width: '28px', textAlign: 'right' }}>{progress}%</span>
    </div>
  );
}
