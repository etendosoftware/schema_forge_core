import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'es_ES' }),
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { error: (...a) => toastError(...a) },
}));

// We avoid mounting the real Radix dialog (portals + animation) and replace
// it with a transparent pass-through that just renders its children when
// `open=true`. Test scope: state machine + footer buttons + body view.
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }) => (open ? <div data-testid="import-modal">{children}</div> : null),
  DialogContent: ({ children }) => <div>{children}</div>,
}));

// Stub the preview + import hooks so we drive the view machine end-to-end.
const previewStatement = vi.fn();
const importStatement = vi.fn();
const previewingRef = { value: false };
const importingRef = { value: false };
vi.mock('@/hooks/useStatementPreview', () => ({
  useStatementPreview: () => ({
    previewStatement,
    previewing: previewingRef.value,
    error: null,
  }),
}));
vi.mock('@/hooks/useStatementImport', () => ({
  useStatementImport: () => ({
    importStatement,
    importing: importingRef.value,
    error: null,
  }),
}));

import { ImportStatementModal } from '../ImportStatementModal.jsx';

// jsdom does not implement FileReader.readAsDataURL on Files, so we stub it
// minimally for the duration of the test.
class StubFileReader {
  constructor() {
    this.result = null;
    this.onload = null;
    this.onerror = null;
  }
  readAsDataURL() {
    this.result = 'data:text/plain;base64,ZmFrZS1iYXNlNjQ=';
    queueMicrotask(() => this.onload?.());
  }
}

function makeFile(name = 'extracto.c43') {
  return new File(['fake'], name, { type: 'text/plain' });
}

const PREVIEW_DATA = {
  format: 'C43',
  lineCount: 12,
  totalIn: 250.5,
  totalOut: 50,
  periodFrom: '2026-05-01T00:00:00Z',
  periodTo: '2026-05-31T00:00:00Z',
  fileName: 'extracto.c43',
  lines: [
    { lineNo: 1, date: '2026-05-01T00:00:00Z', description: 'INGRESO 1', cramount: 100, dramount: 0 },
    { lineNo: 2, date: '2026-05-02T00:00:00Z', description: 'CARGO 1', cramount: 0, dramount: 30 },
  ],
};

function defaultProps(overrides = {}) {
  return {
    open: true,
    accountId: 'acc-1',
    accountCurrency: 'EUR',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    onOpenStatement: vi.fn(),
    ...overrides,
  };
}

describe('ImportStatementModal', () => {
  beforeEach(() => {
    previewStatement.mockReset();
    importStatement.mockReset();
    toastError.mockReset();
    previewingRef.value = false;
    importingRef.value = false;
    globalThis.FileReader = StubFileReader;
  });

  it('returns null body when open=false', () => {
    render(<ImportStatementModal {...defaultProps({ open: false })} />);
    expect(screen.queryByTestId('import-modal')).not.toBeInTheDocument();
  });

  it('renders the upload subtitle and the Cancel/Continue footer in the "empty" view', () => {
    render(<ImportStatementModal {...defaultProps()} />);
    expect(
      screen.getByText('financeAccountStatementsImportSubtitleUpload'),
    ).toBeInTheDocument();
    // Continue button is disabled until a file is selected.
    expect(
      screen.getByText('financeAccountStatementsImportContinue').closest('button'),
    ).toBeDisabled();
    expect(
      screen.getByText('financeAccountStatementsImportCancel'),
    ).toBeInTheDocument();
  });

  it('moves through analyzing → selected on a successful preview', async () => {
    previewStatement.mockResolvedValue(PREVIEW_DATA);
    const props = defaultProps();
    const { container } = render(<ImportStatementModal {...props} />);

    const input = container.querySelector('input[type="file"]');
    await act(async () => {
      await userEvent.setup().upload(input, makeFile());
    });

    await waitFor(() => expect(previewStatement).toHaveBeenCalledTimes(1));
    expect(previewStatement).toHaveBeenCalledWith({
      accountId: 'acc-1',
      fileName: 'extracto.c43',
      contentBase64: 'ZmFrZS1iYXNlNjQ=',
    });
    // After preview we are in "selected": the file row shows the format pill.
    await waitFor(() => expect(screen.getByText(/Cuaderno 43/)).toBeInTheDocument());
    // Continue is now enabled.
    expect(
      screen.getByText('financeAccountStatementsImportContinue').closest('button'),
    ).toBeEnabled();
  });

  it('transitions to the "error" view when preview rejects', async () => {
    previewStatement.mockRejectedValue(new Error('bad format'));
    const { container } = render(<ImportStatementModal {...defaultProps()} />);

    const input = container.querySelector('input[type="file"]');
    await act(async () => {
      await userEvent.setup().upload(input, makeFile());
    });

    await waitFor(() => expect(previewStatement).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.getByText('financeAccountStatementsImportErrorBody'),
      ).toBeInTheDocument(),
    );
  });

  it('clicking Continue moves into the preview view (subtitle + Confirm button update)', async () => {
    previewStatement.mockResolvedValue(PREVIEW_DATA);
    const { container } = render(<ImportStatementModal {...defaultProps()} />);
    const user = userEvent.setup();
    const input = container.querySelector('input[type="file"]');
    await act(async () => {
      await user.upload(input, makeFile());
    });
    await waitFor(() =>
      expect(
        screen.getByText('financeAccountStatementsImportContinue').closest('button'),
      ).toBeEnabled(),
    );

    await user.click(
      screen.getByText('financeAccountStatementsImportContinue').closest('button'),
    );

    // The preview view shows the "Review" subtitle and a Confirm CTA.
    expect(
      screen.getByText('financeAccountStatementsImportSubtitleReview'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('financeAccountStatementsImportConfirm'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('financeAccountStatementsImportBack'),
    ).toBeInTheDocument();
  });

  it('reaches the success view after Confirm, calls onSuccess and shows Close + View buttons', async () => {
    previewStatement.mockResolvedValue(PREVIEW_DATA);
    importStatement.mockResolvedValue({ id: 'st-99', lineCount: 12 });
    const props = defaultProps();
    const { container } = render(<ImportStatementModal {...props} />);
    const user = userEvent.setup();

    // 1) upload
    const input = container.querySelector('input[type="file"]');
    await act(async () => {
      await user.upload(input, makeFile());
    });

    // 2) continue
    await waitFor(() =>
      expect(
        screen.getByText('financeAccountStatementsImportContinue').closest('button'),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByText('financeAccountStatementsImportContinue').closest('button'),
    );

    // 3) confirm
    await user.click(
      screen.getByText('financeAccountStatementsImportConfirm').closest('button'),
    );

    await waitFor(() => expect(importStatement).toHaveBeenCalledTimes(1));
    expect(importStatement).toHaveBeenCalledWith({
      accountId: 'acc-1',
      fileName: 'extracto.c43',
      contentBase64: 'ZmFrZS1iYXNlNjQ=',
    });
    // Success view
    await waitFor(() =>
      expect(
        screen.getByText('financeAccountStatementsImportSuccessTitle'),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText('financeAccountStatementsImportSubtitleDone'),
    ).toBeInTheDocument();
    // onSuccess fired
    expect(props.onSuccess).toHaveBeenCalledTimes(1);
    // Footer: Close + View statement buttons
    expect(
      screen.getByText('financeAccountStatementsImportCloseBtn'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('financeAccountStatementsImportViewStatement'),
    ).toBeInTheDocument();
  });

  it('shows an error toast and reverts to the error view when import rejects', async () => {
    previewStatement.mockResolvedValue(PREVIEW_DATA);
    importStatement.mockRejectedValue(new Error('insert failed'));
    const { container } = render(<ImportStatementModal {...defaultProps()} />);
    const user = userEvent.setup();

    const input = container.querySelector('input[type="file"]');
    await act(async () => {
      await user.upload(input, makeFile());
    });
    await waitFor(() =>
      expect(
        screen.getByText('financeAccountStatementsImportContinue').closest('button'),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByText('financeAccountStatementsImportContinue').closest('button'),
    );
    await user.click(
      screen.getByText('financeAccountStatementsImportConfirm').closest('button'),
    );

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError).toHaveBeenCalledWith('financeAccountStatementsImportError');
    // Returns to the error view (drop-zone visible again)
    expect(
      screen.getByText('financeAccountStatementsImportErrorBody'),
    ).toBeInTheDocument();
  });

  it('Back button on preview view returns to "selected"', async () => {
    previewStatement.mockResolvedValue(PREVIEW_DATA);
    const { container } = render(<ImportStatementModal {...defaultProps()} />);
    const user = userEvent.setup();
    const input = container.querySelector('input[type="file"]');
    await act(async () => {
      await user.upload(input, makeFile());
    });
    await waitFor(() =>
      expect(
        screen.getByText('financeAccountStatementsImportContinue').closest('button'),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByText('financeAccountStatementsImportContinue').closest('button'),
    );

    expect(
      screen.getByText('financeAccountStatementsImportSubtitleReview'),
    ).toBeInTheDocument();

    await user.click(
      screen.getByText('financeAccountStatementsImportBack').closest('button'),
    );

    // Back goes to "selected": subtitle reverts to Upload.
    expect(
      screen.getByText('financeAccountStatementsImportSubtitleUpload'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('financeAccountStatementsImportContinue'),
    ).toBeInTheDocument();
  });

  it('Cancel button (empty view) calls onClose', async () => {
    const onClose = vi.fn();
    render(<ImportStatementModal {...defaultProps({ onClose })} />);
    await userEvent.setup().click(
      screen.getByText('financeAccountStatementsImportCancel').closest('button'),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Close button on success view calls onClose', async () => {
    previewStatement.mockResolvedValue(PREVIEW_DATA);
    importStatement.mockResolvedValue({ id: 'st-1', lineCount: 12 });
    const onClose = vi.fn();
    const { container } = render(
      <ImportStatementModal {...defaultProps({ onClose })} />,
    );
    const user = userEvent.setup();
    const input = container.querySelector('input[type="file"]');
    await act(async () => {
      await user.upload(input, makeFile());
    });
    await waitFor(() =>
      expect(
        screen.getByText('financeAccountStatementsImportContinue').closest('button'),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByText('financeAccountStatementsImportContinue').closest('button'),
    );
    await user.click(
      screen.getByText('financeAccountStatementsImportConfirm').closest('button'),
    );
    await waitFor(() =>
      expect(
        screen.getByText('financeAccountStatementsImportSuccessTitle'),
      ).toBeInTheDocument(),
    );

    await user.click(
      screen.getByText('financeAccountStatementsImportCloseBtn').closest('button'),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('View statement button forwards the imported id to onOpenStatement and then closes', async () => {
    previewStatement.mockResolvedValue(PREVIEW_DATA);
    importStatement.mockResolvedValue({ id: 'st-77', lineCount: 12 });
    const onClose = vi.fn();
    const onOpenStatement = vi.fn();
    const { container } = render(
      <ImportStatementModal {...defaultProps({ onClose, onOpenStatement })} />,
    );
    const user = userEvent.setup();
    const input = container.querySelector('input[type="file"]');
    await act(async () => {
      await user.upload(input, makeFile());
    });
    await waitFor(() =>
      expect(
        screen.getByText('financeAccountStatementsImportContinue').closest('button'),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByText('financeAccountStatementsImportContinue').closest('button'),
    );
    await user.click(
      screen.getByText('financeAccountStatementsImportConfirm').closest('button'),
    );
    await waitFor(() =>
      expect(
        screen.getByText('financeAccountStatementsImportSuccessTitle'),
      ).toBeInTheDocument(),
    );

    await user.click(
      screen.getByText('financeAccountStatementsImportViewStatement').closest('button'),
    );
    expect(onOpenStatement).toHaveBeenCalledWith('st-77');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
