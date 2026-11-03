import { useState } from 'react';
import { Download, KeyRound, Save, Trash2, UserRound } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import PageTransition from '../components/PageTransition';
import useAuth from '../hooks/useAuth';
import useNotes from '../hooks/useNotes';
import api from '../services/api';

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const { notes, setNotes } = useNotes();
  const [profile, setProfile] = useState({ name: user?.name || '', avatarUrl: user?.avatarUrl || '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [busy, setBusy] = useState('');

  const saveProfile = async (event) => {
    event.preventDefault();
    setBusy('profile');
    try {
      const { data } = await api.patch('/auth/profile', { name: profile.name.trim(), avatarUrl: profile.avatarUrl.trim() });
      updateUser(data);
      setMessage('Profile updated');
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update profile');
    } finally { setBusy(''); }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) return setError('New passwords do not match');
    setBusy('password');
    try {
      await api.patch('/auth/password', { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage('Password changed');
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to change password');
    } finally { setBusy(''); }
  };

  const exportData = async () => {
    setBusy('export');
    try {
      const { data } = await api.get('/auth/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `otion-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally { setBusy(''); }
  };

  const deleteAccount = async (event) => {
    event.preventDefault();
    setBusy('delete');
    try {
      await api.delete('/auth/account', { data: { password: deletePassword } });
      logout();
      window.location.assign('/');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete account');
      setDeleteOpen(false);
    } finally { setBusy(''); }
  };

  return (
    <div className="app-shell relative min-h-screen bg-canvas">
      <Sidebar notes={notes} onCreated={(note) => setNotes((current) => [note, ...current])} onReordered={setNotes} />
      <Navbar title="Settings" />
      <PageTransition as="main" className="mx-auto max-w-3xl space-y-5 px-6 py-12 sm:px-10 sm:py-16">
        <div className="mb-9"><h1 className="text-4xl font-bold tracking-[-0.04em]">Settings</h1><p className="mt-3 text-muted">Manage your profile, security, and Otion data.</p></div>
        {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{message}</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <SettingsCard icon={<UserRound size={18} />} title="Profile" description="How you appear to collaborators across Otion.">
          <form onSubmit={saveProfile}>
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingField label="Name"><input value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} required maxLength={100} className="field-control mt-2 px-3 py-2.5" /></SettingField>
              <SettingField label="Avatar URL"><input type="url" value={profile.avatarUrl} onChange={(event) => setProfile((current) => ({ ...current, avatarUrl: event.target.value }))} placeholder="https://…" className="field-control mt-2 px-3 py-2.5" /></SettingField>
            </div>
            <button disabled={busy === 'profile'} className="primary-action mt-5 px-4 py-2.5 text-sm disabled:opacity-50"><Save size={16} /> Save profile</button>
          </form>
        </SettingsCard>

        <SettingsCard icon={<KeyRound size={18} />} title="Password" description="Use a strong password you do not reuse elsewhere.">
          <form onSubmit={changePassword} className="space-y-4">
            <input type="password" value={passwords.currentPassword} onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))} required placeholder="Current password" className="field-control px-3 py-2.5" />
            <div className="grid gap-4 sm:grid-cols-2"><input type="password" value={passwords.newPassword} onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))} required minLength={8} placeholder="New password" className="field-control px-3 py-2.5" /><input type="password" value={passwords.confirmPassword} onChange={(event) => setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))} required minLength={8} placeholder="Confirm new password" className="field-control px-3 py-2.5" /></div>
            <button disabled={busy === 'password'} className="secondary-action px-4 py-2.5 text-sm disabled:opacity-50">Change password</button>
          </form>
        </SettingsCard>

        <SettingsCard icon={<Download size={18} />} title="Your data" description="Download a JSON copy of your profile, notes, preferences, and comments.">
          <button type="button" onClick={exportData} disabled={busy === 'export'} className="secondary-action px-4 py-2.5 text-sm"><Download size={16} /> Export data</button>
        </SettingsCard>

        <section className="overflow-hidden rounded-[22px] border border-red-300 bg-red-50 shadow-sm dark:border-red-900/80 dark:bg-red-950/35">
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700 ring-1 ring-red-200 dark:bg-red-900/60 dark:text-red-200 dark:ring-red-800"><Trash2 size={19} /></span><div><h2 className="text-base font-bold text-red-800 dark:text-red-100">Delete account</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-red-700/80 dark:text-red-200/75">Permanently deletes your notes, comments, permissions, and account. This cannot be undone.</p></div></div>
            <button type="button" onClick={() => setDeleteOpen(true)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:bg-red-500 dark:text-red-950 dark:hover:bg-red-400 dark:focus-visible:ring-offset-zinc-950"><Trash2 size={16} /> Delete account</button>
          </div>
        </section>
      </PageTransition>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Permanently delete account"><form onSubmit={deleteAccount} className="space-y-5 p-6"><div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800 dark:border-red-900 dark:bg-red-950/45 dark:text-red-200">Enter your password to confirm. Your account and all owned notes will be permanently removed.</div><label className="block text-sm font-semibold">Password<input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} required autoFocus className="field-control mt-2 px-3 py-2.5" placeholder="Enter your password" /></label><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setDeleteOpen(false)} className="secondary-action justify-center px-4 py-2.5 text-sm">Cancel</button><button type="submit" disabled={busy === 'delete'} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-wait disabled:opacity-50 dark:bg-red-500 dark:text-red-950 dark:hover:bg-red-400"><Trash2 size={16} /> {busy === 'delete' ? 'Deleting…' : 'Delete permanently'}</button></div></form></Modal>
    </div>
  );
}

function SettingsCard({ icon, title, description, children }) {
  return <section className="rounded-xl border border-line bg-surface p-6"><div className="mb-5 flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-panel text-muted">{icon}</span><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted">{description}</p></div></div>{children}</section>;
}

function SettingField({ label, children }) {
  return <label className="text-sm font-semibold">{label}{children}</label>;
}
