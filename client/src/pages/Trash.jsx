import { RotateCcw, Trash2 } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Loading from '../components/Loading';
import useNotes from '../hooks/useNotes';
import api from '../services/api';

export default function Trash() {
  const { notes: archived, setNotes: setArchived, loading, error } = useNotes({ archived: true });
  const { notes: active, setNotes: setActive } = useNotes();
  const restore = async (id) => { const { data } = await api.patch(`/notes/${id}/restore`); setArchived((items) => items.filter((note) => note._id !== id)); setActive((items) => [data, ...items]); };
  const remove = async (id) => { if (!window.confirm('Permanently delete this note? This cannot be undone.')) return; await api.delete(`/notes/${id}`); setArchived((items) => items.filter((note) => note._id !== id)); };
  return <div className="min-h-screen bg-canvas md:pl-60"><Sidebar notes={active} onCreated={(note) => setActive((items) => [note, ...items.filter((item) => item._id !== note._id)])} /><Navbar title="Trash" /><main className="mx-auto max-w-4xl px-6 py-14 sm:px-10"><h1 className="text-4xl font-bold">Trash</h1><p className="mt-3 text-muted">Restore documents to your workspace or delete them permanently.</p><div className="mt-10">{loading ? <Loading /> : error ? <p className="text-red-700">{error}</p> : archived.length ? <div className="divide-y divide-line rounded-xl border border-line bg-white">{archived.map((note) => <div key={note._id} className="flex items-center gap-4 p-5"><span className="text-2xl">{note.icon || '◇'}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{note.title}</p><p className="text-xs text-muted">Archived {new Date(note.updatedAt).toLocaleDateString()}</p></div><button onClick={() => restore(note._id)} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm hover:bg-panel"><RotateCcw size={16} /><span className="hidden sm:inline">Restore</span></button><button onClick={() => remove(note._id)} className="rounded-xl p-2 text-muted hover:bg-red-50 hover:text-red-700"><Trash2 size={18} /></button></div>)}</div> : <div className="rounded-xl border border-dashed border-line py-20 text-center text-muted">Trash is empty.</div>}</div></main></div>;
}
