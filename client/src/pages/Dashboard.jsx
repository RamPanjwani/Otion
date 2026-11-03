import { motion } from 'motion/react';
import { ArrowRight, CheckSquare, Clock3, FilePlus2, FolderOpen, MoreHorizontal, Square, Star, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Loading from '../components/Loading';
import PageTransition from '../components/PageTransition';
import useAuth from '../hooks/useAuth';
import useNotes from '../hooks/useNotes';
import useVirtualList from '../hooks/useVirtualList';
import useDocumentTitle from '../hooks/useDocumentTitle';
import api from '../services/api';

export default function Dashboard() {
  useDocumentTitle('Your notes');
  const { user } = useAuth();
  const { notes, setNotes, loading, error } = useNotes();
  const navigate = useNavigate();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const createNote = async () => {
    const { data } = await api.post('/notes', { title: 'Untitled note' });
    setNotes((current) => [data, ...current.filter((note) => note._id !== data._id)]);
    navigate(`/notes/${data._id}`);
  };

  const visibleNotes = useMemo(() => {
    const favorites = [];
    const others = [];
    for (const note of notes) {
      if (note.isFavorite) favorites.push(note);
      else others.push(note);
    }
    return [...favorites, ...others];
  }, [notes]);
  const { virtualItems, totalHeight, isVirtualized } = useVirtualList(visibleNotes, { itemHeight: 68 });
  const firstName = user?.name?.split(' ')[0] || 'there';

  const toggleSelected = (noteId) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(noteId)) next.delete(noteId);
    else next.add(noteId);
    return next;
  });

  const closeSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBulkError('');
  };

  const removeNotesLocally = (noteIds) => {
    const removed = new Set(noteIds.map(String));
    setNotes((current) => current.filter((note) => !removed.has(String(note._id))));
    setSelectedIds((current) => new Set([...current].filter((noteId) => !removed.has(String(noteId)))));
  };

  const moveSelectedToTrash = async () => {
    const noteIds = [...selectedIds];
    if (!noteIds.length || deleting) return;
    setDeleting(true);
    setBulkError('');
    try {
      await api.patch('/notes/archive-many', { noteIds });
      removeNotesLocally(noteIds);
      closeSelection();
    } catch (requestError) {
      setBulkError(requestError.response?.data?.message || 'Unable to move notes to Trash');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="app-shell relative min-h-screen bg-canvas">
      <Sidebar notes={notes} onCreated={(note) => setNotes((current) => [note, ...current.filter((item) => item._id !== note._id)])} onReordered={setNotes} />
      <Navbar title="Home" />
      <PageTransition as="main" className="mx-auto max-w-5xl px-5 py-12 sm:px-10 lg:py-16">
        <section className="flex flex-col gap-6 border-b border-line pb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted">Welcome back, {firstName}</p>
            <h1 className="mt-1 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">Your notes</h1>
            <p className="mt-3 max-w-xl text-[15px] leading-7 text-muted">Pick up where you left off, or start with a blank note.</p>
          </div>
          <button onClick={createNote} className="primary-action h-10 shrink-0 px-4 text-sm"><FilePlus2 size={17} /> New note</button>
        </section>

        <section className="mt-9">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3"><h2 className="text-sm font-semibold">All notes</h2><span className="rounded-md bg-panel px-2 py-1 text-xs text-muted">{notes.length}</span></div>
            <div className="flex items-center gap-2">{selectionMode ? <><button type="button" onClick={closeSelection} className="secondary-action px-3 py-2 text-sm"><X size={16} /> Cancel</button><button type="button" onClick={moveSelectedToTrash} disabled={!selectedIds.size || deleting} className="danger-action px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={16} /> {deleting ? 'Moving…' : `Trash ${selectedIds.size || ''}`}</button></> : <button type="button" onClick={() => setSelectionMode(true)} className="secondary-action px-3 py-2 text-sm"><CheckSquare size={16} /> Select notes</button>}</div>
          </div>
          {bulkError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{bulkError}</p>}
          {loading ? <Loading /> : error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p> : visibleNotes.length ? (
            <div
              className="overflow-hidden rounded-xl border border-line bg-surface"
              style={isVirtualized ? { height: `${totalHeight}px`, position: 'relative' } : undefined}
            >
              {virtualItems.map(({ item: note, index, offsetTop }) => (
                <motion.button
                  key={note._id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: Math.min(index * 0.025, 0.2) }}
                  onClick={() => selectionMode ? String(note.user?._id || note.user) === String(user?._id) && toggleSelected(String(note._id)) : navigate(`/notes/${note._id}`)}
                  disabled={selectionMode && String(note.user?._id || note.user) !== String(user?._id)}
                  aria-pressed={selectionMode ? selectedIds.has(String(note._id)) : undefined}
                  style={isVirtualized ? { position: 'absolute', top: `${offsetTop}px`, left: 0, right: 0, height: '68px' } : undefined}
                  className={`note-list-row group flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left last:border-b-0 disabled:cursor-not-allowed disabled:opacity-45 ${selectedIds.has(String(note._id)) ? 'bg-accent-soft' : ''}`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-panel text-2xl ring-1 ring-line/70">{note.icon || '📝'}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{note.title || 'Untitled note'}</span><span className="mt-1 block truncate text-xs text-muted">{notePreview(note)}</span></span>
                  {note.isFavorite && <Star size={16} className="shrink-0 fill-amber-400 text-amber-400" />}
                  <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted sm:flex"><Clock3 size={13} /> {new Date(note.updatedAt).toLocaleDateString()}</span>
                  {selectionMode ? selectedIds.has(String(note._id)) ? <CheckSquare size={18} className="shrink-0 text-accent" /> : <Square size={18} className="shrink-0 text-muted" /> : <MoreHorizontal size={17} className="shrink-0 text-muted opacity-0 transition group-hover:opacity-100" />}
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line px-6 py-20 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-panel text-muted"><FolderOpen size={22} /></span><h3 className="mt-4 text-base font-semibold">No notes yet</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Create your first note and start writing.</p><button onClick={createNote} className="secondary-action mt-5 px-4 py-2.5 text-sm"><FilePlus2 size={16} /> New note <ArrowRight size={14} /></button></div>
          )}
        </section>
      </PageTransition>
    </div>
  );
}

function notePreview(note) {
  const text = Array.isArray(note.content) ? note.content.map((block) => block.text || '').join(' ').trim() : '';
  return text || 'Empty note';
}
