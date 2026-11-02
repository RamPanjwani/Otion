import { FilePlus2, Folder, LogOut, Menu, Search, Trash2, X } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import useAuth from '../hooks/useAuth';

export default function Sidebar({ notes = [], onCreated }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchInputRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const createNote = async () => {
    setCreating(true);
    try {
      const { data } = await api.post('/notes', { title: 'Untitled' });
      onCreated?.(data);
      setOpen(false);
      navigate(`/documents/${data._id}`);
    } finally {
      setCreating(false);
    }
  };

  const navClass = ({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${isActive ? 'bg-line font-semibold' : 'hover:bg-panel'}`;
  const filteredNotes = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return notes;
    return notes.filter((note) => {
      const blockText = Array.isArray(note.content) ? note.content.map((block) => block.text || '').join(' ') : '';
      return `${note.title || ''} ${blockText}`.toLocaleLowerCase().includes(needle);
    });
  }, [notes, query]);

  const showSearch = () => {
    setSearchOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const closeSearch = () => {
    setQuery('');
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

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Escape') closeSearch();
    if (event.key === 'Enter' && filteredNotes[0]) {
      navigate(`/documents/${filteredNotes[0]._id}`);
      setOpen(false);
      closeSearch();
    }
  };

  return (
    <>
      <button type="button" className="fixed left-3 top-3 z-40 rounded-xl border border-line bg-white p-2 md:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
      {open && <button className="fixed inset-0 z-30 bg-ink/20 md:hidden" onClick={() => setOpen(false)} aria-label="Close navigation overlay" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-canvas transition-transform md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white">O</div>
          <div className="min-w-0 flex-1"><p className="truncate font-semibold">Otion Workspace</p><p className="truncate text-xs text-muted">Collaborative Space</p></div>
          <button className="md:hidden" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>

        <nav className="space-y-1 px-3">
          {searchOpen ? <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2"><Search size={17} className="shrink-0 text-muted" /><input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handleSearchKeyDown} placeholder="Search notes…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Search notes" /><button type="button" onClick={closeSearch} className="text-muted hover:text-ink" aria-label="Close search"><X size={16} /></button></div> : <button type="button" onClick={showSearch} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-panel"><Search size={18} /> Search <kbd className="ml-auto text-[10px] text-muted">⌘K</kbd></button>}
          <button type="button" onClick={createNote} disabled={creating} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-panel disabled:opacity-50"><FilePlus2 size={18} /> {creating ? 'Creating…' : 'New Page'}</button>
          <NavLink to="/dashboard" className={navClass}><Folder size={18} /> Workspace</NavLink>
        </nav>

        <div className="otion-scrollbar mt-3 flex-1 overflow-y-auto px-3">
          {filteredNotes.map((note) => (
            <NavLink key={note._id} to={`/documents/${note._id}`} onClick={() => { setOpen(false); if (searchOpen) closeSearch(); }} className={navClass}>
              <span className="w-5 text-center">{note.icon || '◇'}</span><span className="truncate">{note.title || 'Untitled'}</span>
            </NavLink>
          ))}
          {searchOpen && query.trim() && filteredNotes.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted">No matching notes</p>}
        </div>

        <div className="space-y-1 border-t border-line p-3">
          <NavLink to="/trash" className={navClass}><Trash2 size={18} /> Trash</NavLink>
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-semibold text-white">{user?.name?.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user?.name}</p><p className="truncate text-xs text-muted">{user?.email}</p></div>
            <button type="button" onClick={() => { logout(); navigate('/'); }} aria-label="Log out" className="rounded-xl p-2 hover:bg-panel"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>
    </>
  );
}
