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
    <aside
      aria-label="Email verification notice"
      className="email-verification-banner shrink-0 border-b border-amber-200/90 bg-amber-50/95 text-amber-950 transition-colors dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <div className="flex w-full flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
            <Mail size={13} />
          </div>
          <p className="truncate text-xs font-medium text-amber-950 dark:text-amber-200">
            Please verify your email address (<strong className="font-semibold text-amber-950 dark:text-amber-100">{user.email}</strong>) to secure your account.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          {sent ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100/90 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" /> Link sent
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={sending}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/80 bg-white/90 px-2.5 py-1 text-xs font-semibold text-amber-950 shadow-xs transition hover:bg-white hover:border-amber-400 active:scale-98 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/70"
            >
              <Send size={11} className="text-amber-700 dark:text-amber-400" />
              <span>{sending ? 'Sending…' : 'Resend link'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-md p-1 text-amber-900/70 transition hover:bg-amber-200/60 hover:text-amber-950 active:scale-95 dark:text-amber-400 dark:hover:bg-amber-900/50 dark:hover:text-amber-100"
            aria-label="Dismiss banner"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
