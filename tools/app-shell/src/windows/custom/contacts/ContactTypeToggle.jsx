import { useUI } from '@/i18n';
import { useContactsType } from './ContactsContext';

/* eslint-disable react/prop-types */

export default function ContactTypeToggle({ data }) {
  const ui = useUI();
  const { personType: selected, setPersonType: setSelected } = useContactsType();

  if (!data) return null;

  return (
    <div
      className="flex items-center gap-1 p-1 rounded-xl"
      style={{ background: '#F5F7F9' }}
    >
      <button
        type="button"
        onClick={() => setSelected('person')}
        className="flex-1 h-8 px-2 text-sm font-medium rounded-lg transition-all"
        style={
          selected === 'person'
            ? {
                background: '#FFFFFF',
                color: '#121217',
                boxShadow: '0px 1px 3px rgba(18,18,23,0.10), 0px 1px 2px rgba(18,18,23,0.06)',
              }
            : { color: '#121217' }
        }
      >
        {ui('Person')}
      </button>
      <button
        type="button"
        onClick={() => setSelected('company')}
        className="flex-1 h-8 px-2 text-sm font-medium rounded-lg transition-all"
        style={
          selected === 'company'
            ? {
                background: '#FFFFFF',
                color: '#121217',
                boxShadow: '0px 1px 3px rgba(18,18,23,0.10), 0px 1px 2px rgba(18,18,23,0.06)',
              }
            : { color: '#121217' }
        }
      >
        {ui('company')}
      </button>
    </div>
  );
}
