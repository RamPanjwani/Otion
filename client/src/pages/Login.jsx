import { motion } from 'motion/react';
import { ArrowRight, LogIn, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import AmbientBackground from '../components/AmbientBackground';
import BrandMark from '../components/BrandMark';
import useAuth from '../hooks/useAuth';
import useTheme from '../hooks/useTheme';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must contain at least 8 characters'),
});

export default function Login() {
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
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} error={errors.email} autoComplete="email" placeholder="you@company.com" />
        <Field label="Password" type="password" value={form.password} onChange={(value) => update('password', value)} error={errors.password} autoComplete="current-password" placeholder="Your password" />
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={submitting} className="primary-action mt-2 w-full px-4 py-3.5 disabled:cursor-wait disabled:opacity-50">{submitting ? 'Signing in…' : <>Sign in <ArrowRight size={17} /></>}</button>
      </form>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children, footer, icon }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-12">
      <AmbientBackground />
      <div className="absolute left-5 top-5 sm:left-8 sm:top-7"><Link to="/"><BrandMark compact /></Link></div>
      <button type="button" onClick={toggleTheme} className="icon-action absolute right-5 top-5 h-10 w-10 border border-line bg-surface/65 backdrop-blur-xl sm:right-8 sm:top-7" aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-[430px]">
        <section className="glass-panel rounded-[24px] p-6 sm:p-8">
          <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl border border-line bg-panel text-muted">{icon || <LogIn size={20} />}</div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">{title}</h1>
          <p className="mb-8 mt-2 leading-6 text-muted">{subtitle}</p>
          {children}
        </section>
        <p className="mt-6 text-center text-sm text-muted">{footer}</p>
      </motion.div>
    </main>
  );
}

export function Field({ label, type = 'text', value, onChange, error, minLength, autoComplete, placeholder }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} minLength={minLength} autoComplete={autoComplete} placeholder={placeholder} aria-invalid={Boolean(error)} className={`field-control px-4 py-3 ${error ? 'border-red-400 focus:border-red-500' : ''}`} />
      {error && <span className="mt-1.5 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}
