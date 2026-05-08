import { useRef, useEffect, forwardRef } from 'react';
import { cn } from '@/lib/utils';

const Checkbox = forwardRef(function Checkbox(
  { checked, indeterminate, disabled, onChange, onClick, className, ...props },
  _ref
) {
  const inputRef = useRef(null);
  const isActive = checked || indeterminate;

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = !!indeterminate;
  }, [indeterminate]);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : !!checked}
      disabled={disabled}
      onClick={(e) => { onClick?.(e); onChange?.(e); }}
      className={cn(
        'group relative flex items-center justify-center outline-none cursor-pointer',
        disabled && 'cursor-not-allowed',
        className
      )}
      {...props}
    >
      <input
        ref={inputRef}
        type="checkbox"
        checked={!!checked}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
      <div className={cn(
        'w-4 h-4 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors',
        !isActive && !disabled && [
          'bg-white border-[#D1D4DB] shadow-[0px_1px_2px_rgba(18,18,23,0.05)]',
          'group-hover:bg-[#F5F7F9] group-hover:border-[#828FA3]',
          'group-focus-visible:shadow-[0_0_0_2px_#FFFFFF,0_0_0_4px_#121217]',
        ],
        !isActive && disabled && 'bg-[#F5F7F9] border-[#D1D4DB]',
        isActive && !disabled && [
          'bg-[#121217] border-[#121217]',
          'group-focus-visible:shadow-[0_0_0_2px_#FFFFFF,0_0_0_4px_#121217]',
        ],
        isActive && disabled && 'bg-[#D1D4DB] border-[#D1D4DB]',
      )}>
        {checked && !indeterminate && (
          <svg width="8" height="6" viewBox="-0.5 -0.5 8 6" fill="none">
            <path
              d="M0.5 2.5 L2.5 4.5 L6.5 0.5"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {indeterminate && (
          <div className="w-2 h-[2px] bg-white rounded-sm" />
        )}
      </div>
    </button>
  );
});

export { Checkbox };
