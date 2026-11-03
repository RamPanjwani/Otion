import { FilePlus2, Home, Keyboard, LogOut, PanelLeft, Search, Settings, Star, Trash2 } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import BrandMark from './BrandMark';
import SearchCommand from './SearchCommand';
import ShortcutsModal from './ShortcutsModal';

const DEFAULT_NOTE_ICON = '📝';

export default function Sidebar({ notes = [], onCreated, onReordered }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('otion_sidebar_collapsed') === 'true');
  const [creating, setCreating] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [draggedNoteId, setDraggedNoteId] = useState('');
  const [dropTargetId, setDropTargetId] = useState('');
  const [reorderError, setReorderError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  useEffect(() => {
    document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
    localStorage.setItem('otion_sidebar_collapsed', String(collapsed));
  }, [collapsed]);

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

  const navClass = ({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition ${isActive ? 'bg-surface font-medium text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:bg-surface/70 hover:text-ink'}`;

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

  const sortedNotes = useMemo(() => {
    const favorites = [];
    const others = [];
    for (const note of notes) {
      if (note.isFavorite) favorites.push(note);
      else others.push(note);
    }
    return [...favorites, ...others];
  }, [notes]);

  const dropNote = (targetId) => {
    if (!draggedNoteId || draggedNoteId === targetId) {
      setDraggedNoteId('');
      setDropTargetId('');
      return;
    }
    const from = sortedNotes.findIndex((note) => String(note._id) === draggedNoteId);
    const to = sortedNotes.findIndex((note) => String(note._id) === String(targetId));
    if (from < 0 || to < 0) return;
    const ordered = [...sortedNotes];
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    const favorites = ordered.filter((n) => n.isFavorite);
    const others = ordered.filter((n) => !n.isFavorite);
    const finalOrdered = [...favorites, ...others];
    persistOrder(finalOrdered);
    setDraggedNoteId('');
    setDropTargetId('');
  };

  const showSearch = () => {
    setSearchOpen(true);
  };

  const closeSearch = () => setSearchOpen(false);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        showSearch();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
        event.preventDefault();
        setCollapsed((current) => !current);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault();
        setShortcutsOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    let startX = 0;
    let startY = 0;

    const handleTouchStart = (event) => {
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    };

    const handleTouchEnd = (event) => {
      const deltaX = event.changedTouches[0].clientX - startX;
      const deltaY = event.changedTouches[0].clientY - startY;

      if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (!open && startX < 35 && deltaX > 60) {
          setOpen(true);
        } else if (open && deltaX < -60) {
          setOpen(false);
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [open]);

  const renderNote = (note) => (
    <div
      key={note._id}
      draggable
      onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDraggedNoteId(String(note._id)); }}
      onDragEnd={() => { setDraggedNoteId(''); setDropTargetId(''); }}
      className={`group rounded-md transition ${draggedNoteId === String(note._id) ? 'opacity-50' : ''} ${dropTargetId === String(note._id) && draggedNoteId !== String(note._id) ? 'bg-accent-soft ring-1 ring-accent/40' : ''}`}
      onDragOver={(event) => { event.preventDefault(); setDropTargetId(String(note._id)); }}
      onDragLeave={() => setDropTargetId('')}
      onDrop={(event) => { event.preventDefault(); dropNote(String(note._id)); }}
    >
      <NavLink to={`/notes/${note._id}`} onClick={() => setOpen(false)} draggable={false} className={`${navClass({ isActive: ['/notes/', '/documents/'].some((prefix) => location.pathname === `${prefix}${note._id}`) })} w-full`}>
        <span className="w-6 text-center text-lg">{note.icon || DEFAULT_NOTE_ICON}</span>
        <span className="truncate flex-1">{note.title || 'Untitled note'}</span>
        {note.isFavorite && <Star size={16} className="ml-auto shrink-0 fill-amber-400 text-amber-400" />}
      </NavLink>
    </div>
  );

  return (
    <>
      {!open && <button type="button" className={`sidebar-open-button fixed left-3 top-2.5 z-40 grid h-9 w-9 place-items-center rounded-md ${collapsed ? 'md:grid' : 'md:hidden'}`} onClick={() => { if (window.matchMedia('(min-width: 768px)').matches) setCollapsed(false); else setOpen(true); }} aria-label="Open navigation"><PanelLeft size={19} /></button>}
      {open && <button className="fixed inset-0 z-30 bg-ink/20 md:hidden" onClick={() => setOpen(false)} aria-label="Close navigation overlay" />}
      <aside className={`workspace-sidebar fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-panel transition-[transform,width] md:translate-x-0 ${collapsed ? 'md:w-0 md:border-r-0' : 'md:w-60'} ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-2 px-4 py-4">
          <BrandMark compact className="min-w-0 flex-1" />
          <button type="button" className="icon-action h-8 w-8" onClick={() => { if (window.matchMedia('(min-width: 768px)').matches) setCollapsed((current) => !current); else setOpen(false); }} aria-label={collapsed ? 'Expand sidebar' : 'Toggle sidebar'}><PanelLeft size={18} /></button>
        </div>

        <nav className="space-y-1 px-3">
          <button type="button" onClick={showSearch} title="Search" className="sidebar-action"><Search size={17} /> <span>Search</span><kbd className="ml-auto rounded border border-line bg-surface/60 px-1.5 py-0.5 text-[9px] text-muted">Ctrl K</kbd></button>
          <button type="button" onClick={createNote} disabled={creating} title="New note" className="sidebar-action font-medium disabled:opacity-50"><FilePlus2 size={17} /> <span>{creating ? 'Creating…' : 'New note'}</span></button>
          <NavLink to="/dashboard" title="Home" className={navClass}><Home size={17} /> <span>Home</span></NavLink>
        </nav>

        <div className="otion-scrollbar mt-4 flex-1 overflow-y-auto px-3">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Notes</p>
          <div className="space-y-0.5">{sortedNotes.map((note) => renderNote(note))}</div>
          {reorderError && <p role="alert" className="mx-2 mt-3 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-200">{reorderError}</p>}
        </div>

        <div className="space-y-1 border-t border-line p-3">
          <button type="button" onClick={() => setShortcutsOpen(true)} title="Keyboard shortcuts" className={navClass({ isActive: false })}>
            <Keyboard size={17} /> <span>Shortcuts</span>
            <kbd className="ml-auto rounded border border-line bg-surface/60 px-1.5 py-0.5 text-[9px] text-muted">Ctrl /</kbd>
          </button>
          <NavLink to="/trash" title="Trash" className={navClass}><Trash2 size={17} /> <span>Trash</span></NavLink>
          <NavLink to="/settings" title="Settings" className={navClass}><Settings size={17} /> <span>Settings</span></NavLink>
          <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface/70">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-semibold text-surface">{user?.name?.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user?.name}</p><p className="truncate text-xs text-muted">{user?.email}</p></div>
            <button type="button" onClick={() => { logout(); navigate('/'); }} aria-label="Log out" className="icon-action h-8 w-8"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>
      <SearchCommand open={searchOpen} onClose={closeSearch} notes={notes} onNavigate={() => setOpen(false)} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
