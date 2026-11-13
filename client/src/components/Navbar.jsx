import { Check, History, LoaderCircle, MessageSquare, Moon, MoreHorizontal, Redo2, Save, Share2, Star, Sun, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import NotificationsPopover from './NotificationsPopover';
import NoteViewMenu from './NoteViewMenu';
import EmailVerificationBanner from './EmailVerificationBanner';
import useTheme from '../hooks/useTheme';

export default function Navbar({ title = 'Workspace', collaborators = [], onShare, onArchive, onSave, saveStatus = 'saved', starred = false, onToggleStar, onHistory, onUndo, onRedo, onComments, viewOptions }) {
  const { theme, toggleTheme } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  useEffect(() => {
    if (!moreOpen) return undefined;
    const close = (event) => { if (!moreRef.current?.contains(event.target)) setMoreOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [moreOpen]);

  const statusLabel = saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : saveStatus === 'unsaved' ? 'Unsaved' : 'Saved';
  return (
    <>
      <header className="workspace-navbar sticky top-0 z-20 flex h-14 shrink-0 items-center border-b border-line bg-canvas/92 px-3 pl-14 backdrop-blur-xl md:px-4 md:pl-4">
        <div className="flex min-w-0 flex-1 items-center gap-2"><div className="truncate text-sm font-medium tracking-[-0.01em]">{title}</div>{onSave && <span className={`hidden text-[11px] sm:inline ${saveStatus === 'error' ? 'text-red-600' : 'text-muted'}`}>{statusLabel}</span>}</div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <div className="hidden -space-x-2 sm:flex">
            {collaborators.slice(0, 4).map((member) => (
              <div key={member.socketId || member._id} title={member.name} className="grid h-8 w-8 place-items-center rounded-full border-2 border-canvas bg-ink text-xs font-semibold text-surface shadow-sm">{member.name?.slice(0, 1).toUpperCase()}</div>
            ))}
          </div>
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <NotificationsPopover />
          {viewOptions && <NoteViewMenu {...viewOptions} />}
          <button type="button" onClick={toggleTheme} className={`icon-action h-9 w-9 ${onSave ? 'hidden sm:grid' : ''}`} aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
          {onComments && <button type="button" onClick={onComments} className="icon-action hidden h-9 w-9 md:grid" aria-label="Comments" title="Comments"><MessageSquare size={18} /></button>}
          {onUndo && <button type="button" onClick={onUndo} className="icon-action hidden h-9 w-9 lg:grid" aria-label="Undo" title="Undo"><Undo2 size={18} /></button>}
          {onRedo && <button type="button" onClick={onRedo} className="icon-action hidden h-9 w-9 lg:grid" aria-label="Redo" title="Redo"><Redo2 size={18} /></button>}
          {onHistory && <button type="button" onClick={onHistory} className="icon-action hidden h-9 w-9 md:grid" aria-label="Version history" title="Version history"><History size={18} /></button>}
          {onSave && <button type="button" onClick={onSave} disabled={saveStatus === 'saving'} className="secondary-action h-9 px-3 text-sm disabled:cursor-wait disabled:opacity-60" aria-label="Save note now" title="Save now (Ctrl+S)">{saveStatus === 'saving' ? <LoaderCircle size={16} className="animate-spin" /> : saveStatus === 'saved' ? <Check size={16} className="text-emerald-500" /> : <Save size={16} />}<span className="hidden sm:inline">{saveStatus === 'saving' ? 'Saving…' : 'Save'}</span></button>}
          {onToggleStar && <button type="button" onClick={onToggleStar} className={`icon-action hidden h-9 w-9 sm:grid ${starred ? 'text-amber-500' : ''}`} aria-label={starred ? 'Remove from favorites' : 'Add to favorites'}><Star size={19} fill={starred ? 'currentColor' : 'none'} /></button>}
          {onArchive && <button onClick={onArchive} className="icon-action hidden h-9 w-9 hover:bg-red-50 hover:text-red-600 md:grid dark:hover:bg-red-950/40 dark:hover:text-red-400" aria-label="Move note to trash" title="Move to trash"><Trash2 size={18} /></button>}
          {onShare && <button type="button" onClick={onShare} className="primary-action h-9 px-3 text-sm"><Share2 size={16} /> <span className="hidden sm:inline">Share</span></button>}
          {(onComments || onHistory || onUndo || onRedo || onArchive || onToggleStar) && <div ref={moreRef} className="relative md:hidden"><button type="button" onClick={() => setMoreOpen((current) => !current)} className="icon-action h-9 w-9" aria-label="More note actions" aria-expanded={moreOpen}><MoreHorizontal size={19} /></button>{moreOpen && <div className="elevated-panel absolute right-0 top-10 z-50 w-52 rounded-lg p-1.5"><MobileAction icon={MessageSquare} label="Comments" onClick={onComments} close={() => setMoreOpen(false)} /><MobileAction icon={History} label="Version history" onClick={onHistory} close={() => setMoreOpen(false)} /><MobileAction icon={Undo2} label="Undo" onClick={onUndo} close={() => setMoreOpen(false)} /><MobileAction icon={Redo2} label="Redo" onClick={onRedo} close={() => setMoreOpen(false)} /><MobileAction icon={Star} label={starred ? 'Remove favorite' : 'Add to favorites'} onClick={onToggleStar} close={() => setMoreOpen(false)} compactOnly /><MobileAction icon={theme === 'dark' ? Sun : Moon} label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'} onClick={toggleTheme} close={() => setMoreOpen(false)} compactOnly /><MobileAction icon={Trash2} label="Move to trash" onClick={onArchive} close={() => setMoreOpen(false)} destructive /></div>}</div>}
        </div>
      </header>
      <EmailVerificationBanner />
    </>
  );
}

function MobileAction({ icon: Icon, label, onClick, close, destructive = false, compactOnly = false }) {
  if (!onClick) return null;
  return <button type="button" onClick={() => { onClick(); close(); }} className={`w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition hover:bg-panel ${compactOnly ? 'flex sm:hidden' : 'flex'} ${destructive ? 'text-red-600 dark:text-red-400' : 'text-ink'}`}><Icon size={16} />{label}</button>;
}
