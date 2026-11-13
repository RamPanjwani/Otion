import { AlertCircle, ArrowRight, CheckCircle2, Lock, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import api from '../services/api';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { AuthShell, Field } from './Login';

const resetSchema = z
  .object({
    password: z.string().min(8, 'Password must contain at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export default function ResetPassword() {
  useDocumentTitle('Choose a new password');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!token) {
      setError('Password reset token is missing from the link');
      return;
    }
    const parsed = resetSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/auth/reset-password', {
        token,
        password: parsed.data.password,
      });
      setSuccess(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to reset password. The link may have expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create new password"
      subtitle="Enter a new password for your Otion account."
      icon={<Lock size={20} />}
      footer={
        <>
          Already know your password?{' '}
          <Link to="/login" className="font-semibold text-ink hover:text-accent">
            Sign in
          </Link>
        </>
      }
    >
      {!token ? (
        <div className="flex flex-col items-center text-center py-2">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-lg font-semibold text-ink">Invalid reset link</h2>
          <p className="mt-2 text-sm text-muted">
            This password recovery link is missing a valid security token.
          </p>
          <Link
            to="/forgot-password"
            className="primary-action mt-6 w-full justify-center px-4 py-2.5 text-sm"
          >
            Request a new link
          </Link>
        </div>
      ) : success ? (
        <div className="flex flex-col items-center text-center py-2">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <CheckCircle2 size={24} />
          </div>
          <h2 className="text-lg font-semibold text-ink">Password updated</h2>
          <p className="mt-2 text-sm text-muted">
            Your password has been reset successfully. All previous sessions have been signed out.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="primary-action mt-6 w-full justify-center px-4 py-2.5 text-sm"
          >
            Sign in now <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="auth-form flex flex-col gap-3" noValidate>
          <Field
            label="New password"
            type="password"
            value={form.password}
            onChange={(val) => update('password', val)}
            error={errors.password}
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
          <Field
            label="Confirm new password"
            type="password"
            value={form.confirmPassword}
            onChange={(val) => update('confirmPassword', val)}
            error={errors.confirmPassword}
            minLength={8}
            autoComplete="new-password"
            placeholder="Repeat new password"
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
            {submitting ? 'Updating password…' : (
              <>
                Update password <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
