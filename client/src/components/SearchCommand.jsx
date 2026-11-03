import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, Clock3, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const DEFAULT_NOTE_ICON = '📝';

export default function SearchCommand({ open, onClose, notes = [], onNavigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const displayed = useMemo(() => {
    if (!query.trim()) return notes.slice(0, 8);
    return results;
  }, [notes, query, results]);

  useEffect(() => {
    if (!open) return undefined;
    window.requestAnimationFrame(() => inputRef.current?.focus());
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open || !query.trim()) return undefined;
    let active = true;
    const timeout = window.setTimeout(() => {
      api.get('/search', { params: { q: query.trim() } })
        .then(({ data }) => {
          if (!active) return;
          setResults(data);
          setActiveIndex(0);
        })
        .catch(() => { if (active) setResults([]); })
        .finally(() => { if (active) setLoading(false); });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [open, query]);

  const closeCommand = () => {
    setQuery('');
    setResults([]);
    setLoading(false);
    setActiveIndex(0);
    onClose();
  };

  const changeQuery = (value) => {
    setQuery(value);
    setActiveIndex(0);
    setLoading(Boolean(value.trim()));
    if (!value.trim()) setResults([]);
  };

  const openNote = (note) => {
    if (!note) return;
    navigate(`/notes/${note._id}`);
    onNavigate?.();
    closeCommand();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCommand();
    }
    if (event.key === 'ArrowDown' && displayed.length) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % displayed.length);
    }
    if (event.key === 'ArrowUp' && displayed.length) {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + displayed.length) % displayed.length);
    }
    if (event.key === 'Enter' && displayed[activeIndex]) {
      event.preventDefault();
      openNote(displayed[activeIndex]);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          className="fixed inset-0 z-[80] flex items-start justify-center bg-zinc-950/30 px-3 pt-[12vh] backdrop-blur-[2px]"
          onMouseDown={closeCommand}
        >
          <motion.section
            initial={{ opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Search notes"
            className="command-panel w-full max-w-xl overflow-hidden rounded-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={19} className="shrink-0 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => changeQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search notes and content…"
                className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
              />
              {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink" aria-label="Searching" /> : <button type="button" onClick={closeCommand} className="icon-action h-8 w-8" aria-label="Close search"><X size={16} /></button>}
            </div>

            <div className="otion-scrollbar max-h-[min(420px,60vh)] overflow-y-auto p-2">
              <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                {query.trim() ? 'Search results' : 'Recently updated'}
              </p>
              {displayed.length ? displayed.map((note, index) => (
                <button
                  key={note._id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => openNote(note)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${index === activeIndex ? 'bg-panel text-ink' : 'text-muted hover:bg-panel hover:text-ink'}`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface text-xl ring-1 ring-line">{note.icon || DEFAULT_NOTE_ICON}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{note.title || 'Untitled note'}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-muted"><Clock3 size={11} /> Updated {new Date(note.updatedAt).toLocaleDateString()}</span>
                  </span>
                  <ArrowUpRight size={15} className="shrink-0 opacity-45" />
                </button>
              )) : (
                <div className="px-4 py-12 text-center">
                  <p className="text-sm font-medium">No notes found</p>
                  <p className="mt-1 text-xs text-muted">Try a different title or phrase.</p>
                </div>
              )}
            </div>
            <footer className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-muted">
              <span><kbd className="command-key">↑</kbd><kbd className="command-key">↓</kbd> Navigate</span>
              <span><kbd className="command-key">↵</kbd> Open</span>
              <span className="ml-auto"><kbd className="command-key">Esc</kbd> Close</span>
            </footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
