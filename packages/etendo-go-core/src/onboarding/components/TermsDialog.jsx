import React from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@etendosoftware/app-shell-core/components/ui/dialog';
import { Button } from '@etendosoftware/app-shell-core/components/ui/button';
import { TermsContent } from './TermsContent.jsx';
import { useTermsDocument } from './useTermsDocument.js';

/**
 * ETP-6081 — the terms and conditions in force, over the register screen so nothing typed in the
 * form is lost. Closes with its button, Escape or a click outside (the Radix dialog's own
 * behaviour).
 *
 * ETP-6244 — the text is `terms.content` (plain text, or HTML rebuilt from an allowlist by
 * `TermsContent`), or, when the version has a Word document attached in Classic
 * (`terms.hasDocument`), that document converted to HTML by `loadDocument` the first time the
 * dialog opens.
 */
/**
 * The terms and conditions of the register screen.
 *
 * ETP-6081 — also holds the consent to promotional mail. It is a separate choice from accepting the
 * terms (it can be unticked without blocking the sign-up), shown only when the caller passes
 * `onMarketingConsentChange`, and owned by the caller so closing the dialog keeps the choice.
 */
export function TermsDialog({
  open, onOpenChange, terms, loading, error, onRetry, ui,
  marketingConsent = false, onMarketingConsentChange, loadDocument,
}) {
  const termsDocument = useTermsDocument(open, terms, loadDocument);
  const isLoading = loading || (!error && termsDocument.loading);
  const loadError = error || termsDocument.error;
  const retry = error ? onRetry : termsDocument.retry;
  const content = termsDocument.applies ? termsDocument.html : terms?.content;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} data-testid="Dialog__terms">
      <DialogContent
        className="flex max-h-[85vh] max-w-3xl flex-col gap-4 sm:rounded-2xl"
        data-testid="terms-dialog">
        <DialogHeader data-testid="DialogHeader__terms">
          <DialogTitle data-testid="DialogTitle__terms">{ui('onboardingTermsTitle')}</DialogTitle>
          <DialogDescription className="sr-only" data-testid="DialogDescription__terms">
            {ui('onboardingTermsTitle')}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pr-2" data-testid="terms-dialog-body">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" data-testid="Loader2__terms" />
              {ui('onboardingTermsLoading')}
            </div>
          )}
          {!isLoading && loadError && (
            <div className="space-y-3">
              <p className="text-sm text-rose-600" data-testid="terms-dialog-error">
                {ui('onboardingTermsUnavailable')}
              </p>
              {retry && (
                <Button type="button" variant="outline" onClick={retry} data-testid="terms-dialog-retry">
                  {ui('onboardingTermsRetry')}
                </Button>
              )}
            </div>
          )}
          {!isLoading && !loadError && terms && <TermsContent content={content} data-testid="TermsContent__962863" />}
        </div>
        {onMarketingConsentChange && (
          <label
            htmlFor="terms-marketing-consent"
            className="flex cursor-pointer items-start gap-2 border-t border-slate-200 pt-4 text-sm leading-5 text-slate-700"
            data-testid="terms-marketing-consent-label">
            <input
              id="terms-marketing-consent"
              type="checkbox"
              checked={marketingConsent}
              onChange={e => onMarketingConsentChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#121217]"
              data-testid="terms-marketing-consent" />
            <span>{ui('onboardingMarketingConsent')}</span>
          </label>
        )}
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-lg bg-[#121217] px-5 text-white hover:bg-accent-highlight hover:text-accent-highlight-foreground"
            data-testid="terms-dialog-close">
            {ui('onboardingTermsClose')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TermsDialog;
