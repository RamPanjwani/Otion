import { motion } from 'motion/react';
import { AlertCircle, ArrowRight, Eye, EyeOff, LogIn, Moon, Sun } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import AmbientBackground from '../components/AmbientBackground';
import BrandMark from '../components/BrandMark';
import useAuth from '../hooks/useAuth';
import useTheme from '../hooks/useTheme';
import useDocumentTitle from '../hooks/useDocumentTitle';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must contain at least 8 characters'),
});

export default function Login() {
  useDocumentTitle('Sign in');
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login(parsed.data);
      navigate('/dashboard');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Pick up exactly where your team left off." icon={<LogIn size={20} />} footer={<>New to Otion? <Link to="/register" className="font-semibold text-ink hover:text-accent">Create an account</Link></>}>
      <form onSubmit={submit} className="auth-form flex flex-col gap-3" noValidate>
        <Field label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} error={errors.email} autoComplete="email" placeholder="you@company.com" />
        <Field label="Password" type="password" value={form.password} onChange={(value) => update('password', value)} error={errors.password} autoComplete="current-password" placeholder="Your password" />
        <div className="flex justify-end -mt-1">
          <Link to="/forgot-password" className="text-xs font-medium text-muted transition hover:text-accent">
            Forgot password?
          </Link>
        </div>
        {error && (
          <div role="alert" className="error-alert">
            <AlertCircle size={16} />
            <div className="flex-1">
              <p>{error}</p>
              {error.toLowerCase().includes('verify') && (
                <p className="mt-1 text-xs">
                  Didn't get the email?{' '}
                  <Link to="/verify-email" className="font-semibold underline hover:opacity-80">
                    Resend verification link
                  </Link>
                </p>
              )}
            </div>
          </div>
        )}
        <button disabled={submitting} className="primary-action mt-1 w-full px-4 py-3 disabled:cursor-wait disabled:opacity-50">{submitting ? 'Signing in…' : <>Sign in <ArrowRight size={17} /></>}</button>
      </form>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children, footer, icon }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <main className="auth-shell relative flex h-dvh flex-col overflow-hidden px-5 py-5 sm:py-6">
      <AmbientBackground />
      <header className="relative z-20 flex shrink-0 items-center justify-between">
        <Link to="/" aria-label="Otion home"><BrandMark compact /></Link>
        <button type="button" onClick={toggleTheme} className="icon-action h-10 w-10 border border-line bg-surface/65 backdrop-blur-xl" aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
      </header>
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center py-3">
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="auth-panel w-full max-w-[430px]">
          <section className="auth-card glass-panel rounded-[24px] p-5 sm:p-7">
            <div className="auth-icon mb-5 grid h-11 w-11 place-items-center rounded-2xl border border-line bg-panel text-muted">{icon || <LogIn size={20} />}</div>
            <h1 className="auth-title text-3xl font-semibold tracking-[-0.04em]">{title}</h1>
            <p className="auth-subtitle mb-6 mt-1.5 leading-6 text-muted">{subtitle}</p>
            {children}
          </section>
          <p className="auth-footer mt-5 text-center text-sm text-muted">{footer}</p>
        </motion.div>
      </div>
    </main>
  );
}

export function Field({ label, type = 'text', value, onChange, error, minLength, autoComplete, placeholder }) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="block">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && revealed ? 'text' : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className={`field-control px-4 py-2.5 ${isPassword ? 'pr-11' : ''} ${error ? 'border-red-400 focus:border-red-500' : ''}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted transition hover:text-ink"
            aria-label={revealed ? 'Hide characters' : 'Show characters'}
            aria-pressed={revealed}
            title={revealed ? 'Hide password' : 'Show password'}
          >
            {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <span className="mt-1.5 block text-xs font-medium text-red-600">{error}</span>}
    </div>
  );
}
