import { useLocaleSwitch } from '@/i18n/index.js';

/**
 * Dropdown component for switching between available locales.
 * Reads current locale and setter from LocaleProvider context.
 */

const AVAILABLE_LOCALES = [
  { code: 'en_US', label: 'English' },
  { code: 'es_ES', label: 'Espanol' },
];

export default function LocaleSwitcher() {
  const { locale, setLocale } = useLocaleSwitch();

  if (!setLocale) return null;

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value)}
      className="bg-background text-foreground border border-border rounded px-2 py-1 text-sm cursor-pointer hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      aria-label="Select language"
    >
      {AVAILABLE_LOCALES.map(({ code, label }) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  );
}
