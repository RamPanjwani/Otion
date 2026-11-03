import { useEffect, useRef, useState } from 'react';
import { Copy, FileDown, FileUp, LoaderCircle, Maximize2, Printer, Settings2, Type } from 'lucide-react';

export default function NoteViewMenu({
  settings,
  onChange,
  onDuplicate,
  onExportMarkdown,
  onExportPdf,
  onImportMarkdown,
  stats,
}) {
  const [open, setOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const rootRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const duplicate = async () => {
    if (!onDuplicate || duplicating) return;
    setDuplicating(true);
    try {
      const completed = await onDuplicate();
      if (completed !== false) setOpen(false);
    } finally {
      setDuplicating(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportMarkdown?.(file);
      setOpen(false);
    }
    event.target.value = '';
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="icon-action h-9 w-9"
        aria-label="Note view options"
        aria-expanded={open}
        title="Note view options"
      >
        <Settings2 size={18} />
      </button>
      {open && (
        <div className="elevated-panel absolute right-0 top-11 z-50 w-[min(300px,calc(100vw-1.5rem))] rounded-xl p-2">
          <div className="px-2 pb-2 pt-1">
            <p className="text-sm font-semibold">Customize note</p>
            <p className="mt-0.5 text-xs text-muted">These view settings stay on this device.</p>
          </div>
          <div className="space-y-0.5 border-y border-line py-1.5">
            <ViewToggle icon={Type} label="Small text" checked={settings.smallText} onClick={() => onChange('smallText', !settings.smallText)} />
            <ViewToggle icon={Maximize2} label="Full width" checked={settings.fullWidth} onClick={() => onChange('fullWidth', !settings.fullWidth)} />
          </div>
          <div className="space-y-0.5 border-b border-line py-1.5">
            <MenuAction
              icon={duplicating ? LoaderCircle : Copy}
              label={duplicating ? 'Duplicating…' : 'Duplicate note'}
              onClick={duplicate}
              disabled={!onDuplicate || duplicating}
              spin={duplicating}
            />
            {onExportMarkdown && (
              <MenuAction
                icon={FileDown}
                label="Export as Markdown (.md)"
                onClick={() => { onExportMarkdown(); setOpen(false); }}
              />
            )}
            {onExportPdf && (
              <MenuAction
                icon={Printer}
                label="Export / Print as PDF"
                onClick={() => { onExportPdf(); setOpen(false); }}
              />
            )}
            {onImportMarkdown && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.markdown,text/markdown,text/plain"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <MenuAction
                  icon={FileUp}
                  label="Import Markdown (.md)"
                  onClick={() => fileInputRef.current?.click()}
                />
              </>
            )}
          </div>
          <div className="flex items-center justify-between px-2 pt-2 text-[11px] text-muted">
            <span>{stats.words.toLocaleString()} words</span>
            <span>{stats.characters.toLocaleString()} characters</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ViewToggle({ icon: Icon, label, checked, onClick }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-panel">
      <Icon size={16} className="text-muted" /><span className="flex-1">{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-ink' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function MenuAction({ icon: Icon, label, onClick, disabled = false, spin = false }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-panel disabled:cursor-wait disabled:opacity-50">
      <Icon size={16} className={`text-muted ${spin ? 'animate-spin' : ''}`} />
      <span className="flex-1">{label}</span>
    </button>
  );
}
