import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault(); setSubmitting(true); setError('');
    try { await login(form); navigate('/dashboard'); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to sign in'); }
    finally { setSubmitting(false); }
  };

  return <AuthShell title="Welcome back" subtitle="Sign in to your account to continue" footer={<>Don&apos;t have an account? <Link to="/register" className="font-semibold">Sign up</Link></>}><form onSubmit={submit} className="space-y-4"><Field label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} /><Field label="Password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} />{error && <p className="text-sm text-red-700">{error}</p>}<button disabled={submitting} className="w-full rounded-xl bg-ink py-3 font-semibold text-white disabled:opacity-50">{submitting ? 'Signing in…' : 'Sign in'}</button></form></AuthShell>;
}

export function AuthShell({ title, subtitle, children, footer }) {
  return <main className="grid min-h-screen place-items-center bg-canvas p-5"><div className="w-full max-w-[560px]"><section className="rounded-xl border border-line bg-white p-8 shadow-xl shadow-ink/5 sm:p-12"><Link to="/" className="mb-9 flex items-center justify-center gap-3 text-xl font-bold"><span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white">O</span>Otion</Link><h1 className="text-center text-3xl font-bold">{title}</h1><p className="mb-9 mt-3 text-center text-muted">{subtitle}</p>{children}</section><p className="mt-7 text-center text-sm">{footer}</p></div></main>;
}

export function Field({ label, type = 'text', value, onChange, minLength, autoComplete }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} minLength={minLength} autoComplete={autoComplete} required className="w-full rounded-xl border border-line bg-canvas px-4 py-3 outline-none focus:border-ink" /></label>;
}
