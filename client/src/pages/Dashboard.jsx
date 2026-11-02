import { FilePlus2, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Loading from '../components/Loading';
import useAuth from '../hooks/useAuth';
import useNotes from '../hooks/useNotes';
import api from '../services/api';

export default function Dashboard() {
  const { user } = useAuth();
  const { notes, setNotes, loading, error } = useNotes();
  const navigate = useNavigate();
  const createNote = async () => {
    const { data } = await api.post('/notes', { title: 'Untitled' });
    setNotes((current) => [data, ...current.filter((note) => note._id !== data._id)]);
    navigate(`/documents/${data._id}`);
  };

  return (
    <div className="min-h-screen bg-canvas md:pl-60">
      <Sidebar notes={notes} onCreated={(note) => setNotes((current) => [note, ...current.filter((item) => item._id !== note._id)])} />
      <Navbar title="Workspace" />
      <main className="mx-auto max-w-5xl px-6 py-16 sm:px-10 lg:py-24">
        <section className="text-center"><div className="mx-auto mb-8 grid h-36 w-56 place-items-center rounded-xl border border-line bg-white"><FolderOpen size={58} strokeWidth={1} /></div><h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Welcome to {user?.name?.split(' ')[0]}&apos;s Otion</h1><p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-muted">Your blank canvas awaits. Capture thoughts, organize projects, and collaborate in real time.</p><button onClick={createNote} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-ink px-7 py-3.5 font-semibold text-white"><FilePlus2 size={18} /> Create a note</button></section>
        <section className="mt-20"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">Recent documents</h2><span className="text-sm text-muted">{notes.length} total</span></div>{loading ? <Loading /> : error ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p> : notes.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{notes.slice(0, 6).map((note) => <button key={note._id} onClick={() => navigate(`/documents/${note._id}`)} className="rounded-xl border border-line bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"><div className="mb-8 text-2xl">{note.icon || '◇'}</div><h3 className="truncate font-semibold">{note.title}</h3><p className="mt-1 text-xs text-muted">Updated {new Date(note.updatedAt).toLocaleDateString()}</p></button>)}</div> : <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">No documents yet. Create your first note above.</p>}</section>
      </main>
    </div>
  );
}
