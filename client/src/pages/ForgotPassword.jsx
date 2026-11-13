import { AlertCircle, ArrowRight, KeyRound, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import api from '../services/api';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { AuthShell, Field } from './Login';

const forgotSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
});

export default function ForgotPassword() {
  useDocumentTitle('Forgot password');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const parsed = forgotSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Enter a valid email');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: parsed.data.email });
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to request password reset');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter your email to receive a secure password recovery link."
      icon={<KeyRound size={20} />}
      footer={
        <>
          Remembered your password?{' '}
          <Link to="/login" className="font-semibold text-ink hover:text-accent">
            Sign in
          </Link>
        </>
      }
    >
      {submitted ? (
        <div className="flex flex-col items-center text-center py-2">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <CheckCircle2 size={24} />
          </div>
          <h2 className="text-lg font-semibold text-ink">Check your inbox</h2>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            If an account exists for <strong className="text-ink">{email}</strong>, we have sent a link to reset your password.
          </p>
          <p className="mt-4 text-xs text-muted">
            The link is valid for 1 hour. Be sure to check your spam or junk folder.
          </p>
          <div className="mt-6 flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="secondary-action w-full justify-center px-4 py-2.5 text-sm"
            >
              Try another email
            </button>
            <Link
              to="/login"
              className="primary-action w-full justify-center px-4 py-2.5 text-sm"
            >
              Return to sign in
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="auth-form flex flex-col gap-3" noValidate>
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={(val) => {
              setEmail(val);
              setError('');
            }}
            error={error}
            autoComplete="email"
            placeholder="you@company.com"
          />
          {error && (
            <div role="alert" className="error-alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          <button
            disabled={submitting}
            className="primary-action mt-1 w-full px-4 py-3 disabled:cursor-wait disabled:opacity-50"
          >
            {submitting ? 'Sending link…' : (
              <>
                Send reset link <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
