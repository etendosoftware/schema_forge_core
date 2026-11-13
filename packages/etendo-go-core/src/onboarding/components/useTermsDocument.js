import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * ETP-6244 — the HTML of the Word document of a terms version, loaded the first time the dialog
 * opens on a version that has one (`terms.hasDocument`).
 *
 * The document is downloaded and converted only then, never with the register screen, and kept
 * for the version it was loaded for: reopening the dialog does not load it again, a different
 * version (another language) does. Closing the dialog mid-download lets the download finish.
 *
 * @param {boolean} open whether the dialog is open
 * @param {{ version: string, language: string, hasDocument?: boolean } | null} terms the body of
 *   `/sws/go/terms`
 * @param {(terms: object) => Promise<string>} [loadDocument] downloads and converts the document
 * @returns {{ applies: boolean, html: string | null, loading: boolean, error: Error | null,
 *   retry: () => void }} `applies` is false when the version has no document (or no loader was
 *   given): the dialog then shows `terms.content`
 */
export function useTermsDocument(open, terms, loadDocument) {
  const applies = Boolean(terms?.hasDocument && loadDocument);
  const key = applies ? `${terms.language}|${terms.version}` : null;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ request: null, html: null, error: null });
  const latestRequest = useRef(null);
  const request = key ? `${key}#${attempt}` : null;

  useEffect(() => {
    if (!open || !request || latestRequest.current === request) return;
    latestRequest.current = request;
    setState({ request, html: null, error: null });
    loadDocument(terms).then(
      html => { if (latestRequest.current === request) setState({ request, html, error: null }); },
      error => { if (latestRequest.current === request) setState({ request, html: null, error }); },
    );
  // terms and loadDocument are read through `request`: a new object for the same version must
  // not download it again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);
  const current = state.request === request;
  return {
    applies,
    html: current ? state.html : null,
    loading: applies && !(current && (state.html !== null || state.error)),
    error: current ? state.error : null,
    retry,
  };
}

export default useTermsDocument;
