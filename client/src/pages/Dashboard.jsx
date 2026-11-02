import { motion } from 'motion/react';
import { ArrowRight, Clock3, FilePlus2, FolderOpen, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AmbientBackground from '../components/AmbientBackground';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Loading from '../components/Loading';
import PageTransition from '../components/PageTransition';
import useAuth from '../hooks/useAuth';
import useNotes from '../hooks/useNotes';
import api from '../services/api';

export default function Dashboard() {
  const { user } = useAuth();
  const { notes, setNotes, loading, error } = useNotes();
  const navigate = useNavigate();
  const createNote = async () => {
    const { data } = await api.post('/notes', { title: 'Untitled note' });
    setNotes((current) => [data, ...current.filter((note) => note._id !== data._id)]);
    navigate(`/notes/${data._id}`);
  };

  const visibleNotes = notes.slice(0, 6);
  const greeting = `${user?.name?.split(' ')[0] || 'Your'}'s workspace`;

  return (
    <div className="relative min-h-screen bg-canvas md:pl-60">
      <AmbientBackground subtle />
      <Sidebar notes={notes} onCreated={(note) => setNotes((current) => [note, ...current.filter((item) => item._id !== note._id)])} onReordered={setNotes} />
      <Navbar title="Workspace" />
      <PageTransition as="main" className="mx-auto max-w-6xl px-6 py-10 sm:px-10 lg:py-14">
        <section className="glass-panel relative overflow-hidden rounded-[24px] px-6 py-10 sm:px-10 sm:py-12">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="absolute -bottom-28 right-40 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface/65 px-3 py-1.5 text-xs font-semibold text-muted"><Sparkles size={14} className="text-accent" /> Your collaborative home</div>
            <h1 className="text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Welcome to <span className="text-brand-gradient">{greeting}</span></h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">Capture the idea, shape the plan, and keep everyone aligned in one living workspace.</p>
            <button onClick={createNote} className="primary-action mt-7 px-5 py-3"><FilePlus2 size={18} /> Create a note <ArrowRight size={16} /></button>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Workspace</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">Your notes</h2></div>
            <span className="rounded-full border border-line bg-surface/60 px-3 py-1.5 text-xs font-medium text-muted">{notes.length} total</span>
          </div>
          {loading ? <Loading /> : error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p> : visibleNotes.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleNotes.map((note, index) => (
                <motion.button key={note._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.045 }} whileHover={{ y: -2 }} onClick={() => navigate(`/notes/${note._id}`)} className="surface-card group rounded-2xl p-5 text-left transition-shadow hover:shadow-lg">
                  <div className="mb-9 flex items-start justify-between"><span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-3xl">{note.icon || '📝'}</span><ArrowRight size={16} className="text-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" /></div>
                  <h3 className="truncate text-base font-semibold">{note.title || 'Untitled note'}</h3>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Clock3 size={13} /> Updated {new Date(note.updatedAt).toLocaleDateString()}</p>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="surface-card rounded-[22px] px-6 py-16 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-panel text-muted"><FolderOpen size={25} /></span><h3 className="mt-5 text-lg font-semibold">A fresh workspace</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Create your first note and turn this blank canvas into a shared source of truth.</p><button onClick={createNote} className="secondary-action mt-6 px-4 py-2.5 text-sm"><FilePlus2 size={16} /> New note</button></div>
          )}
        </section>
      </PageTransition>
    </div>
  );
}
