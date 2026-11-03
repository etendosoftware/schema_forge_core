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

/**
 * ETP-6081 — the terms and conditions in force, over the register screen so nothing typed in the
 * form is lost. Closes with its button, Escape or a click outside (the Radix dialog's own
 * behaviour).
 *
 * The content is plain text from the ERP and is rendered as text, never as HTML: line breaks are
 * kept with `whitespace-pre-line`.
 */
export function TermsDialog({ open, onOpenChange, terms, loading, error, onRetry, ui }) {
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
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" data-testid="Loader2__terms" />
              {ui('onboardingTermsLoading')}
            </div>
          )}
          {!loading && error && (
            <div className="space-y-3">
              <p className="text-sm text-rose-600" data-testid="terms-dialog-error">
                {ui('onboardingTermsUnavailable')}
              </p>
              {onRetry && (
                <Button type="button" variant="outline" onClick={onRetry} data-testid="terms-dialog-retry">
                  {ui('onboardingTermsRetry')}
                </Button>
              )}
            </div>
          )}
          {!loading && !error && terms && (
            <div
              className="whitespace-pre-line text-sm leading-6 text-slate-700"
              data-testid="terms-dialog-content">
              {terms.content}
            </div>
          )}
        </div>
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
