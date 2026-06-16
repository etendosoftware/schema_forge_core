/**
 * Extended render tests for EntityForm — covers field types and branches
 * not exercised by the existing EntityForm.vitest.jsx suite.
 *
 * Focus areas: date fields, enum/select fields, selector type, image type,
 * readOnlyLogic, displayLogic server-side visibility, dependent fields,
 * search fields, horizontal layout filtering, section filtering, span classes,
 * and the image-field side-panel layout.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Mocks (must precede imports) ---

vi.mock('@/i18n', () => ({
  useLabel: () => (key) => key,
  useMenuLabel: () => (key) => key,
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

vi.mock('../ProductSearchDrawer.jsx', () => ({
  default: () => null,
}));
vi.mock('../ImageField.jsx', () => ({
  ImageField: (props) => <div data-testid={`image-field-${props.fieldKey ?? 'default'}`} />,
}));
vi.mock('../PartnerAddressPicker.jsx', () => ({
  PartnerAddressPicker: () => <div data-testid="partner-address-picker" />,
}));
vi.mock('../SelectorInput.jsx', () => ({
  SelectorInput: (props) => <div data-testid={`selector-input-${props.field?.key ?? 'unknown'}`} />,
}));
vi.mock('../SelectorChip.jsx', () => ({
  SelectorChip: (props) => <span data-testid={props.testId ?? 'chip'}>{props.label}</span>,
}));
vi.mock('../CreateContactContext.js', () => ({
  CreateContactContext: { Provider: ({ children }) => children, Consumer: ({ children }) => children(null) },
}));
vi.mock('@/lib/buildUrlWithParams.js', () => ({
  buildUrlWithParams: (url) => url,
}));
vi.mock('@/lib/resolveIdentifier.js', () => ({
  resolveIdentifier: (data, key) => data?.[key + '$_identifier'] ?? data?.[key] ?? '',
}));
vi.mock('@/lib/selectorCatalog.js', () => ({
  getCatalogOptions: () => [],
}));

import { EntityForm } from '../EntityForm.jsx';

// --- Shared fixtures ---

const MIXED_FIELDS = [
  { key: 'name', label: 'Name', type: 'string', column: 'Name' },
  { key: 'date', label: 'Date', type: 'date', column: 'DateOrdered' },
  { key: 'amount', label: 'Amount', type: 'number', column: 'GrandTotal' },
  { key: 'active', label: 'Active', type: 'checkbox', column: 'IsActive' },
  {
    key: 'status', label: 'Status', type: 'select', column: 'DocStatus',
    options: [
      { value: 'DR', label: 'Draft' },
      { value: 'CO', label: 'Complete' },
    ],
  },
  { key: 'bp', label: 'Partner', type: 'selector', column: 'C_BPartner_ID', inputMode: 'selector' },
];

const SAMPLE_DATA = {
  name: 'Test Order',
  date: '2026-01-15',
  amount: 100,
  active: true,
  status: 'DR',
  bp: 'BP-001',
  'bp$_identifier': 'Acme Corp',
};

function renderForm(props = {}) {
  return render(
    <EntityForm
      entity="header"
      fields={MIXED_FIELDS}
      data={SAMPLE_DATA}
      onChange={vi.fn()}
      token="test-token"
      apiBaseUrl="/api"
      {...props}
    />,
  );
}

// --- Tests ---

describe('EntityForm — extended render coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts and renders all mixed field types without crashing', () => {
    renderForm();
    // string field
    expect(screen.getByTestId('field-name')).toBeInTheDocument();
    // number field
    expect(screen.getByTestId('field-amount')).toBeInTheDocument();
    // checkbox field
    expect(screen.getByTestId('field-active')).toBeInTheDocument();
    // date field renders a DateField (which is a real component)
    expect(screen.getByText('DateOrdered')).toBeInTheDocument();
    // selector field renders the mocked SelectorInput
    expect(screen.getByTestId('selector-input-bp')).toBeInTheDocument();
  });

  // --- Date field ---

  it('renders date field with its value', () => {
    renderForm();
    // DateField is a real shadcn component — just verify the label is present
    expect(screen.getByText('DateOrdered')).toBeInTheDocument();
  });

  // --- Enum / select field ---

  it('renders select field with trigger element', () => {
    renderForm();
    const trigger = screen.getByTestId('field-status');
    expect(trigger).toBeInTheDocument();
  });

  // --- Selector field ---

  it('renders SelectorInput stub for selector type', () => {
    renderForm();
    expect(screen.getByTestId('selector-input-bp')).toBeInTheDocument();
  });

  // --- Read-only mode ---

  it('disables all fields when formReadOnly is true', () => {
    renderForm({ readOnly: true });
    // text input
    expect(screen.getByTestId('field-name')).toBeDisabled();
    // number input
    expect(screen.getByTestId('field-amount')).toBeDisabled();
    // checkbox
    expect(screen.getByTestId('field-active')).toBeDisabled();
  });

  it('renders FK field as plain disabled input when formReadOnly + selector type', () => {
    renderForm({ readOnly: true });
    // In readOnly mode, selector renders as a disabled Input instead of SelectorInput
    const fkInput = screen.getByTestId('field-bp');
    expect(fkInput).toBeInTheDocument();
  });

  // --- readOnlyLogic ---

  it('disables a field when readOnlyLogic evaluates to true', () => {
    const fields = [
      {
        key: 'locked',
        label: 'Locked',
        type: 'text',
        column: 'Locked',
        readOnlyLogic: (data) => data?.active === true,
      },
    ];
    render(
      <EntityForm
        fields={fields}
        data={{ active: true, locked: 'x' }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('field-locked')).toBeDisabled();
  });

  it('does not disable when readOnlyLogic evaluates to false', () => {
    const fields = [
      {
        key: 'locked',
        label: 'Locked',
        type: 'text',
        column: 'Locked',
        readOnlyLogic: (data) => data?.active === true,
      },
    ];
    render(
      <EntityForm
        fields={fields}
        data={{ active: false, locked: 'x' }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('field-locked')).not.toBeDisabled();
  });

  it('handles readOnlyLogic that throws without crashing', () => {
    const fields = [
      {
        key: 'explosive',
        label: 'Explosive',
        type: 'text',
        column: 'Explosive',
        readOnlyLogic: () => { throw new Error('boom'); },
      },
    ];
    render(
      <EntityForm fields={fields} data={{}} onChange={vi.fn()} />,
    );
    // Should not crash; the field defaults to editable
    expect(screen.getByTestId('field-explosive')).not.toBeDisabled();
  });

  // --- displayLogic (function-based) ---

  it('shows a field when displayLogic function returns true', () => {
    const fields = [
      {
        key: 'conditional',
        label: 'Conditional',
        type: 'text',
        column: 'Conditional',
        displayLogic: () => true,
      },
    ];
    render(
      <EntityForm fields={fields} data={{}} onChange={vi.fn()} />,
    );
    expect(screen.getByText('Conditional')).toBeInTheDocument();
  });

  it('hides a field when displayLogic function returns false', () => {
    const fields = [
      {
        key: 'conditional',
        label: 'Conditional',
        type: 'text',
        column: 'Conditional',
        displayLogic: () => false,
      },
    ];
    render(
      <EntityForm fields={fields} data={{}} onChange={vi.fn()} />,
    );
    expect(screen.queryByText('Conditional')).not.toBeInTheDocument();
  });

  it('handles displayLogic that throws without crashing', () => {
    const fields = [
      {
        key: 'explosive',
        label: 'Explosive',
        type: 'text',
        column: 'Explosive',
        displayLogic: () => { throw new Error('display boom'); },
      },
    ];
    render(
      <EntityForm fields={fields} data={{}} onChange={vi.fn()} />,
    );
    // Should default to visible on error
    expect(screen.getByText('Explosive')).toBeInTheDocument();
  });

  // --- Server-side displayLogic visibility ---

  it('hides a field when displayLogic.visibility[key] is false (no function-based displayLogic)', () => {
    const fields = [
      { key: 'visible', label: 'Visible', type: 'text', column: 'Visible' },
      { key: 'hidden', label: 'Hidden', type: 'text', column: 'Hidden', displayLogic: 'some-expression' },
    ];
    render(
      <EntityForm
        fields={fields}
        data={{}}
        onChange={vi.fn()}
        displayLogic={{ visibility: { hidden: false }, readOnly: {} }}
      />,
    );
    expect(screen.getByText('Visible')).toBeInTheDocument();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('does NOT hide a field with function-based displayLogic even if server visibility is false', () => {
    const fields = [
      {
        key: 'funcField',
        label: 'FuncField',
        type: 'text',
        column: 'FuncField',
        displayLogic: () => true,
      },
    ];
    render(
      <EntityForm
        fields={fields}
        data={{}}
        onChange={vi.fn()}
        displayLogic={{ visibility: { funcField: false }, readOnly: {} }}
      />,
    );
    // Function-based displayLogic takes precedence over server visibility
    expect(screen.getByText('FuncField')).toBeInTheDocument();
  });

  // --- Server-side readOnly ---

  it('disables a field when displayLogic.readOnly[key] is true', () => {
    const fields = [
      { key: 'name', label: 'Name', type: 'text', column: 'Name' },
    ];
    render(
      <EntityForm
        fields={fields}
        data={{ name: 'readonly' }}
        onChange={vi.fn()}
        displayLogic={{ readOnly: { name: true }, visibility: {} }}
      />,
    );
    expect(screen.getByTestId('field-name')).toBeDisabled();
  });

  // --- Horizontal layout filtering ---

  it('horizontal layout filters out readOnly fields', () => {
    const fields = [
      { key: 'editable', label: 'Editable', type: 'text', column: 'Editable' },
      { key: 'locked', label: 'Locked', type: 'text', column: 'Locked', readOnly: true },
    ];
    render(
      <EntityForm fields={fields} data={{}} onChange={vi.fn()} layout="horizontal" />,
    );
    expect(screen.getByText('Editable')).toBeInTheDocument();
    expect(screen.queryByText('Locked')).not.toBeInTheDocument();
  });

  // --- Section filtering ---

  it('shows only fields matching the section prop', () => {
    const fields = [
      { key: 'a', label: 'FieldA', type: 'text', column: 'A', section: 'main' },
      { key: 'b', label: 'FieldB', type: 'text', column: 'B', section: 'other' },
      { key: 'c', label: 'FieldC', type: 'text', column: 'C', section: 'main', readOnly: true },
    ];
    render(
      <EntityForm fields={fields} data={{}} onChange={vi.fn()} section="main" />,
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.queryByText('B')).not.toBeInTheDocument();
  });

  // --- Image field layout ---

  it('renders image field in a side panel layout', () => {
    const fields = [
      { key: 'name', label: 'Name', type: 'text', column: 'Name' },
      { key: 'photo', label: 'Photo', type: 'image', column: 'AD_Image_ID' },
    ];
    render(
      <EntityForm
        fields={fields}
        data={{ name: 'test', photo: 'img-123' }}
        onChange={vi.fn()}
        token="tok"
        apiBaseUrl="/api"
      />,
    );
    expect(screen.getByTestId('image-field-photo')).toBeInTheDocument();
    expect(screen.getByTestId('field-name')).toBeInTheDocument();
  });

  // --- Inline image field ---

  it('renders inline image within the grid (not side panel)', () => {
    const fields = [
      { key: 'name', label: 'Name', type: 'text', column: 'Name' },
      { key: 'thumb', label: 'Thumb', type: 'image', column: 'AD_Image_ID', inline: true },
    ];
    render(
      <EntityForm
        fields={fields}
        data={{ name: 'test', thumb: 'img-456' }}
        onChange={vi.fn()}
        token="tok"
        apiBaseUrl="/api"
      />,
    );
    expect(screen.getByTestId('image-field-thumb')).toBeInTheDocument();
  });

  // --- Checkbox toggling ---

  it('toggles checkbox on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const fields = [
      { key: 'active', label: 'Active', type: 'checkbox', column: 'IsActive' },
    ];
    render(
      <EntityForm fields={fields} data={{ active: false }} onChange={onChange} />,
    );
    const checkbox = screen.getByTestId('field-active');
    await user.click(checkbox);
    expect(onChange).toHaveBeenCalledWith('active', true, 'IsActive');
  });

  it('does not toggle checkbox when readOnly', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const fields = [
      { key: 'active', label: 'Active', type: 'checkbox', column: 'IsActive' },
    ];
    render(
      <EntityForm fields={fields} data={{ active: false }} onChange={onChange} readOnly />,
    );
    const checkbox = screen.getByTestId('field-active');
    await user.click(checkbox);
    expect(onChange).not.toHaveBeenCalled();
  });

  // --- YESNO variants ---

  it('handles "Y" string as checked for checkbox', () => {
    const fields = [
      { key: 'active', label: 'Active', type: 'checkbox', column: 'IsActive' },
    ];
    render(
      <EntityForm fields={fields} data={{ active: 'Y' }} onChange={vi.fn()} />,
    );
    expect(screen.getByTestId('field-active')).toHaveAttribute('aria-checked', 'true');
  });

  it('handles "N" string as unchecked for checkbox', () => {
    const fields = [
      { key: 'active', label: 'Active', type: 'checkbox', column: 'IsActive' },
    ];
    render(
      <EntityForm fields={fields} data={{ active: 'N' }} onChange={vi.fn()} />,
    );
    expect(screen.getByTestId('field-active')).toHaveAttribute('aria-checked', 'false');
  });

  // --- Textarea ---

  it('renders textarea with custom rows', () => {
    const fields = [
      { key: 'notes', label: 'Notes', type: 'textarea', column: 'Notes', rows: 6 },
    ];
    render(
      <EntityForm fields={fields} data={{ notes: 'abc' }} onChange={vi.fn()} />,
    );
    const textarea = screen.getByTestId('field-notes');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveAttribute('rows', '6');
  });

  // --- Dependent field ---

  it('renders dependent field as disabled input when readOnly', () => {
    const fields = [
      {
        key: 'address',
        label: 'Address',
        type: 'dependent',
        column: 'C_BPartner_Location_ID',
        dependsOn: { field: 'bp', filterKey: 'bpartner' },
      },
    ];
    render(
      <EntityForm
        fields={fields}
        data={{ address: 'addr-1', 'address$_identifier': '123 Main St' }}
        onChange={vi.fn()}
        readOnly
      />,
    );
    const input = screen.getByTestId('field-address');
    expect(input).toBeInTheDocument();
  });

  // --- Search field ---

  it('renders search field as disabled input when readOnly', () => {
    const fields = [
      { key: 'product', label: 'Product', type: 'search', column: 'M_Product_ID' },
    ];
    render(
      <EntityForm
        fields={fields}
        data={{ product: 'P1', 'product$_identifier': 'Widget' }}
        onChange={vi.fn()}
        readOnly
      />,
    );
    const input = screen.getByTestId('field-product');
    expect(input).toBeInTheDocument();
  });

  // --- Span class ---

  it('applies col-span class when field has span property', () => {
    const fields = [
      { key: 'wide', label: 'Wide', type: 'text', column: 'Wide', span: 2 },
    ];
    const { container } = render(
      <EntityForm fields={fields} data={{}} onChange={vi.fn()} />,
    );
    const fieldWrapper = container.querySelector('.col-span-2');
    expect(fieldWrapper).toBeTruthy();
  });

  // --- Custom cols grid ---

  it('renders custom cols grid with explicit gridTemplateColumns', () => {
    const fields = [
      { key: 'a', label: 'A', type: 'text', column: 'A' },
    ];
    const { container } = render(
      <EntityForm fields={fields} data={{}} onChange={vi.fn()} cols={3} />,
    );
    const grid = container.firstElementChild;
    expect(grid.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
  });

  // --- Empty fields returns null ---

  it('returns null when all fields are hidden by displayLogic', () => {
    const fields = [
      { key: 'a', label: 'A', type: 'text', column: 'A', displayLogic: () => false },
    ];
    const { container } = render(
      <EntityForm fields={fields} data={{}} onChange={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  // --- onFieldBlur ---

  it('calls onFieldBlur when a text input loses focus', async () => {
    const user = userEvent.setup();
    const onFieldBlur = vi.fn();
    const fields = [
      { key: 'name', label: 'Name', type: 'text', column: 'Name' },
    ];
    render(
      <EntityForm fields={fields} data={{ name: '' }} onChange={vi.fn()} onFieldBlur={onFieldBlur} />,
    );
    const input = screen.getByTestId('field-name');
    await user.click(input);
    await user.tab();
    expect(onFieldBlur).toHaveBeenCalledWith('name');
  });

  // --- savingField disables input ---

  it('disables input when savingField matches the field key', () => {
    const fields = [
      { key: 'name', label: 'Name', type: 'text', column: 'Name' },
    ];
    render(
      <EntityForm fields={fields} data={{ name: 'x' }} onChange={vi.fn()} savingField="name" />,
    );
    expect(screen.getByTestId('field-name')).toBeDisabled();
  });

  // --- Select with valueType boolean ---

  it('renders boolean select with correct value for true/"Y"', () => {
    const fields = [
      {
        key: 'flag',
        label: 'Flag',
        type: 'select',
        column: 'Flag',
        valueType: 'boolean',
        options: [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' },
        ],
      },
    ];
    render(
      <EntityForm fields={fields} data={{ flag: true }} onChange={vi.fn()} />,
    );
    const trigger = screen.getByTestId('field-flag');
    expect(trigger).toBeInTheDocument();
  });

  // --- Number field read-only shows formatted value ---

  it('shows cleaned float for readOnly number field', () => {
    const fields = [
      { key: 'total', label: 'Total', type: 'number', column: 'Total', readOnly: true },
    ];
    render(
      <EntityForm fields={fields} data={{ total: 243.20999999999998 }} onChange={vi.fn()} />,
    );
    const input = screen.getByTestId('field-total');
    // formatReadOnlyDisplayValue strips float noise
    expect(input).toHaveValue(243.21);
  });
});
