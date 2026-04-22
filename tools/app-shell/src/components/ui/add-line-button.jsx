import { Plus, ChevronDown } from 'lucide-react';
import { useUI } from '@/i18n';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

const GROUP_STYLE = {
  display: 'inline-flex',
  flexDirection: 'row',
  alignItems: 'stretch',
  padding: 1,
  height: 32,
  background: '#FFFFFF',
  border: '1px solid #D1D4DB',
  borderRadius: 8,
  boxShadow: '0px 1px 2px rgba(18, 18, 23, 0.05)',
  fontFamily: 'Inter, sans-serif',
  width: 'fit-content',
};

const PRIMARY_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  padding: '5px 8px',
  background: '#FFFFFF',
  border: 'none',
  borderRadius: '7px 0 0 7px',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '20px',
  color: '#121217',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'background-color 0.15s ease',
};

const DIVIDER_STYLE = {
  width: 1,
  alignSelf: 'stretch',
  background: '#E8EAEF',
};

const CHEVRON_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '5px 8px',
  background: '#FFFFFF',
  border: 'none',
  borderRadius: '0 7px 7px 0',
  cursor: 'pointer',
  transition: 'background-color 0.15s ease',
};

const DISABLED_OVERLAY = { opacity: 0.5, cursor: 'not-allowed' };

/**
 * Split button matching the Figma "Añadir línea" design (ETP-3835).
 *
 * Props:
 *   onClick      — main button click (primary "add line" action)
 *   label        — button text
 *   disabled     — disables both buttons
 *   menuActions  — optional array of { key, label, icon?, onClick, disabled?, destructive? }
 *                  When provided, the chevron opens a dropdown with these items.
 *                  When omitted, the chevron falls back to triggering `onClick`.
 */
export function AddLineButton({ onClick, label, disabled = false, menuActions }) {
  const ui = useUI();
  const hasMenu = Array.isArray(menuActions) && menuActions.length > 0;

  const primaryButton = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
      style={{ ...PRIMARY_STYLE, ...(disabled ? DISABLED_OVERLAY : null) }}
    >
      <Plus size={20} color="#828FA3" strokeWidth={2} />
      <span>{label}</span>
    </button>
  );

  const chevronButton = (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
      style={{ ...CHEVRON_STYLE, ...(disabled ? DISABLED_OVERLAY : null) }}
      aria-label="More actions"
    >
      <ChevronDown size={20} color="#828FA3" strokeWidth={2} />
    </button>
  );

  return (
    <span style={GROUP_STYLE}>
      {primaryButton}
      <span style={DIVIDER_STYLE} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{chevronButton}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4}>
          {hasMenu ? (
            menuActions.map((action) => (
              <DropdownMenuItem
                key={action.key ?? action.label}
                onSelect={action.onClick}
                disabled={action.disabled}
                className={action.destructive ? 'text-destructive focus:text-destructive' : undefined}
              >
                {action.icon ? <span className="mr-2 inline-flex">{action.icon}</span> : null}
                {action.label}
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled className="text-xs italic text-muted-foreground">
              {ui('noAdditionalActions')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
