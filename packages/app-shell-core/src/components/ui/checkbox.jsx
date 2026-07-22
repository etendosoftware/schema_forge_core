import { useRef, useEffect, forwardRef } from 'react';
import { cn } from '../../lib/utils.js';

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
    <label
      className={cn(
        'group relative flex items-center justify-center outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
        disabled && 'cursor-not-allowed',
        className
      )}
      {...props}
    >
      <input
        ref={inputRef}
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        aria-checked={indeterminate ? 'mixed' : !!checked}
        onClick={onClick}
        onChange={onChange}
        className="sr-only"
      />
      <div className={cn(
        'w-4 h-4 rounded border-[1.5px] border-border-control flex items-center justify-center shrink-0 transition-colors',
        !isActive && !disabled && [
          'bg-card shadow-[0px_1px_2px_rgba(18,18,23,0.05)]',
          'group-hover:bg-muted group-hover:border-icon-secondary',
        ],
        !isActive && disabled && 'bg-muted text-text-disabled',
        isActive && !disabled && [
          'bg-primary border-primary',
        ],
        isActive && disabled && 'bg-muted text-text-disabled',
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
    </label>
  );
});

export { Checkbox };
