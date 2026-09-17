import { describe, it, expect, vi, afterEach } from 'vitest';

// ETP-5225 — after "close anyway" the dialog is unmounted by its caller, so the outcome of the
// send reaches the user ONLY as a toast. `<Toaster>` is mounted at the app root and never here,
// so the real sonner would make every call an unobservable no-op.
const sonnerMocks = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: sonnerMocks }));

import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ImportDialog } from '../ImportDialog.jsx';
import { registerImportDescriptor } from '../../../lib/import/buildOperations.js';
import { registerImportRowValidator } from '../../../lib/import/rowValidators.js';

// ScrollPane (rendered inside ImportReviewQueue, which this dialog mounts)
// observes its own size via ResizeObserver — jsdom doesn't implement it.
// Same polyfill already used in ImportReviewQueue.test.jsx/ImportColumnMapping.test.jsx.
if (!global.ResizeObserver) {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

afterEach(() => {
  cleanup();
});

const config = {
  spec: 'contacts',
  entity: 'businessPartner',
  fields: [
    { target: 'name', label: 'Name', required: true },
    { target: 'email', label: 'Email', isEmail: true },
  ],
  dedupe: { scope: 'file', key: ['email'] },
};

function makeFile(content, name = 'contacts.csv') {
  return new File([content], name, { type: 'text/csv' });
}

async function uploadFile(content) {
  const input = screen.getByTestId('ImportDropzone__fileInput');
  const file = makeFile(content);
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => screen.getByTestId('ImportColumnMapping__chip-Name'));
}

describe('ImportDialog', () => {
  it('shows a download-template link on the dropzone step that downloads a header-only CSV of the window\'s import fields', () => {
    const createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLSpy = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURLSpy;
    URL.revokeObjectURL = revokeObjectURLSpy;
    try {
      render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
      const link = screen.getByTestId('ImportDialog__downloadTemplate');
      fireEvent.click(link);
      expect(createObjectURLSpy).toHaveBeenCalled();
      const blobArg = createObjectURLSpy.mock.calls[0][0];
      expect(blobArg.type).toBe('text/csv;charset=utf-8;');
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it('parses the file and shows the mapping step with auto-mapped columns', async () => {
    const postBatch = vi.fn();
    render(<ImportDialog open config={config} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    expect(screen.getByTestId('ImportColumnMapping__chip-Name').textContent).toContain('Name');
    expect(screen.getByTestId('ImportColumnMapping__chip-Email').textContent).toContain('Email');
  });

  it('opens a newly loaded file on the Correct rows tab', async () => {
    render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');

    // The happy path is the useful first view for a clean import. Errors are
    // still counted and available through the Errors tab when a row needs
    // correction.
    expect(screen.getByTestId('ImportReviewQueue__statusFilter-ok')).toBeDefined();
    expect(screen.getByTestId('ImportReviewQueue__value-0-name')).toBeDefined();
    expect(screen.queryByTestId('ImportReviewQueue__rowError-0')).toBeNull();
  });

  it('regression: does not collapse distinct rows into duplicates of each other (config.dedupe.key, not a flat dedupeKeyTargets)', async () => {
    render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com\nAndres,andres@x.com\nSofia,sofia@x.com');
    // Every row is a valid, distinct record — the "Import N" button must count all 3,
    // not silently skip 2 of them as false-positive duplicates of the first.
    await waitFor(() => screen.getByTestId('ImportDialog__importButton'));
    expect(screen.getByTestId('ImportDialog__importButton').textContent).toBe('Import 3');
  });

  it('regression: a window with no dedupe config at all treats every row as unique', async () => {
    const noDedupeConfig = { ...config, dedupe: undefined };
    render(<ImportDialog open config={noDedupeConfig} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com\nAndres,andres@x.com');
    await waitFor(() => screen.getByTestId('ImportDialog__importButton'));
    expect(screen.getByTestId('ImportDialog__importButton').textContent).toBe('Import 2');
  });

  it('shows the file-error dialog for a malformed file and Retry returns to the dropzone', async () => {
    render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    const input = screen.getByTestId('ImportDropzone__fileInput');
    fireEvent.change(input, { target: { files: [makeFile('')] } });
    await waitFor(() => screen.getByTestId('ImportFileErrorDialog__title'));
    fireEvent.click(screen.getByTestId('ImportFileErrorDialog__retry'));
    await waitFor(() => screen.getByTestId('ImportDropzone__fileInput'));
  });

  it('flags an invalid email as a review-queue error before sending', async () => {
    render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nAndres,not-an-email');
    fireEvent.click(screen.getByTestId('ImportReviewQueue__statusFilter-error'));
    await waitFor(() => screen.getByTestId('ImportReviewQueue__fieldError-0-email'));
  });

  it('drives the confirm → progress → result flow and calls onImported with the sent count', async () => {
    const postBatch = vi.fn().mockResolvedValue({ committed: true, operations: [{ id: 'row', ok: true, recordId: 'REC-1' }] });
    const onImported = vi.fn();
    render(<ImportDialog open config={config} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={onImported} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith({ okCount: 1, failedCount: 0 }));
  });

  it('regression: reports a nonzero failedCount when the batch fails, so a caller can choose to keep the dialog open instead of hiding the review queue', async () => {
    // Root cause of a real report ("tengo 500 durante el import, no veo ningun error en
    // pantalla"): ListView.jsx's onImported callback unconditionally closed the dialog on
    // every call, regardless of whether there was anything to review — so even a batch
    // that failed outright unmounted this whole dialog the instant it rendered the RESULT
    // step, before the user could ever see the (correctly surfaced, per sendRow's own
    // fix) error message. onImported must report enough information for the caller to
    // make that call itself, not just a bare "how many succeeded" count.
    const postBatch = vi.fn().mockResolvedValue({ message: 'Invalid value for OBTIKTaxIDKey' });
    const onImported = vi.fn();
    render(<ImportDialog open config={config} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={onImported} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith({ okCount: 0, failedCount: 1 }));
    // The dialog itself must still be showing the review queue at this point, not
    // already torn down — this is what a caller closing on every onImported call hides.
    // ETP-4669: the row now shows a friendly, classified message — the raw backend text
    // ("Invalid value for OBTIKTaxIDKey", an uncontrolled leak) is no longer rendered here;
    // it is preserved on error.raw for the system-error dialog's report.
    expect(screen.getByTestId('ImportReviewQueue__rowError-0').textContent).toMatch(/could not be imported/i);
  });

  it('keeps descriptor validation failures in the row queue without opening the system-error dialog', async () => {
    const descriptorFn = vi.fn().mockRejectedValue(new Error('Category is ambiguous'));
    registerImportDescriptor('validation-only-descriptor', descriptorFn);
    const descriptorConfig = { ...config, descriptor: 'validation-only-descriptor' };
    const postBatch = vi.fn();
    render(<ImportDialog open config={descriptorConfig} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));

    await waitFor(() => expect(screen.getByTestId('ImportReviewQueue__rowError-0')).toBeDefined());
    expect(screen.getByTestId('ImportReviewQueue__rowError-0').textContent).toContain('Category is ambiguous');
    expect(screen.queryByTestId('ImportSystemErrorDialog__title')).toBeNull();
    expect(postBatch).not.toHaveBeenCalled();
  });

  it('regression: shows the ImportSystemErrorDialog with the last failure\'s message, row data, request sent, and raw trace after a failed send', async () => {
    // Debug-phase aid, per explicit request: while the backend integration is still
    // being stabilized, the last failure of a run should be front-and-center with which
    // row failed, the exact request that was sent, and the full raw trace — not just a
    // small cell in the review queue — the user should not have to dig it out of the
    // Network tab by hand. Row/request/trace are collapsed behind "View full report" by
    // default, per explicit request, so only the message shows up front.
    const postBatch = vi.fn().mockResolvedValue({
      committed: false,
      failedAt: { id: 'bp' },
      error: { status: 500, message: "Operation 'bp' rejected by server", detail: { response: { error: { message: 'Invalid value for OBTIKTaxIDKey' } } } },
    });
    render(<ImportDialog open config={config} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    await waitFor(() => screen.getByTestId('ImportSystemErrorDialog__title'));
    // ETP-4669: the prominent message is the friendly, classified text — never the raw
    // wrapper ("Operation 'bp' rejected by server"). The raw trace still carries the real
    // backend text and is shown (collapsed) under "View full report".
    expect(screen.getByTestId('ImportSystemErrorDialog__message').textContent).toMatch(/could not be imported/i);
    expect(screen.queryByTestId('ImportSystemErrorDialog__trace')).toBeNull();
    fireEvent.click(screen.getByTestId('ImportSystemErrorDialog__toggleReport'));
    expect(screen.getByTestId('ImportSystemErrorDialog__row').textContent).toContain('Lucia');
    expect(screen.getByTestId('ImportSystemErrorDialog__request').textContent).toContain('businessPartner');
    expect(screen.getByTestId('ImportSystemErrorDialog__trace').textContent).toContain('Invalid value for OBTIKTaxIDKey');
    fireEvent.click(screen.getByTestId('ImportSystemErrorDialog__close'));
    expect(screen.queryByTestId('ImportSystemErrorDialog__title')).toBeNull();
    // Closing the system-error dialog must not tear down the review queue underneath.
    expect(screen.getByTestId('ImportReviewQueue__rowError-0')).toBeDefined();
  });

  it('does not show the ImportSystemErrorDialog after a fully successful send', async () => {
    const postBatch = vi.fn().mockResolvedValue({ committed: true, operations: [{ id: 'row', ok: true, recordId: 'REC-1' }] });
    render(<ImportDialog open config={config} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    await waitFor(() => expect(postBatch).toHaveBeenCalled());
    expect(screen.queryByTestId('ImportSystemErrorDialog__title')).toBeNull();
  });

  it('regression: config.descriptor (the real decisions.json field) dispatches to the registered composite descriptor, not the flat single-op default', async () => {
    // Async, like the real Contacts descriptor (which awaits FK resolution) — a
    // synchronous mock here would not have caught the sibling bug where an unawaited
    // async descriptor's Promise got JSON.stringify'd as "{}" instead of the real array.
    const descriptorFn = vi.fn().mockImplementation(async () => {
      await Promise.resolve();
      return [
        { id: 'bp', spec: 'contacts', entity: 'businessPartner', body: { name: 'Custom BP body' } },
        { id: 'contact', spec: 'contacts', entity: 'contact', parentRef: 'bp', body: {} },
      ];
    });
    registerImportDescriptor('regression-test-descriptor', descriptorFn);
    const descriptorConfig = { ...config, descriptor: 'regression-test-descriptor' };
    const postBatch = vi.fn().mockResolvedValue({ committed: true, operations: [{ id: 'bp', ok: true, recordId: 'REC-1' }] });
    render(<ImportDialog open config={descriptorConfig} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    await waitFor(() => expect(descriptorFn).toHaveBeenCalled());
    // Prove postBatch received the descriptor's own resolved two-op array, not a flat
    // one-op default and not an unresolved Promise serialized as "{}".
    await waitFor(() => expect(postBatch).toHaveBeenCalled());
    const sentOps = postBatch.mock.calls[0][0];
    expect(Array.isArray(sentOps)).toBe(true);
    expect(sentOps).toHaveLength(2);
    expect(sentOps[0].body.name).toBe('Custom BP body');
  });

  it('regression: threads token through to the descriptor (needed for FK resolution during operation-building)', async () => {
    const descriptorFn = vi.fn().mockImplementation(async (row, descriptorConfig) => [
      { id: 'row', spec: descriptorConfig.spec, entity: 'businessPartner', body: { token: descriptorConfig.token } },
    ]);
    registerImportDescriptor('token-check-descriptor', descriptorFn);
    const descriptorConfig = { ...config, descriptor: 'token-check-descriptor' };
    const postBatch = vi.fn().mockResolvedValue({ committed: true, operations: [{ id: 'row', ok: true, recordId: 'REC-1' }] });
    render(<ImportDialog open config={descriptorConfig} token="real-token-123" postBatch={postBatch} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    await waitFor(() => expect(descriptorFn).toHaveBeenCalled());
    const [, receivedConfig] = descriptorFn.mock.calls[0];
    expect(receivedConfig.token).toBe('real-token-123');
  });

  it('shows a failed row in the result review queue with Retry re-invoking postBatch for that row', async () => {
    const postBatch = vi.fn().mockResolvedValue({ committed: false, failedAt: { index: 0 }, error: { message: 'Rejected by server' } });
    render(<ImportDialog open config={config} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    await waitFor(() => screen.getByTestId('ImportReviewQueue__rowError-0'));
    postBatch.mockResolvedValueOnce({ committed: true, operations: [{ id: 'row', ok: true, recordId: 'REC-2' }] });
    fireEvent.click(screen.getByTestId('ImportReviewQueue__retry-0'));
    await waitFor(() => expect(postBatch).toHaveBeenCalledTimes(2));
  });

  it('shows an Import button on the result step that resends every row the user has fixed since the failed send', async () => {
    const postBatch = vi.fn().mockResolvedValue({ committed: false, failedAt: { index: 0 }, error: { message: 'Rejected by server' } });
    const onImported = vi.fn();
    render(<ImportDialog open config={config} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={onImported} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    await waitFor(() => screen.getByTestId('ImportReviewQueue__rowError-0'));
    // Editing the failed row clears its row-level error (validateRow re-runs and the
    // edited row still passes required/email validation), making it "pending" with no
    // errors again — exactly what the bulk Import button on this step should count.
    fireEvent.change(screen.getByTestId('ImportReviewQueue__input-0-name'), { target: { value: 'Lucia Fixed' } });
    postBatch.mockResolvedValueOnce({ committed: true, operations: [{ id: 'row', ok: true, recordId: 'REC-2' }] });
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    await waitFor(() => expect(postBatch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onImported).toHaveBeenLastCalledWith({ okCount: 1, failedCount: 0 }));
  });

  it('disables the result step\'s Import button when no row has been fixed yet', async () => {
    const postBatch = vi.fn().mockResolvedValue({ committed: false, failedAt: { index: 0 }, error: { message: 'Rejected by server' } });
    render(<ImportDialog open config={config} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    await waitFor(() => screen.getByTestId('ImportReviewQueue__rowError-0'));
    expect(screen.getByTestId('ImportDialog__importButton').disabled).toBe(true);
  });

  it('regression: post-send Retry awaits an async descriptor before calling postBatch, never sends an unresolved Promise', async () => {
    const descriptorFn = vi.fn().mockImplementation(async (row) => {
      await Promise.resolve();
      return [{ id: 'bp', spec: 'contacts', entity: 'businessPartner', body: { name: row.name } }];
    });
    registerImportDescriptor('async-retry-descriptor', descriptorFn);
    const descriptorConfig = { ...config, descriptor: 'async-retry-descriptor' };
    const postBatch = vi.fn().mockResolvedValue({ committed: false, failedAt: { index: 0 }, error: { message: 'Rejected by server' } });
    render(<ImportDialog open config={descriptorConfig} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    await waitFor(() => screen.getByTestId('ImportReviewQueue__rowError-0'));
    postBatch.mockResolvedValueOnce({ committed: true, operations: [{ id: 'bp', ok: true, recordId: 'REC-2' }] });
    fireEvent.click(screen.getByTestId('ImportReviewQueue__retry-0'));
    await waitFor(() => expect(postBatch).toHaveBeenCalledTimes(2));
    const retryOps = postBatch.mock.calls[1][0];
    expect(Array.isArray(retryOps)).toBe(true);
    expect(retryOps[0].body.name).toBe('Lucia');
  });

  it('regression: a unique-constraint rejection ("must be unique") shows as skipped, not an actionable failure, and does not open the system-error dialog', async () => {
    // Reproduced via a real import run: re-sending a row whose BusinessPartner already
    // exists rejects with Etendo's generic AD-level uniqueness message. Nothing for the
    // user to fix or retry — must not be treated the same as a genuine failure.
    const postBatch = vi.fn().mockResolvedValue({
      committed: false,
      failedAt: { id: 'bp' },
      error: { message: 'There is already a Business Partner with the same (Client, Organization, Search Key). (Client, Organization, Search Key) must be unique.', status: 500 },
    });
    const onImported = vi.fn();
    render(<ImportDialog open config={config} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={onImported} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    await waitFor(() => screen.getByTestId('ImportReviewQueue__skippedLabel-0'));
    expect(screen.queryByTestId('ImportReviewQueue__rowError-0')).toBeNull();
    expect(screen.queryByTestId('ImportSystemErrorDialog__title')).toBeNull();
    // A duplicate isn't a failure that keeps the caller from closing the dialog.
    expect(onImported).toHaveBeenCalledWith({ okCount: 0, failedCount: 0 });
  });

  it('regression: an exception escaping the whole send never leaves the dialog stuck on the progress step', async () => {
    // runImport already isolates per-row build failures on its own (covered above and in
    // importEngine.test.js) — this covers the remaining, genuinely-unexpected case:
    // something throws outside that per-row isolation entirely. Before this safety net,
    // handleSend had no try/catch at all, so the dialog was reproduced hanging on
    // "Importing… 0%" forever in a real browser run with no way to see what happened.
    const postBatch = vi.fn();
    const brokenRunImportConfig = { ...config, concurrency: 'not-a-number-but-does-not-matter' };
    // Force a throw that is NOT per-row (simulates something failing before any row is
    // even attempted, e.g. a malformed config) by making postBatch itself unreachable —
    // buildOperations with an unregistered descriptor throws synchronously up front.
    const unregisteredDescriptorConfig = { ...brokenRunImportConfig, descriptor: 'this-descriptor-does-not-exist' };
    render(<ImportDialog open config={unregisteredDescriptorConfig} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    // Even with an unregistered descriptor (buildOperations throws per-row, which
    // runImport already isolates), the dialog must reach a terminal, visible state —
    // never stay stuck on the progress step.
    await waitFor(() => {
      const stillOnProgress = screen.queryByTestId('ImportProgressStep__percent');
      expect(stillOnProgress).toBeNull();
    });
  });

  it('does not show a Retry/Re-validate button in the pre-send mapping step', async () => {
    render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,not-an-email');
    fireEvent.click(screen.getByTestId('ImportReviewQueue__statusFilter-error'));
    await waitFor(() => screen.getByTestId('ImportReviewQueue__fieldError-0-email'));
    expect(screen.queryByTestId('ImportReviewQueue__retry-0')).toBeNull();
  });

  it('re-derives the grid from the raw file using the new mapping after Save in the edit-match modal', async () => {
    render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,not-an-email');
    fireEvent.click(screen.getByTestId('ImportReviewQueue__statusFilter-error'));
    await waitFor(() => screen.getByTestId('ImportReviewQueue__fieldError-0-email'));
    // Set the `email` FIELD back to "not imported" — proves entries are rebuilt from the
    // persisted raw rows with the new mapping, not just cosmetically relabeled: the
    // invalid value is no longer read into the `email` target at all, so the email
    // format check has nothing to flag. The editor is keyed by field target, not by the
    // file's header text.
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    fireEvent.click(screen.getByTestId('ImportColumnMapping__select-email'));
    fireEvent.click(screen.getByTestId('SelectItem__bf9e7b'));
    fireEvent.click(screen.getByTestId('ImportColumnMapping__saveButton'));
    await waitFor(() => expect(screen.queryByTestId('ImportReviewQueue__fieldError-0-email')).toBeNull());
  });

  it('shows a loading overlay while revalidating after a mapping change, then hides it', async () => {
    render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    fireEvent.click(screen.getByTestId('ImportColumnMapping__saveButton'));
    expect(screen.getByTestId('ImportDialog__revalidatingOverlay')).toBeDefined();
    await waitFor(() => expect(screen.queryByTestId('ImportDialog__revalidatingOverlay')).toBeNull());
  });
});

describe('ImportDialog — ETP-4996', () => {
  const productConfig = {
    spec: 'product',
    entity: 'product',
    descriptor: 'etp4996-demo',
    fields: [
      { target: 'searchKey', label: 'Search Key', aliases: ['codigo'], required: true, example: 'SKU-1001' },
      { target: 'name', label: 'Name', aliases: ['nombre'], required: true, example: 'Tornillo M8' },
      { target: 'salesPrice', label: 'Sales Price', aliases: ['precio'], isNumeric: true, example: '12,50' },
    ],
    dedupe: { scope: 'database', key: ['searchKey'] },
  };

  // The mapping chips are keyed by the file's HEADER text, which differs per test here,
  // so wait on the review queue instead — it only renders once validation has run.
  async function uploadTo(content, filename = 'products.csv') {
    const input = screen.getByTestId('ImportDropzone__fileInput');
    fireEvent.change(input, { target: { files: [makeFile(content, filename)] } });
    await waitFor(() => screen.getByTestId('ImportReviewQueue__statusFilter-ok'));
  }

  it('marks a row that already exists in the database as Skipped, before the send', async () => {
    // IP-19 / IC-18. Previously every row showed as Correcta and the duplicate was only
    // discovered after the user confirmed, as a post-send INFO.
    const existingKeyFetchFn = vi.fn(async () => [{ searchKey: 'SKU-1001' }]);
    render(<ImportDialog open config={productConfig} token="t" postBatch={vi.fn()}
      simSearchFn={vi.fn()} existingKeyFetchFn={existingKeyFetchFn} onImported={() => {}} />);
    await uploadTo('codigo,nombre,precio\nSKU-1001,Tornillo,3.50\nSKU-9999,Nuevo,4.00');

    expect(existingKeyFetchFn).toHaveBeenCalled();
    expect(screen.getByTestId('ImportReviewQueue__statusFilterCount-ok').textContent).toContain('1');
    fireEvent.click(screen.getByTestId('ImportReviewQueue__statusFilter-error'));
    await waitFor(() => screen.getByTestId('ImportReviewQueue__skippedLabel-0'));
  });

  it('does not query the database when the window did not opt in', async () => {
    const existingKeyFetchFn = vi.fn(async () => []);
    render(<ImportDialog open config={{ ...productConfig, dedupe: { scope: 'file', key: ['searchKey'] } }}
      token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} existingKeyFetchFn={existingKeyFetchFn} onImported={() => {}} />);
    await uploadTo('codigo,nombre,precio\nSKU-1001,Tornillo,3.50');
    expect(existingKeyFetchFn).not.toHaveBeenCalled();
  });

  it('still imports when the existence lookup fails', async () => {
    // A pre-flight check that cannot reach the server must not block an import the
    // server would have accepted.
    //
    // Note what it still does NOT do, deliberately left out of ETP-5374: the row shows as
    // Correcta, which reads as "checked, and not a duplicate" for a check that never
    // completed. `findExistingKeys` reports that through `complete`; nothing surfaces it yet.
    const existingKeyFetchFn = vi.fn(async () => { throw new Error('network down'); });
    render(<ImportDialog open config={productConfig} token="t" postBatch={vi.fn()}
      simSearchFn={vi.fn()} existingKeyFetchFn={existingKeyFetchFn} onImported={() => {}} />);
    await uploadTo('codigo,nombre,precio\nSKU-1001,Tornillo,3.50');
    expect(screen.getByTestId('ImportReviewQueue__statusFilterCount-ok').textContent).toContain('1');
  });

  // ETP-5374, the half that survives any batch size: one failing request used to discard the
  // answers of every request that had succeeded, so a single network blip erased the whole
  // check. The file is large enough to need several batches, and exactly one of them fails.
  it('keeps the duplicates found by the batches that answered when one batch fails', async () => {
    const rows = Array.from({ length: 120 }, (_, i) => `SKU-${String(i).padStart(4, '0')},Item ${i},1.00`);
    const existingKeyFetchFn = vi.fn(async (criteria) => {
      const values = criteria.criteria.map((term) => term.value);
      // Deterministic rather than call-ordered: the batches run concurrently, so "the second
      // call" is a race, while "the batch carrying SKU-0000" is always the same one.
      if (values.includes('SKU-0000')) throw new Error('network blip');
      return values.filter((v) => v === 'SKU-0119').map((searchKey) => ({ searchKey }));
    });
    render(<ImportDialog open config={productConfig} token="t" postBatch={vi.fn()}
      simSearchFn={vi.fn()} existingKeyFetchFn={existingKeyFetchFn} onImported={() => {}} />);
    await uploadTo(`codigo,nombre,precio\n${rows.join('\n')}`);

    expect(existingKeyFetchFn.mock.calls.length).toBeGreaterThan(1);
    // SKU-0119 lives in a batch that answered: its duplicate must survive the failed one.
    expect(screen.getByTestId('ImportReviewQueue__statusFilterCount-ok').textContent).toContain('119');
  });

  it('fails a row with a non-numeric price during review, not at send time', async () => {
    render(<ImportDialog open config={{ ...productConfig, dedupe: { scope: 'file', key: ['searchKey'] } }}
      token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadTo('codigo,nombre,precio\nSKU-1,Bueno,3.50\nSKU-2,Malo,abc');

    expect(screen.getByTestId('ImportReviewQueue__statusFilterCount-ok').textContent).toContain('1');
    fireEvent.click(screen.getByTestId('ImportReviewQueue__statusFilter-error'));
    await waitFor(() => screen.getByTestId('ImportReviewQueue__fieldError-1-salesPrice'));
  });

  it('runs the descriptor\'s own row validator in the same pass', async () => {
    registerImportRowValidator('etp4996-demo', (row) => (
      row.name === 'Prohibido' ? [{ target: 'name', message: 'valor no permitido' }] : []
    ));
    render(<ImportDialog open config={{ ...productConfig, dedupe: { scope: 'file', key: ['searchKey'] } }}
      token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadTo('codigo,nombre,precio\nSKU-1,Prohibido,3.50');

    fireEvent.click(screen.getByTestId('ImportReviewQueue__statusFilter-error'));
    const error = await screen.findByTestId('ImportReviewQueue__fieldError-0-name');
    expect(error.textContent).toContain('valor no permitido');
  });

  it('downloads a template with the required marker and a sample row', async () => {
    const createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-url');
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURLSpy;
    URL.revokeObjectURL = vi.fn();
    try {
      render(<ImportDialog open config={productConfig} token="t" postBatch={vi.fn()}
        simSearchFn={vi.fn()} onImported={() => {}} />);
      fireEvent.click(screen.getByTestId('ImportDialog__downloadTemplate'));
      const csv = await createObjectURLSpy.mock.calls[0][0].text();
      expect(csv).toBe('codigo *,nombre *,precio\nSKU-1001,Tornillo M8,"12,50"');
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it('writes the template in the session language and still maps it back', async () => {
    const createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-url');
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURLSpy;
    URL.revokeObjectURL = vi.fn();
    try {
      render(<ImportDialog open config={{ ...productConfig, dedupe: { scope: 'file', key: ['searchKey'] } }}
        token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}}
        fieldLabelFn={(f) => f.label} />);
      fireEvent.click(screen.getByTestId('ImportDialog__downloadTemplate'));
      const csv = await createObjectURLSpy.mock.calls[0][0].text();
      expect(csv.split('\n')[0]).toBe('Search Key *,Name *,Sales Price');

      // Round-trip: the localized header must map back onto its own field, or the very
      // template the dialog handed out would be un-importable in that language.
      await uploadTo('Search Key *,Name *,Sales Price\nSKU-1,Widget,3.50', 'en.csv');
      expect(screen.getByTestId('ImportReviewQueue__statusFilterCount-ok').textContent).toContain('1');
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });
});

/**
 * ETP-5225 — the "X" during the send.
 *
 * It used to close the progress modal outright while `handleSend` carried on creating records,
 * with nothing on screen saying so. A user who clicked it to abort a mistaken import found the
 * products there after a reload, which is the whole report: a close that reads as a cancel and
 * silently is not one.
 */
describe('ImportDialog — closing while the send is running', () => {
  /** A postBatch that never settles, so the dialog stays parked on the progress step. */
  function heldPostBatch() {
    return vi.fn(() => new Promise(() => {}));
  }

  async function startSend(onOpenChange, postBatch) {
    render(
      <ImportDialog
        open
        onOpenChange={onOpenChange}
        config={config}
        token="t"
        postBatch={postBatch}
        simSearchFn={vi.fn()}
        onImported={() => {}}
      />,
    );
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));
    await waitFor(() => screen.getByTestId('ImportProgressStep__title'));
  }

  it('asks what closing means instead of closing silently', async () => {
    const onOpenChange = vi.fn();
    await startSend(onOpenChange, heldPostBatch());

    // Only one dialog is open at this point, so this is unambiguously the wizard's own X.
    fireEvent.click(screen.getByLabelText('Close'));

    await waitFor(() => screen.getByTestId('ImportSendingCloseDialog__title'));
    // The two halves of the bug: the caller was never told to close, and the progress step is
    // still on screen rather than replaced by nothing.
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('ImportProgressStep__title')).toBeDefined();
  });

  it('stays open when the user chooses to keep watching', async () => {
    const onOpenChange = vi.fn();
    await startSend(onOpenChange, heldPostBatch());
    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => screen.getByTestId('ImportSendingCloseDialog__keepWatching'));

    fireEvent.click(screen.getByTestId('ImportSendingCloseDialog__keepWatching'));

    await waitFor(() => expect(screen.queryByTestId('ImportSendingCloseDialog__title')).toBeNull());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('ImportProgressStep__title')).toBeDefined();
  });

  it('closes only on an explicit "close anyway"', async () => {
    const onOpenChange = vi.fn();
    await startSend(onOpenChange, heldPostBatch());
    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => screen.getByTestId('ImportSendingCloseDialog__closeAnyway'));

    fireEvent.click(screen.getByTestId('ImportSendingCloseDialog__closeAnyway'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  /**
   * The other half of the hole the confirmation opens: once the caller unmounts the dialog, the
   * RESULT step's review queue — the only place failures are ever reported — goes with it. A run
   * where 3 of 10 rows failed used to announce "7 records imported successfully" and nothing
   * else, so the smaller-than-expected number was the only hint anything had gone wrong.
   *
   * `open` is a literal here, so the dialog is not actually torn down when onOpenChange fires;
   * what these two assert is the gate itself (did the user confirm the close?), which is what
   * decides whether the toast is the user's only channel. The unmount is the caller's job.
   */
  it('reports the failures in a toast when the user confirmed closing mid-send', async () => {
    sonnerMocks.error.mockClear();
    let settle;
    const postBatch = vi.fn(() => new Promise((resolve) => {
      settle = () => resolve({ message: 'boom' });
    }));
    const onOpenChange = vi.fn();
    await startSend(onOpenChange, postBatch);

    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => screen.getByTestId('ImportSendingCloseDialog__closeAnyway'));
    fireEvent.click(screen.getByTestId('ImportSendingCloseDialog__closeAnyway'));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    settle();

    await waitFor(() => expect(sonnerMocks.error).toHaveBeenCalledTimes(1));
    expect(sonnerMocks.error.mock.calls[0][0]).toMatch(/could not be imported/i);
  });

  it('stays silent when the dialog was never closed — the review queue already shows the failures', async () => {
    sonnerMocks.error.mockClear();
    const postBatch = vi.fn().mockResolvedValue({ message: 'boom' });
    render(
      <ImportDialog
        open
        onOpenChange={vi.fn()}
        config={config}
        token="t"
        postBatch={postBatch}
        simSearchFn={vi.fn()}
        onImported={() => {}}
      />,
    );
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByTestId('ImportDialog__importButton'));
    fireEvent.click(screen.getByTestId('ImportConfirmStep__confirm'));

    // The row and its reason are on screen; a toast here would restate it, less usefully.
    await waitFor(() => screen.getByTestId('ImportReviewQueue__rowError-0'));
    expect(sonnerMocks.error).not.toHaveBeenCalled();
  });

  // The guard is scoped to the one step where closing means something other than what it looks
  // like. Every other step must keep closing on the first click, with no question in the way.
  it('does not interrupt closing on any other step', () => {
    const onOpenChange = vi.fn();
    render(
      <ImportDialog
        open
        onOpenChange={onOpenChange}
        config={config}
        token="t"
        postBatch={vi.fn()}
        simSearchFn={vi.fn()}
        onImported={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('ImportSendingCloseDialog__title')).toBeNull();
  });
});

/**
 * ETP-5348 — the two rejections that need the dialog rather than a parser, because both depend on
 * the window's own `config`: which formats it declares, and what row limit it declares.
 */
describe('ImportDialog — ETP-5348 file rejection', () => {
  const formatsConfig = { ...config, formats: ['csv', 'txt', 'xlsx'] };

  /** Drops a file straight on the input, bypassing `accept` exactly as a real drag-and-drop does. */
  function dropFile(name, content = 'Name,Email\nAna,ana@x.com') {
    const input = screen.getByTestId('ImportDropzone__fileInput');
    fireEvent.change(input, { target: { files: [new File([content], name)] } });
  }

  it('rejects a file whose extension the window does not declare, naming the accepted formats', async () => {
    // The reported case: a Word document reached `parseDelimited`, whose Windows-1252 fallback
    // decodes ANY byte sequence without error, so it became one garbage column that matched no
    // field and the user landed on an empty mapping screen with nothing said.
    render(<ImportDialog open config={formatsConfig} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    dropFile('products-invalid-format.docx');
    await waitFor(() => screen.getByTestId('ImportFileErrorDialog__title'));
    expect(screen.getByTestId('ImportFileErrorDialog__message').textContent).toContain('CSV, TXT, XLSX');
  });

  it('judges the extension against the window\'s declaration, not a fixed list', async () => {
    // The base config declares no formats, so it falls back to csv/txt — an xlsx must be refused
    // there even though the window above accepts one.
    //
    // Asserting the MESSAGE, not just that some error appeared: a file named `.xlsx` carrying CSV
    // bytes also makes `parseXlsx` throw, so "the file-error dialog is showing" passes with the
    // format gate removed entirely. Only the gate can produce a message naming CSV and TXT.
    render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    dropFile('contacts.xlsx');
    await waitFor(() => screen.getByTestId('ImportFileErrorDialog__title'));
    expect(screen.getByTestId('ImportFileErrorDialog__message').textContent).toContain('CSV, TXT');
  });

  it('still accepts a declared format', async () => {
    render(<ImportDialog open config={formatsConfig} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    dropFile('contacts.csv');
    await waitFor(() => screen.getByTestId('ImportColumnMapping__chip-Name'));
  });

  it('rejects a file with more rows than the window\'s declared limit, instead of truncating in silence', async () => {
    // The bug: `runImport` applied `maxRows` as `rows.slice(0, maxRows)` at SEND time, so the
    // extra rows were never attempted, never counted and never reported. A 5001-row file
    // imported 5000 and lost the last one with nothing on screen to say so.
    const limited = { ...config, formats: ['csv'], limit: { maxRows: 2, concurrency: 4 } };
    render(<ImportDialog open config={limited} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    dropFile('contacts.csv', 'Name,Email\nA,a@x.com\nB,b@x.com\nC,c@x.com');
    await waitFor(() => screen.getByTestId('ImportFileErrorDialog__title'));
    const message = screen.getByTestId('ImportFileErrorDialog__message').textContent;
    expect(message).toContain('3');
    expect(message).toContain('2');
  });

  it('reads the limit from the nested `limit` block the contract actually produces', async () => {
    // `config.maxRows` was always `undefined` — the contract nests it under `limit` — so
    // `runImport`'s own default of 5000 silently took over and a declared limit did nothing.
    // Exactly the limit is accepted; one more is not.
    const limited = { ...config, formats: ['csv'], limit: { maxRows: 2, concurrency: 4 } };
    render(<ImportDialog open config={limited} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    dropFile('contacts.csv', 'Name,Email\nA,a@x.com\nB,b@x.com');
    await waitFor(() => screen.getByTestId('ImportColumnMapping__chip-Name'));
  });

  it('rejects a file that carries only its header row', async () => {
    render(<ImportDialog open config={formatsConfig} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    dropFile('contacts.csv', 'Name,Email');
    await waitFor(() => screen.getByTestId('ImportFileErrorDialog__title'));
  });
});
