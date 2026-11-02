import { ArrowRight, MailCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import useAuth from '../hooks/useAuth';
import { AuthShell, Field } from './Login';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters').max(100, 'Name is too long'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must contain at least 8 characters'),
  confirmPassword: z.string().min(1, 'Confirm your password'),
}).refine((data) => data.password === data.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get('invite') || '';
  const [form, setForm] = useState({ name: '', email: searchParams.get('email') || '', password: '', confirmPassword: '' });
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
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await register({ name: parsed.data.name, email: parsed.data.email, password: parsed.data.password, invitationToken: invitationToken || undefined });
      navigate('/dashboard');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title={invitationToken ? 'Join the workspace' : 'Create your workspace'} subtitle={invitationToken ? 'Create your account to open the shared note.' : 'A focused home for your notes, decisions, and team.'} icon={invitationToken ? <MailCheck size={20} /> : <UserPlus size={20} />} footer={<>Already use Otion? <Link to="/login" className="font-semibold text-ink hover:text-accent">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {invitationToken && <p className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200"><MailCheck size={16} /> You were invited to collaborate on an Otion note.</p>}
        <Field label="Name" value={form.name} onChange={(value) => update('name', value)} error={errors.name} autoComplete="name" placeholder="Your name" />
        <Field label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} error={errors.email} autoComplete="email" placeholder="you@company.com" />
        <Field label="Password" type="password" value={form.password} onChange={(value) => update('password', value)} error={errors.password} minLength={8} autoComplete="new-password" placeholder="At least 8 characters" />
        <Field label="Confirm password" type="password" value={form.confirmPassword} onChange={(value) => update('confirmPassword', value)} error={errors.confirmPassword} minLength={8} autoComplete="new-password" placeholder="Repeat your password" />
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={submitting} className="primary-action mt-2 w-full px-4 py-3.5 disabled:cursor-wait disabled:opacity-50">{submitting ? 'Creating…' : <>{invitationToken ? 'Accept invitation' : 'Create account'} <ArrowRight size={17} /></>}</button>
      </form>
    </AuthShell>
  );
}
