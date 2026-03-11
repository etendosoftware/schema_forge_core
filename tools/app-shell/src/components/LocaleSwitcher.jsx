import { useLocaleSwitch } from '@/i18n/index.js';

const LOCALES = [
  { code: 'en_US', flag: '🇺🇸', short: 'EN' },
  { code: 'es_ES', flag: '🇪🇸', short: 'ES' },
];

export default function LocaleSwitcher() {
  const { locale, setLocale } = useLocaleSwitch();

  if (!setLocale) return null;

  const current = LOCALES.find((l) => l.code === locale) || LOCALES[0];
  const next = LOCALES.find((l) => l.code !== locale) || LOCALES[1];

  return (
    <button
      onClick={() => setLocale(next.code)}
      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      aria-label={`Switch to ${next.short}`}
      title={`${current.short} / ${next.short}`}
    >
      <span className="text-sm leading-none">{current.flag}</span>
      <span className="font-medium">{current.short}</span>
    </button>
  );
}
