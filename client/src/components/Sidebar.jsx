import { ChevronDown, ChevronUp, FilePlus2, GripVertical, Home, LogOut, Menu, Search, Settings, Star, Trash2, X } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import BrandMark from './BrandMark';

const DEFAULT_NOTE_ICON = '📝';

export default function Sidebar({ notes = [], onCreated, onReordered }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draggedNoteId, setDraggedNoteId] = useState('');
  const [dropTargetId, setDropTargetId] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [reorderError, setReorderError] = useState('');
  const searchInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const createNote = async () => {
    setCreating(true);
    try {
      const { data } = await api.post('/notes', { title: 'Untitled note' });
      onCreated?.(data);
      setOpen(false);
      navigate(`/notes/${data._id}`);
    } finally {
      setCreating(false);
    }
  };

  const navClass = ({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all ${isActive ? 'bg-surface font-semibold text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:bg-panel hover:text-ink'}`;
  const filteredNotes = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return notes;
    if (searchResults) return searchResults;
    return notes.filter((note) => {
      const blockText = Array.isArray(note.content) ? note.content.map((block) => block.text || '').join(' ') : '';
      return `${note.title || ''} ${blockText}`.toLocaleLowerCase().includes(needle);
    });
  }, [notes, query, searchResults]);

  const persistOrder = async (orderedNotes) => {
    onReordered?.(orderedNotes);
    setReorderError('');
    try {
      await api.patch('/notes/reorder', { noteIds: orderedNotes.map((note) => note._id) });
    } catch (requestError) {
      onReordered?.(notes);
      setReorderError(requestError.response?.data?.message || 'Unable to save note order');
    }
  };

  const moveNote = (noteId, direction) => {
    const index = notes.findIndex((note) => String(note._id) === String(noteId));
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= notes.length) return;
    const ordered = [...notes];
    [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
    persistOrder(ordered);
  };

  const dropNote = (targetId) => {
    if (!draggedNoteId || draggedNoteId === targetId) {
      setDraggedNoteId('');
      setDropTargetId('');
      return;
    }
    const from = notes.findIndex((note) => String(note._id) === draggedNoteId);
    const to = notes.findIndex((note) => String(note._id) === String(targetId));
    if (from < 0 || to < 0) return;
    const ordered = [...notes];
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    persistOrder(ordered);
    setDraggedNoteId('');
    setDropTargetId('');
  };

  const showSearch = () => {
    setSearchOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const closeSearch = () => {
    setQuery('');
    setSearchResults(null);
    setSearchOpen(false);
  };

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        showSearch();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    const needle = query.trim();
    if (!needle) return undefined;
    let active = true;
    const timeout = window.setTimeout(() => {
      api.get('/search', { params: { q: needle } })
        .then(({ data }) => { if (active) setSearchResults(data); })
        .catch(() => { if (active) setSearchResults([]); });
    }, 180);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [query]);

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Escape') closeSearch();
    if (event.key === 'Enter' && filteredNotes[0]) {
      navigate(`/notes/${filteredNotes[0]._id}`);
      setOpen(false);
      closeSearch();
    }
  };

  const renderNote = (note, index, list) => (
    <div
      key={note._id}
      className={`group flex items-center rounded-xl transition ${dropTargetId === String(note._id) ? 'bg-accent-soft ring-1 ring-accent/40' : ''}`}
      onDragOver={(event) => { event.preventDefault(); setDropTargetId(String(note._id)); }}
      onDragLeave={() => setDropTargetId('')}
      onDrop={(event) => { event.preventDefault(); dropNote(String(note._id)); }}
    >
      {!searchOpen && <button type="button" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDraggedNoteId(String(note._id)); }} onDragEnd={() => { setDraggedNoteId(''); setDropTargetId(''); }} className="cursor-grab rounded-lg p-1 text-muted opacity-0 transition hover:bg-panel hover:text-ink group-hover:opacity-100 focus:opacity-100 active:cursor-grabbing" aria-label={`Reorder ${note.title || 'note'}`}><GripVertical size={14} /></button>}
      <NavLink to={`/notes/${note._id}`} onClick={() => { setOpen(false); if (searchOpen) closeSearch(); }} className={`${navClass({ isActive: ['/notes/', '/documents/'].some((prefix) => location.pathname === `${prefix}${note._id}`) })} min-w-0 flex-1 px-2`}>
        <span className="w-6 text-center text-lg">{note.icon || DEFAULT_NOTE_ICON}</span><span className="truncate">{note.title || 'Untitled note'}</span>
      </NavLink>
      {!searchOpen && <div className="mr-1 flex opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <button type="button" onClick={() => moveNote(note._id, -1)} disabled={index === 0} className="grid h-7 w-6 place-items-center rounded text-muted hover:bg-panel hover:text-ink disabled:pointer-events-none disabled:opacity-25" aria-label={`Move ${note.title || 'note'} up`}><ChevronUp size={14} /></button>
        <button type="button" onClick={() => moveNote(note._id, 1)} disabled={index === list.length - 1} className="grid h-7 w-6 place-items-center rounded text-muted hover:bg-panel hover:text-ink disabled:pointer-events-none disabled:opacity-25" aria-label={`Move ${note.title || 'note'} down`}><ChevronDown size={14} /></button>
      </div>}
    </div>
  );

  return (
    <>
      <button type="button" className="glass-panel fixed left-3 top-3 z-40 rounded-xl p-2.5 md:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
      {open && <button className="fixed inset-0 z-30 bg-ink/20 md:hidden" onClick={() => setOpen(false)} aria-label="Close navigation overlay" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-surface/80 shadow-xl shadow-zinc-950/5 backdrop-blur-2xl transition-transform md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-4 py-5">
          <BrandMark compact className="min-w-0 flex-1" />
          <button className="icon-action h-8 w-8 md:hidden" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <div className="px-3 pb-4">
          <div className="surface-card flex items-center gap-3 rounded-2xl px-3 py-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-3xl" aria-hidden="true">🏠</span>
            <div className="min-w-0"><p className="truncate text-lg font-bold tracking-[-0.025em]">{user?.name?.split(' ')[0] || 'My'} Workspace</p><p className="text-[11px] font-medium text-muted">One home for every note</p></div>
          </div>
        </div>

        <nav className="space-y-1 px-3">
          {searchOpen ? <div className="surface-card flex items-center gap-2 rounded-xl px-3 py-2"><Search size={17} className="shrink-0 text-muted" /><input ref={searchInputRef} value={query} onChange={(event) => { setQuery(event.target.value); setSearchResults(null); }} onKeyDown={handleSearchKeyDown} placeholder="Search notes…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Search notes" /><button type="button" onClick={closeSearch} className="text-muted hover:text-ink" aria-label="Close search"><X size={16} /></button></div> : <button type="button" onClick={showSearch} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-panel hover:text-ink"><Search size={18} /> Search <kbd className="ml-auto rounded-md border border-line px-1.5 py-0.5 text-[9px] text-muted">Ctrl K</kbd></button>}
          <button type="button" onClick={createNote} disabled={creating} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-panel hover:text-ink disabled:opacity-50"><FilePlus2 size={18} /> {creating ? 'Creating…' : 'New note'}</button>
          <NavLink to="/dashboard" className={navClass}><Home size={18} /> Home</NavLink>
        </nav>

        <div className="otion-scrollbar mt-4 flex-1 overflow-y-auto px-3">
          {!searchOpen && filteredNotes.some((note) => note.isFavorite) && <div className="mb-4"><p className="mb-1 flex items-center gap-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted"><Star size={11} /> Favorites</p>{filteredNotes.filter((note) => note.isFavorite).map((note) => (
            <NavLink key={`favorite-${note._id}`} to={`/notes/${note._id}`} onClick={() => setOpen(false)} className={navClass}><span className="w-5 text-center">{note.icon || DEFAULT_NOTE_ICON}</span><span className="truncate">{note.title || 'Untitled note'}</span></NavLink>
          ))}</div>}
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Notes</p>
          <div className="space-y-0.5">{filteredNotes.map((note, index) => renderNote(note, index, filteredNotes))}</div>
          {searchOpen && query.trim() && filteredNotes.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted">No matching notes</p>}
          {reorderError && <p role="alert" className="mx-2 mt-3 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-200">{reorderError}</p>}
        </div>

        <div className="space-y-1 border-t border-line p-3">
          <NavLink to="/trash" className={navClass}><Trash2 size={18} /> Trash</NavLink>
          <NavLink to="/settings" className={navClass}><Settings size={18} /> Settings</NavLink>
          <div className="surface-card flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-gradient text-xs font-semibold text-white">{user?.name?.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user?.name}</p><p className="truncate text-xs text-muted">{user?.email}</p></div>
            <button type="button" onClick={() => { logout(); navigate('/'); }} aria-label="Log out" className="icon-action h-8 w-8"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>
    </>
  );
}
