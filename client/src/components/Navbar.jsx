import { Check, History, LoaderCircle, MessageSquare, Moon, Redo2, Save, Share2, Star, Sun, Trash2, Undo2 } from 'lucide-react';
import NotificationsPopover from './NotificationsPopover';
import useTheme from '../hooks/useTheme';

export default function Navbar({ title = 'Workspace', collaborators = [], onShare, onArchive, onSave, saveStatus = 'saved', starred = false, onToggleStar, onHistory, onUndo, onRedo, onComments }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center border-b border-line bg-canvas/72 px-4 pl-14 backdrop-blur-2xl md:px-7 md:pl-7">
      <div className="min-w-0 flex-1 truncate text-sm"><span className="hidden text-muted sm:inline">Workspace&nbsp; / &nbsp;</span><span className="font-semibold tracking-[-0.01em]">{title}</span></div>
      <div className="flex items-center gap-1 sm:gap-2">
        <div className="hidden -space-x-2 sm:flex">
          {collaborators.slice(0, 4).map((member) => (
            <div key={member.socketId || member._id} title={member.name} className="grid h-8 w-8 place-items-center rounded-full border-2 border-canvas bg-brand-gradient text-xs font-semibold text-white shadow-sm">{member.name?.slice(0, 1).toUpperCase()}</div>
          ))}
        </div>
        <span className="hidden h-6 w-px bg-line sm:block" />
        <NotificationsPopover />
        <button type="button" onClick={toggleTheme} className="icon-action h-9 w-9" aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
        {onComments && <button type="button" onClick={onComments} className="icon-action h-9 w-9" aria-label="Comments"><MessageSquare size={18} /></button>}
        {onUndo && <button type="button" onClick={onUndo} className="icon-action hidden h-9 w-9 sm:grid" aria-label="Undo"><Undo2 size={18} /></button>}
        {onRedo && <button type="button" onClick={onRedo} className="icon-action hidden h-9 w-9 sm:grid" aria-label="Redo"><Redo2 size={18} /></button>}
        {onHistory && <button type="button" onClick={onHistory} className="icon-action h-9 w-9" aria-label="Version history"><History size={18} /></button>}
        {onSave && <button type="button" onClick={onSave} disabled={saveStatus === 'saving'} className="secondary-action h-9 px-3 text-sm disabled:cursor-wait disabled:opacity-60" aria-label="Save note now">{saveStatus === 'saving' ? <LoaderCircle size={16} className="animate-spin" /> : saveStatus === 'saved' ? <Check size={16} className="text-emerald-500" /> : <Save size={16} />}<span className="hidden sm:inline">{saveStatus === 'saving' ? 'Saving…' : 'Save'}</span></button>}
        {onToggleStar && <button type="button" onClick={onToggleStar} className={`icon-action h-9 w-9 ${starred ? 'text-amber-500' : ''}`} aria-label={starred ? 'Remove from favorites' : 'Add to favorites'}><Star size={19} fill={starred ? 'currentColor' : 'none'} /></button>}
        {onArchive && <button onClick={onArchive} className="icon-action h-9 w-9 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300" aria-label="Move note to trash"><Trash2 size={19} /></button>}
        {onShare && <button type="button" onClick={onShare} className="primary-action h-9 px-3 text-sm"><Share2 size={16} /> <span className="hidden sm:inline">Share</span></button>}
      </div>
    </header>
  );
}
