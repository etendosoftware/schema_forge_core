import { DayPicker } from 'react-day-picker';
import { es, enUS } from 'date-fns/locale';
import { useLocaleSwitch } from '@/i18n';
import { cn } from '@/lib/utils';

const LOCALES = { es_ES: es, en_US: enUS };

export function Calendar({ className, classNames, locale, ...props }) {
  const { locale: appLocale } = useLocaleSwitch();
  const dateLocale = locale ?? LOCALES[appLocale] ?? enUS;

  return (
    <DayPicker
      showOutsideDays
      weekStartsOn={1}
      locale={dateLocale}
      captionLayout="dropdown"
      startMonth={new Date(1990, 0)}
      endMonth={new Date(2100, 11)}
      className={cn('p-2', className)}
      classNames={{
        months: 'flex flex-col gap-0',
        month: 'flex flex-col gap-0',
        month_caption: 'flex flex-row items-center gap-0 h-8',
        caption_label:
          'inline-flex items-center text-sm leading-6 font-normal text-[#121217]',
        dropdowns: 'flex flex-row items-center gap-0',
        dropdown_root:
          'relative inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted/50',
        dropdown:
          'absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none',
        chevron: 'h-3.5 w-3.5 fill-[#828FA3]',
        nav: 'hidden',
        button_previous: 'hidden',
        button_next: 'hidden',
        weekdays: 'flex justify-center gap-1 py-2',
        weekday:
          'w-8 h-4 flex items-center justify-center text-[12px] leading-4 font-normal text-[#6C6C89]',
        weeks: 'flex flex-col gap-1',
        week: 'flex justify-center gap-1',
        day: 'h-8 w-8 text-center text-[12px] leading-4 p-0 relative focus-within:relative focus-within:z-20',
        day_button:
          'h-8 w-8 p-0 font-normal text-[#121217] rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected:
          '[&>button]:bg-[#121217] [&>button]:text-white [&>button]:hover:bg-[#121217] [&>button]:hover:text-white',
        today: '[&>button]:font-semibold',
        outside: '[&>button]:text-[#1D1B20] [&>button]:opacity-[0.38]',
        disabled: 'opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      {...props}
    />
  );
}

export default Calendar;
