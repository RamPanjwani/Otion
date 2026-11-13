import { useEffect, useState } from 'react';
import { Clock3, RotateCcw, Save } from 'lucide-react';
import Modal from './Modal';
import api from '../services/api';

export default function VersionHistoryModal({ open, onClose, noteId, canRestore, onRestored }) {
  const [revisions, setRevisions] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    if (!open || !noteId) return undefined;
    let active = true;
    api.get(`/notes/${noteId}/revisions`)
      .then(({ data }) => { if (active) { setRevisions(data); setError(''); } })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to load version history'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [noteId, open]);

  const createVersion = async (event) => {
    event.preventDefault();
    setBusyId('create');
    try {
      const { data } = await api.post(`/notes/${noteId}/revisions`, { name: name.trim() || undefined });
      setRevisions((current) => [data, ...current]);
      setName('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save this version');
    } finally {
      setBusyId('');
    }
  };

  const restore = async (revision) => {
    setBusyId(revision._id);
    try {
      const { data } = await api.post(`/notes/${noteId}/revisions/${revision._id}/restore`);
      onRestored?.(data);
      onClose();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to restore this version');
    } finally {
      setBusyId('');
    }
  };

  return <Modal open={open} onClose={onClose} title="Version history">
    <div className="p-6">
      {canRestore && <form onSubmit={createVersion} className="mb-5 flex gap-2"><input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Name this version (optional)" className="field-control min-w-0 flex-1 px-3 py-2 text-sm" /><button type="submit" disabled={busyId === 'create'} className="primary-action px-4 py-2 text-sm disabled:opacity-50"><Save size={16} /> Save version</button></form>}
      {error && <p role="alert" className="error-alert mb-4">{error}</p>}
      {loading ? <p className="py-8 text-center text-sm text-muted">Loading versions…</p> : revisions.length === 0 ? <p className="py-8 text-center text-sm text-muted">No saved versions yet.</p> : <div className="space-y-2">{revisions.map((revision) => <article key={revision._id} className="surface-card flex items-center gap-3 rounded-xl p-4"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Clock3 size={17} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{revision.name || `${revision.reason[0].toUpperCase()}${revision.reason.slice(1)} version`}</p><p className="text-xs text-muted">#{revision.revisionNumber} · {revision.author?.name || 'Unknown'} · {new Date(revision.createdAt).toLocaleString()}</p></div>{canRestore && <button type="button" onClick={() => restore(revision)} disabled={Boolean(busyId)} className="secondary-action px-3 py-2 text-xs disabled:opacity-50"><RotateCcw size={14} /> Restore</button>}</article>)}</div>}
    </div>
  </Modal>;
}
