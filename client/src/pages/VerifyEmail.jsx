import { ArrowRight, CheckCircle2, Loader2, MailCheck, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { AuthShell, Field } from './Login';

export default function VerifyEmail() {
  useDocumentTitle('Verify your email');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [state, setState] = useState(token ? 'verifying' : 'idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState('');

  useEffect(() => {
    if (!token) return;

    let active = true;
    const verify = async () => {
      try {
        await api.post('/auth/verify-email', { token });
        if (active) setState('success');
      } catch (err) {
        if (active) {
          setState('error');
          setErrorMessage(err.response?.data?.message || 'Verification link is invalid or has expired.');
        }
      }
    };
    verify();
    return () => {
      active = false;
    };
  }, [token]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    setResending(true);
    setResendStatus('');
    try {
      const { data } = await api.post('/auth/resend-verification', { email: resendEmail.trim() });
      setResendStatus(data.message || 'Verification link sent if an account exists.');
    } catch (err) {
      setResendStatus(err.response?.data?.message || 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      title="Email verification"
      subtitle="Confirm your email to complete your Otion account registration."
      icon={<MailCheck size={20} />}
      footer={
        <>
          Ready to sign in?{' '}
          <Link to="/login" className="font-semibold text-ink hover:text-accent">
            Sign in
          </Link>
        </>
      }
    >
      {state === 'verifying' && (
        <div className="flex flex-col items-center text-center py-6">
          <Loader2 className="animate-spin text-muted mb-4" size={32} />
          <h2 className="text-lg font-semibold text-ink">Verifying your email…</h2>
          <p className="mt-1 text-sm text-muted">Please wait while we confirm your credentials.</p>
        </div>
      )}

      {state === 'success' && (
        <div className="flex flex-col items-center text-center py-2">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <CheckCircle2 size={24} />
          </div>
          <h2 className="text-lg font-semibold text-ink">Email verified!</h2>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            Your email address has been successfully verified. You can now access your notes and workspaces.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="primary-action mt-6 w-full justify-center px-4 py-2.5 text-sm"
          >
            Sign in to Otion <ArrowRight size={16} />
          </button>
        </div>
      )}

      {(state === 'error' || state === 'idle') && (
        <div className="flex flex-col py-1">
          {state === 'error' && (
            <div className="error-alert mb-4">
              <ShieldAlert size={18} />
              <div className="flex-1">
                <p className="font-semibold">Verification failed</p>
                <p className="text-xs mt-0.5 opacity-90">{errorMessage}</p>
              </div>
            </div>
          )}

          <p className="text-sm text-muted mb-3">
            {state === 'error'
              ? 'Enter your email address below to receive a fresh verification link:'
              : 'Enter your email to request an account verification email:'}
          </p>

          <form onSubmit={handleResend} className="flex flex-col gap-3">
            <Field
              label="Account email"
              type="email"
              value={resendEmail}
              onChange={setResendEmail}
              autoComplete="email"
              placeholder="you@company.com"
            />
            {resendStatus && (
              <p className="rounded-xl border border-line bg-panel p-3 text-xs text-ink">
                {resendStatus}
              </p>
            )}
            <button
              disabled={resending || !resendEmail.trim()}
              className="primary-action mt-1 w-full px-4 py-2.5 text-sm disabled:cursor-wait disabled:opacity-50"
            >
              {resending ? 'Sending…' : (
                <>
                  Resend verification email <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </AuthShell>
  );
}
