import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { AuthShell, Field } from './Login';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;
  const passwordsMismatch = Boolean(form.confirmPassword) && form.password !== form.confirmPassword;
  const submit = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      navigate('/dashboard');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create account');
    } finally {
      setSubmitting(false);
    }
  };
  return <AuthShell title="Create your workspace" subtitle="Start writing and collaborating in minutes" footer={<>Already have an account? <Link to="/login" className="font-semibold">Sign in</Link></>}><form onSubmit={submit} className="space-y-4"><Field label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} autoComplete="name" /><Field label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} autoComplete="email" /><Field label="Password (8+ characters)" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} minLength={8} autoComplete="new-password" /><Field label="Confirm password" type="password" value={form.confirmPassword} onChange={(confirmPassword) => setForm({ ...form, confirmPassword })} minLength={8} autoComplete="new-password" />{passwordsMismatch && <p className="text-sm text-red-700">Passwords do not match</p>}{error && !passwordsMismatch && <p className="text-sm text-red-700">{error}</p>}<button disabled={submitting || passwordsMismatch} className="w-full rounded-xl bg-ink py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Creating…' : 'Create account'}</button></form></AuthShell>;
}
