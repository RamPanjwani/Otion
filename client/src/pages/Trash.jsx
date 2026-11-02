import { ArchiveX, RotateCcw, Trash2 } from 'lucide-react';
import AmbientBackground from '../components/AmbientBackground';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Loading from '../components/Loading';
import PageTransition from '../components/PageTransition';
import useNotes from '../hooks/useNotes';
import api from '../services/api';

export default function Trash() {
  const { notes: archived, setNotes: setArchived, loading, error } = useNotes({ archived: true });
  const { notes: active, setNotes: setActive } = useNotes();
  const restore = async (id) => { const { data } = await api.patch(`/notes/${id}/restore`); setArchived((items) => items.filter((note) => note._id !== id)); setActive((items) => [data, ...items]); };
  const remove = async (id) => { if (!window.confirm('Permanently delete this note? This cannot be undone.')) return; await api.delete(`/notes/${id}`); setArchived((items) => items.filter((note) => note._id !== id)); };

  return (
    <div className="relative min-h-screen bg-canvas md:pl-60">
      <AmbientBackground subtle />
      <Sidebar notes={active} onCreated={(note) => setActive((items) => [note, ...items.filter((item) => item._id !== note._id)])} onReordered={setActive} />
      <Navbar title="Trash" />
      <PageTransition as="main" className="mx-auto max-w-4xl px-6 py-10 sm:px-10 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Workspace</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">Trash</h1>
        <p className="mt-3 text-muted">Restore notes to your workspace or delete them permanently.</p>
        <div className="mt-9">
          {loading ? <Loading /> : error ? <p className="text-red-700">{error}</p> : archived.length ? (
            <div className="surface-card divide-y divide-line overflow-hidden rounded-[20px]">
              {archived.map((note) => <div key={note._id} className="flex items-center gap-4 p-5 transition hover:bg-panel/60"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-panel text-2xl">{note.icon || '📝'}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{note.title}</p><p className="mt-1 text-xs text-muted">Archived {new Date(note.updatedAt).toLocaleDateString()}</p></div><button onClick={() => restore(note._id)} className="secondary-action px-3 py-2 text-sm"><RotateCcw size={16} /><span className="hidden sm:inline">Restore</span></button><button onClick={() => remove(note._id)} className="icon-action h-9 w-9 hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${note.title} permanently`}><Trash2 size={18} /></button></div>)}
            </div>
          ) : (
            <div className="surface-card rounded-[22px] px-6 py-16 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-panel text-muted"><ArchiveX size={25} /></span><h2 className="mt-5 text-lg font-semibold">Trash is empty</h2><p className="mt-2 text-sm text-muted">Deleted notes will appear here until you restore or permanently delete them.</p></div>
          )}
        </div>
      </PageTransition>
    </div>
  );
}
