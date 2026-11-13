import { CheckCircle2, Mail, Send, X } from 'lucide-react';
import { useState } from 'react';
import useAuth from '../hooks/useAuth';
import useToast from '../hooks/useToast';
import api from '../services/api';

export default function EmailVerificationBanner() {
  const { user } = useAuth();
  const toast = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Only render if user is logged in, email is unverified, and banner not dismissed
  if (!user || user.isEmailVerified || dismissed) {
    return null;
  }

  const handleResend = async () => {
    setSending(true);
    try {
      await api.post('/auth/resend-verification', { email: user.email });
      setSent(true);
      toast.success('Verification link sent! Check your inbox.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send verification email.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative z-40 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 transition dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Mail size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="truncate">
            Please verify your email address (<strong>{user.email}</strong>) to secure your account.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {sent ? (
            <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 size={13} /> Link sent
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={sending}
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
            >
              <Send size={11} /> {sending ? 'Sending…' : 'Resend verification link'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded p-0.5 opacity-70 hover:opacity-100"
            aria-label="Dismiss banner"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
