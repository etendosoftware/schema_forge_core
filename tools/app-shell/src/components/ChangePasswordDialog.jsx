import { useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { useUI } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { changePassword } from '../pages/onboarding/onboardingApi.js';
import { detectBaseUrl } from './copilot/copilotApi.js';

const EMPTY_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' };

const PLATFORM_TOKEN_KEY = 'sf_platform_token';

/**
 * Dialog that lets a signed-in user change their platform account password.
 *
 * On success the rotated platform token is intentionally discarded and
 * `onSuccess` is invoked so the caller can log the user out — they then sign
 * in again with the new password (the app routes unauthenticated users back to
 * the onboarding page automatically).
 */
export function ChangePasswordDialog({ open, onOpenChange, onSuccess }) {
  const ui = useUI();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const close = () => {
    if (loading) return;
    setForm(EMPTY_FORM);
    setError(null);
    onOpenChange(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.newPassword !== form.confirmPassword) {
      setError(ui('onboardingCredentialsMustMatch'));
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem(PLATFORM_TOKEN_KEY);
      await changePassword(fetch, detectBaseUrl(), token, form);
      // Rotated token is discarded on purpose: we sign the user out so they
      // re-authenticate with the new password.
      onSuccess?.();
    } catch (err) {
      setError(err.userMessage || ui(err.code || 'onboardingCredentialChangeFailed'));
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md" data-testid="change-password-dialog">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              {ui('onboardingChangePasswordTitle')}
            </DialogTitle>
            <DialogDescription>{ui('changePasswordLogoutNotice')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="change-current-password">{ui('onboardingCurrentPasswordLabel')}</Label>
            <Input
              id="change-current-password"
              type="password"
              required
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={setField('currentPassword')}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="change-new-password">{ui('onboardingNewPasswordLabel')}</Label>
            <Input
              id="change-new-password"
              type="password"
              required
              autoComplete="new-password"
              value={form.newPassword}
              onChange={setField('newPassword')}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="change-confirm-password">{ui('onboardingConfirmPasswordLabel')}</Label>
            <Input
              id="change-confirm-password"
              type="password"
              required
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={setField('confirmPassword')}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={close} disabled={loading}>
              {ui('cancel')}
            </Button>
            <Button type="submit" disabled={loading} data-testid="change-password-submit">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {ui('onboardingSavingPassword')}
                </>
              ) : (
                ui('onboardingSavePasswordAction')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
