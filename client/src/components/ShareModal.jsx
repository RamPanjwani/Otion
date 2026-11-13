import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Link2, LoaderCircle, Trash2 } from 'lucide-react';
import Modal from './Modal';
import api from '../services/api';
import useToast from '../hooks/useToast';

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
  const [copiedLink, setCopiedLink] = useState(false);
  const toast = useToast();

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

  const copyToClipboard = async (text, label = 'Link copied to clipboard') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(true);
      toast.success(label);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const invite = async (event) => {
    event.preventDefault();
    try {
      const { data } = await api.post(`/share/${noteId}/invite`, { email, role });
      if (data.pending) {
        const generatedLink = `${window.location.origin}/register?invite=${encodeURIComponent(data.invitationToken)}&email=${encodeURIComponent(data.invitation.email)}`;
        setPendingLink(generatedLink);
        await copyToClipboard(generatedLink, 'Invitation link copied automatically!');
      } else {
        toast.success(`Access granted to ${email}`);
      }
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
      if (enabling && data.token) {
        const url = `${window.location.origin}/public/${data.token}`;
        await copyToClipboard(url, 'Public link created & copied to clipboard!');
      }
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
      if (data.token) {
        const url = `${window.location.origin}/public/${data.token}`;
        await copyToClipboard(url, 'New public link copied to clipboard!');
      }
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
        collaborators: current.collaborators.map((item) =>
          item.userId._id === userId ? { ...item, role: nextRole } : item,
        ),
      }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Role change failed');
    }
  };

  const shareUrl = publicToken ? `${window.location.origin}/public/${publicToken}` : '';

  return (
    <Modal open={open} onClose={onClose} title="Share Note">
      <div className="space-y-6">
        {error && <p role="alert" className="error-alert">{error}</p>}

        <form onSubmit={invite} className="relative space-y-3">
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Invite a person</label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                required
                className="field-control w-full px-3.5 py-2.5 text-sm"
              />
              {searching && <LoaderCircle size={15} className="absolute right-3 top-3 animate-spin text-muted" />}
            </div>
            <select value={role} onChange={(event) => setRole(event.target.value)} className="field-control w-auto px-3 py-2.5 text-sm capitalize">
              <option value="editor">Editor</option>
              <option value="commenter">Commenter</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="primary-action shrink-0 px-4 py-2.5 text-sm">Invite</button>
          </div>

          {suggestionsOpen && suggestions.length > 0 && (
            <div className="elevated-panel absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-xl p-1">
              {suggestions.map((user) => (
                <button
                  key={user._id}
                  type="button"
                  onClick={() => { setEmail(user.email); setSuggestionsOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-panel"
                >
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-ink text-xs font-semibold text-surface">{user.name?.slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{user.name}</p><p className="truncate text-xs text-muted">{user.email}</p></div>
                </button>
              ))}
            </div>
          )}
        </form>

        {pendingLink && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">Invite link created</p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-200">Send this link to the invited person; it expires in seven days.</p>
            <div className="mt-3 flex gap-2">
              <input readOnly value={pendingLink} className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs dark:border-amber-900 dark:bg-panel" />
              <button
                type="button"
                onClick={() => copyToClipboard(pendingLink, 'Invite link copied!')}
                className="flex items-center gap-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-amber-100 dark:border-amber-900 dark:bg-panel"
                aria-label="Copy invitation link"
              >
                {copiedLink ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                <span className="hidden sm:inline">Copy</span>
              </button>
            </div>
          </div>
        )}

        <section className="surface-card rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Public link access</h3>
              <p className="text-sm text-muted">{state.isPublished ? 'Anyone with this link can view' : 'No public link exists'}</p>
            </div>
            {state.isPublished ? (
              <button type="button" onClick={togglePublic} className="secondary-action whitespace-nowrap px-3 py-2 text-sm hover:text-red-600 dark:hover:text-red-400">
                Disable link
              </button>
            ) : (
              <button type="button" onClick={togglePublic} className="primary-action whitespace-nowrap px-4 py-2 text-sm">
                Create & Copy link
              </button>
            )}
          </div>
          {!state.isPublished && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-muted">
                Optional password
                <input
                  type="password"
                  value={publicPassword}
                  onChange={(event) => setPublicPassword(event.target.value)}
                  minLength={8}
                  maxLength={128}
                  placeholder="At least 8 characters"
                  className="field-control mt-1 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-muted">
                Optional expiration
                <input
                  type="datetime-local"
                  value={publicExpiry}
                  onChange={(event) => setPublicExpiry(event.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="field-control mt-1 px-3 py-2 text-sm"
                />
              </label>
            </div>
          )}
          {state.isPublished && (
            publicToken ? (
              <div className="mt-4 flex gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm text-muted dark:bg-panel">
                  <Link2 size={16} />
                  <span className="truncate">{shareUrl}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(shareUrl, 'Public link copied!')}
                  className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold hover:bg-panel dark:bg-panel"
                  aria-label="Copy public link"
                >
                  <Copy size={16} />
                  <span>Copy</span>
                </button>
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-3 dark:bg-panel">
                <p className="text-xs text-muted">For security, the secret link is shown only when created.</p>
                <button type="button" onClick={regeneratePublic} className="shrink-0 rounded-xl border border-line px-3 py-2 text-xs font-semibold hover:bg-panel">
                  Generate new link
                </button>
              </div>
            )
          )}
        </section>

        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">People with access</p>
          {state.owner && <Person person={state.owner} role="Owner" />}
          {state.collaborators.map((entry) => (
            <Person
              key={entry._id}
              person={entry.userId}
              role={entry.role}
              onRoleChange={(nextRole) => changeRole(entry.userId._id, nextRole)}
              onRemove={() => revoke(entry.userId._id)}
            />
          ))}
          {state.pendingInvitations?.map((invitation) => (
            <div key={invitation._id} className="flex items-center gap-3 py-3">
              <div className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-line text-xs text-muted">?</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{invitation.email}</p>
                <p className="text-xs text-muted">Pending until {new Date(invitation.expiresAt).toLocaleString()}</p>
              </div>
              <span className="text-sm capitalize text-muted">{invitation.role}</span>
              <button
                type="button"
                onClick={() => revokePending(invitation._id)}
                className="rounded-xl p-2 text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                aria-label={`Revoke invitation for ${invitation.email}`}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </section>
      </div>
    </Modal>
  );
}

function Person({ person, role, onRoleChange, onRemove }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-ink text-sm font-semibold text-surface">
        {person.name?.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{person.name}</p>
        <p className="truncate text-sm text-muted">{person.email}</p>
      </div>
      {onRoleChange ? (
        <select value={role} onChange={(event) => onRoleChange(event.target.value)} className="field-control w-auto px-2 py-1.5 text-sm capitalize">
          <option value="editor">Editor</option>
          <option value="commenter">Commenter</option>
          <option value="viewer">Viewer</option>
        </select>
      ) : (
        <span className="capitalize text-sm text-muted">{role}</span>
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          className="icon-action h-9 w-9 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          aria-label={`Revoke ${person.name}`}
        >
          <Trash2 size={17} />
        </button>
      )}
    </div>
  );
}
