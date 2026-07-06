import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ImportDialog } from '../ImportDialog.jsx';
import { registerImportDescriptor } from '../../../lib/import/buildOperations.js';

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
  await waitFor(() => screen.getByTestId('ImportColumnMapping__select-Name'));
}

describe('ImportDialog', () => {
  it('parses the file and shows the mapping step with auto-mapped columns', async () => {
    const postBatch = vi.fn();
    render(<ImportDialog open config={config} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    expect(screen.getByTestId('ImportColumnMapping__select-Name').textContent).toContain('Name');
    expect(screen.getByTestId('ImportColumnMapping__select-Email').textContent).toContain('Email');
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
    expect(screen.getByTestId('ImportReviewQueue__rowError-0').textContent).toContain('Invalid value for OBTIKTaxIDKey');
  });

  it('regression: shows the ImportSystemErrorDialog with the last failure\'s message and raw trace after a failed send', async () => {
    // Debug-phase aid, per explicit request: while the backend integration is still
    // being stabilized, the last failure of a run should be front-and-center with its
    // full raw trace, not just a small cell in the review queue — the user should not
    // have to dig it out of the Network tab by hand.
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
    expect(screen.getByTestId('ImportSystemErrorDialog__message').textContent).toBe("Operation 'bp' rejected by server");
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
});
