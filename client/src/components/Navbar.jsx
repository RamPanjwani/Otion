import { Archive, Check, LoaderCircle, Save, Share2, Star } from 'lucide-react';

export default function Navbar({ title = 'Workspace', collaborators = [], onShare, onArchive, onSave, saveStatus = 'saved', starred = false, onToggleStar }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center border-b border-line bg-canvas/95 px-4 pl-14 backdrop-blur md:px-7 md:pl-7">
      <div className="min-w-0 flex-1 truncate text-sm"><span className="text-muted">Otion / Workspace / </span><span className="font-semibold">{title}</span></div>
      <div className="flex items-center gap-3">
        <div className="hidden -space-x-2 sm:flex">
          {collaborators.slice(0, 4).map((member) => (
            <div key={member.socketId || member._id} title={member.name} className="grid h-8 w-8 place-items-center rounded-full border-2 border-canvas bg-ink text-xs font-semibold text-white">{member.name?.slice(0, 1).toUpperCase()}</div>
          ))}
        </div>
        <span className="hidden h-6 w-px bg-line sm:block" />
        {onSave && <button type="button" onClick={onSave} disabled={saveStatus === 'saving'} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold hover:bg-panel disabled:cursor-wait disabled:opacity-60" aria-label="Save document now">{saveStatus === 'saving' ? <LoaderCircle size={16} className="animate-spin" /> : saveStatus === 'saved' ? <Check size={16} /> : <Save size={16} />}<span className="hidden sm:inline">{saveStatus === 'saving' ? 'Saving…' : 'Save'}</span></button>}
        {onToggleStar && <button type="button" onClick={onToggleStar} className={`rounded-xl p-2 hover:bg-panel ${starred ? 'text-amber-500' : ''}`} aria-label={starred ? 'Remove from favorites' : 'Add to favorites'}><Star size={19} fill={starred ? 'currentColor' : 'none'} /></button>}
        {onArchive && <button onClick={onArchive} className="rounded-xl p-2 hover:bg-panel" aria-label="Move to trash"><Archive size={19} /></button>}
        {onShare && <button type="button" onClick={onShare} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black"><Share2 size={16} /> <span className="hidden sm:inline">Share</span></button>}
      </div>
    </header>
  );
}
