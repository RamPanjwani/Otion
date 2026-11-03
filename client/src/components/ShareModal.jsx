import { useCallback, useEffect, useState } from 'react';
import { Copy, Link2, LoaderCircle, Search, Trash2 } from 'lucide-react';
import Modal from './Modal';
import api from '../services/api';

export default function ShareModal({ open, onClose, noteId }) {
  const [state, setState] = useState({ owner: null, collaborators: [], pendingInvitations: [], isPublished: false });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [publicToken, setPublicToken] = useState('');
  const [publicPassword, setPublicPassword] = useState('');
  const [publicExpiry, setPublicExpiry] = useState('');
  const [pendingLink, setPendingLink] = useState('');

  const load = useCallback(async () => {
    if (!noteId) return;
    try {
      const { data } = await api.get(`/share/${noteId}/collaborators`);
      setState(data);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load access list');
    }
  }, [noteId]);

  useEffect(() => {
    if (!open || !noteId) return;
    let active = true;
    api.get(`/share/${noteId}/collaborators`)
      .then(({ data }) => { if (active) { setState(data); setError(''); } })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to load access list'); });
    return () => { active = false; };
  }, [open, noteId]);

  useEffect(() => {
    const query = email.trim();
    if (!open || query.length < 2) return undefined;
    let active = true;
    const timeout = window.setTimeout(() => {
      setSearching(true);
      api.get('/share/users/search', { params: { q: query } })
        .then(({ data }) => {
          if (!active) return;
          const excluded = new Set([state.owner?._id, ...state.collaborators.map((entry) => entry.userId._id)]);
          setSuggestions(data.filter((user) => !excluded.has(user._id)));
          setSuggestionsOpen(true);
        })
        .catch(() => { if (active) setSuggestions([]); })
        .finally(() => { if (active) setSearching(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [email, open, state.collaborators, state.owner]);

  const invite = async (event) => {
    event.preventDefault();
    try {
      const { data } = await api.post(`/share/${noteId}/invite`, { email, role });
      if (data.pending) setPendingLink(`${window.location.origin}/register?invite=${encodeURIComponent(data.invitationToken)}&email=${encodeURIComponent(data.invitation.email)}`);
      setEmail('');
      setSuggestions([]);
      setSuggestionsOpen(false);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Invite failed');
    }
  };

  const togglePublic = async () => {
    const enabling = !state.isPublished;
    if (enabling && publicPassword && publicPassword.length < 8) return setError('Public link password must contain at least 8 characters');
    try {
      const { data } = await api.patch(`/share/${noteId}/public`, {
        isPublished: enabling,
        password: enabling && publicPassword ? publicPassword : undefined,
        expiresAt: enabling && publicExpiry ? new Date(publicExpiry).toISOString() : undefined,
      });
      setState((current) => ({ ...current, isPublished: data.isPublished }));
      setPublicToken(data.token || '');
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update public access');
    }
  };

  const regeneratePublic = async () => {
    if (publicPassword && publicPassword.length < 8) return setError('Public link password must contain at least 8 characters');
    try {
      const { data } = await api.patch(`/share/${noteId}/public`, {
        isPublished: true,
        password: publicPassword || undefined,
        expiresAt: publicExpiry ? new Date(publicExpiry).toISOString() : undefined,
      });
      setState((current) => ({ ...current, isPublished: true }));
      setPublicToken(data.token || '');
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to regenerate public link');
    }
  };

  const revoke = async (userId) => {
    await api.delete(`/share/${noteId}/user/${userId}`);
    await load();
  };

  const revokePending = async (invitationId) => {
    await api.delete(`/share/${noteId}/invitation/${invitationId}`);
    setPendingLink('');
    await load();
  };

  const changeRole = async (userId, nextRole) => {
    try {
      await api.patch(`/share/${noteId}/user/${userId}`, { role: nextRole });
      setState((current) => ({
        ...current,
        collaborators: current.collaborators.map((entry) => entry.userId._id === userId ? { ...entry, role: nextRole } : entry),
      }));
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to change role');
    }
  };

  const shareUrl = publicToken ? `${window.location.origin}/public/${publicToken}` : '';
  const handleEmailChange = (value) => {
    setEmail(value);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setSearching(false);
    }
  };

  const selectSuggestion = (account) => {
    setEmail(account.email);
    setSuggestions([]);
    setSuggestionsOpen(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Share Note & Manage Access">
      <div className="space-y-7 p-6">
        <form onSubmit={invite} className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
          <div className="relative"><div className="field-control flex items-center px-4"><Search size={17} className="shrink-0 text-muted" /><input value={email} onChange={(event) => handleEmailChange(event.target.value)} onFocus={() => { if (suggestions.length || searching) setSuggestionsOpen(true); }} onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)} type="email" required placeholder="Add email or name…" autoComplete="off" className="min-w-0 flex-1 bg-transparent px-3 py-3 outline-none" />{searching && <LoaderCircle size={16} className="animate-spin text-muted" />}</div>{suggestionsOpen && <div className="elevated-panel absolute inset-x-0 top-[calc(100%+6px)] z-40 max-h-64 overflow-y-auto rounded-2xl p-1">{suggestions.length ? suggestions.map((account) => <button key={account._id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectSuggestion(account)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-panel"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-surface">{account.name?.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{account.name}</p><p className="truncate text-xs text-muted">{account.email}</p></div></button>) : !searching && <p className="px-3 py-4 text-center text-xs text-muted">No available Otion accounts</p>}</div>}</div>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="field-control px-3 py-3"><option value="editor">Editor</option><option value="commenter">Commenter</option><option value="viewer">Viewer</option></select>
          <button className="primary-action px-5 py-3">Send invite</button>
        </form>
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {pendingLink && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-900">Account invitation created</p><p className="mt-1 text-xs text-amber-800">Email delivery is not configured. Copy this secure link and send it to the invited person; it expires in seven days.</p><div className="mt-3 flex gap-2"><input readOnly value={pendingLink} className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs" /><button type="button" onClick={() => navigator.clipboard.writeText(pendingLink)} className="rounded-xl border border-amber-200 bg-white px-3" aria-label="Copy invitation link"><Copy size={16} /></button></div></div>}

        <section className="surface-card rounded-2xl p-5">
          <div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold">Public link access</h3><p className="text-sm text-muted">{state.isPublished ? 'Anyone with this link can view' : 'No public link exists'}</p></div>{state.isPublished ? <button type="button" onClick={togglePublic} className="secondary-action px-3 py-2 text-sm hover:text-red-700">Disable link</button> : <button type="button" onClick={togglePublic} className="primary-action px-4 py-2 text-sm">Create read-only link</button>}</div>
          {!state.isPublished && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-muted">Optional password<input type="password" value={publicPassword} onChange={(event) => setPublicPassword(event.target.value)} minLength={8} maxLength={128} placeholder="At least 8 characters" className="field-control mt-1 px-3 py-2 text-sm" /></label><label className="text-xs font-medium text-muted">Optional expiration<input type="datetime-local" value={publicExpiry} onChange={(event) => setPublicExpiry(event.target.value)} min={new Date().toISOString().slice(0, 16)} className="field-control mt-1 px-3 py-2 text-sm" /></label></div>}
          {state.isPublished && (publicToken ? <div className="mt-4 flex gap-2"><div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm text-muted"><Link2 size={16} /><span className="truncate">{shareUrl}</span></div><button onClick={() => navigator.clipboard.writeText(shareUrl)} className="rounded-xl border border-line bg-white px-3" aria-label="Copy public link"><Copy size={17} /></button></div> : <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-3"><p className="text-xs text-muted">For security, the secret link is shown only when it is created. Generate a new link to copy it.</p><button type="button" onClick={regeneratePublic} className="shrink-0 rounded-xl border border-line px-3 py-2 text-xs font-semibold hover:bg-panel">Generate new link</button></div>)}
        </section>

        <section><p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">People with access</p>
          {state.owner && <Person person={state.owner} role="Owner" />}
          {state.collaborators.map((entry) => <Person key={entry._id} person={entry.userId} role={entry.role} onRoleChange={(nextRole) => changeRole(entry.userId._id, nextRole)} onRemove={() => revoke(entry.userId._id)} />)}
          {state.pendingInvitations?.map((invitation) => <div key={invitation._id} className="flex items-center gap-3 py-3"><div className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-line text-xs text-muted">?</div><div className="min-w-0 flex-1"><p className="truncate font-medium">{invitation.email}</p><p className="text-xs text-muted">Pending until {new Date(invitation.expiresAt).toLocaleString()}</p></div><span className="text-sm capitalize text-muted">{invitation.role}</span><button type="button" onClick={() => revokePending(invitation._id)} className="rounded-xl p-2 text-muted hover:bg-red-50 hover:text-red-700" aria-label={`Revoke invitation for ${invitation.email}`}><Trash2 size={17} /></button></div>)}
        </section>
      </div>
    </Modal>
  );
}

function Person({ person, role, onRoleChange, onRemove }) {
  return <div className="flex items-center gap-3 py-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-ink text-sm font-semibold text-surface">{person.name?.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate font-medium">{person.name}</p><p className="truncate text-sm text-muted">{person.email}</p></div>{onRoleChange ? <select value={role} onChange={(event) => onRoleChange(event.target.value)} className="field-control w-auto px-2 py-1.5 text-sm capitalize"><option value="editor">Editor</option><option value="commenter">Commenter</option><option value="viewer">Viewer</option></select> : <span className="capitalize text-sm text-muted">{role}</span>}{onRemove && <button onClick={onRemove} className="icon-action h-9 w-9 hover:bg-red-50 hover:text-red-700" aria-label={`Revoke ${person.name}`}><Trash2 size={17} /></button>}</div>;
}
