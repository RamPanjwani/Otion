import { useState } from 'react';
import { ArchiveX, CheckSquare, RotateCcw, Square, Trash2, X } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Loading from '../components/Loading';
import Modal from '../components/Modal';
import PageTransition from '../components/PageTransition';
import useNotes from '../hooks/useNotes';
import useToast from '../hooks/useToast';
import useDocumentTitle from '../hooks/useDocumentTitle';
import api from '../services/api';

export default function Trash() {
  useDocumentTitle('Trash');
  const { notes: archived, setNotes: setArchived, loading, error } = useNotes({ archived: true });
  const { notes: active, setNotes: setActive } = useNotes();
  const toast = useToast();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmEmptyOpen, setConfirmEmptyOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const toggleSelected = (noteId) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(noteId)) next.delete(noteId);
    else next.add(noteId);
    return next;
  });

  const selectAll = () => {
    if (selectedIds.size === archived.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(archived.map((n) => n._id)));
    }
  };

  const closeSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const restoreOne = async (id) => {
    try {
      const { data } = await api.patch(`/notes/${id}/restore`);
      setArchived((items) => items.filter((note) => note._id !== id));
      setActive((items) => [data, ...items]);
      toast.success('Note restored');
    } catch {
      toast.error('Unable to restore note');
    }
  };

  const removeOne = async (id) => {
    try {
      await api.delete(`/notes/${id}`);
      setArchived((items) => items.filter((note) => note._id !== id));
      toast.success('Note permanently deleted');
    } catch {
      toast.error('Unable to delete note');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const emptyTrash = async () => {
    setActionBusy(true);
    try {
      await api.delete('/notes/trash/empty');
      setArchived([]);
      toast.success('Trash emptied permanently');
    } catch {
      toast.error('Unable to empty trash');
    } finally {
      setActionBusy(false);
      setConfirmEmptyOpen(false);
    }
  };

  const restoreAll = async () => {
    setActionBusy(true);
    try {
      await api.patch('/notes/trash/restore-all');
      setActive((items) => [...archived, ...items]);
      setArchived([]);
      toast.success('All notes restored');
    } catch {
      toast.error('Unable to restore notes');
    } finally {
      setActionBusy(false);
    }
  };

  const bulkRestore = async () => {
    const noteIds = [...selectedIds];
    if (!noteIds.length || actionBusy) return;
    setActionBusy(true);
    try {
      await api.patch('/notes/trash/restore-many', { noteIds });
      const restored = archived.filter((n) => selectedIds.has(n._id));
      setArchived((items) => items.filter((n) => !selectedIds.has(n._id)));
      setActive((items) => [...restored, ...items]);
      closeSelection();
      toast.success(`${noteIds.length} note${noteIds.length === 1 ? '' : 's'} restored`);
    } catch {
      toast.error('Unable to restore selected notes');
    } finally {
      setActionBusy(false);
    }
  };

  const bulkDelete = async () => {
    const noteIds = [...selectedIds];
    if (!noteIds.length || actionBusy) return;
    setActionBusy(true);
    try {
      await api.delete('/notes/trash/delete-many', { data: { noteIds } });
      setArchived((items) => items.filter((n) => !selectedIds.has(n._id)));
      closeSelection();
      toast.success(`${noteIds.length} note${noteIds.length === 1 ? '' : 's'} permanently deleted`);
    } catch {
      toast.error('Unable to delete selected notes');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="app-shell relative min-h-screen bg-canvas">
      <Sidebar notes={active} onCreated={(note) => setActive((items) => [note, ...items.filter((item) => item._id !== note._id)])} onReordered={setActive} />
      <Navbar title="Trash" />
      <PageTransition as="main" className="mx-auto max-w-4xl px-6 py-12 sm:px-10 sm:py-16">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-[-0.04em]">Trash</h1>
            <p className="mt-2 text-sm text-muted">Restore notes or delete them permanently.</p>
          </div>
          {archived.length > 0 && !selectionMode && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectionMode(true)}
                className="secondary-action px-3 py-2 text-xs"
              >
                <CheckSquare size={15} /> Select
              </button>
              <button
                type="button"
                onClick={restoreAll}
                disabled={actionBusy}
                className="secondary-action px-3 py-2 text-xs"
              >
                <RotateCcw size={15} /> Restore all
              </button>
              <button
                type="button"
                onClick={() => setConfirmEmptyOpen(true)}
                disabled={actionBusy}
                className="danger-action-subtle px-3 py-2 text-xs"
              >
                <Trash2 size={15} /> Empty trash
              </button>
            </div>
          )}
          {selectionMode && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="secondary-action px-3 py-2 text-xs"
              >
                {selectedIds.size === archived.length ? 'Deselect all' : 'Select all'}
              </button>
              <button
                type="button"
                onClick={bulkRestore}
                disabled={!selectedIds.size || actionBusy}
                className="secondary-action px-3 py-2 text-xs disabled:opacity-50"
              >
                <RotateCcw size={15} /> Restore ({selectedIds.size})
              </button>
              <button
                type="button"
                onClick={bulkDelete}
                disabled={!selectedIds.size || actionBusy}
                className="danger-action px-3 py-2 text-xs disabled:opacity-40"
              >
                <Trash2 size={15} /> Delete permanently ({selectedIds.size})
              </button>
              <button
                type="button"
                onClick={closeSelection}
                className="icon-action h-8 w-8"
                aria-label="Cancel selection"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="mt-8">
          {loading ? (
            <Loading />
          ) : error ? (
            <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
          ) : archived.length ? (
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              {archived.map((note) => (
                <div
                  key={note._id}
                  onClick={() => selectionMode && toggleSelected(note._id)}
                  className={`flex items-center gap-4 border-b border-line p-4 transition last:border-b-0 ${selectionMode ? 'cursor-pointer hover:bg-panel/40' : 'hover:bg-panel/30'} ${selectedIds.has(note._id) ? 'bg-accent-soft/60' : ''}`}
                >
                  {selectionMode && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleSelected(note._id); }}
                      className="shrink-0"
                    >
                      {selectedIds.has(note._id) ? (
                        <CheckSquare size={18} className="text-accent" />
                      ) : (
                        <Square size={18} className="text-muted" />
                      )}
                    </button>
                  )}
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-panel text-2xl">
                    {note.icon || '📝'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{note.title || 'Untitled note'}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      Archived {new Date(note.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {!selectionMode && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => restoreOne(note._id)}
                        className="secondary-action px-3 py-1.5 text-xs"
                      >
                        <RotateCcw size={14} />
                        <span className="hidden sm:inline">Restore</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(note._id)}
                        className="icon-action h-8 w-8 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        aria-label={`Delete ${note.title || 'note'} permanently`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-panel text-muted">
                <ArchiveX size={23} />
              </span>
              <h2 className="mt-4 text-base font-semibold">Trash is empty</h2>
              <p className="mt-2 text-sm text-muted">
                Deleted notes will appear here until you restore or permanently delete them.
              </p>
            </div>
          )}
        </div>
      </PageTransition>

      <Modal
        open={confirmEmptyOpen}
        onClose={() => setConfirmEmptyOpen(false)}
        title="Empty Trash"
      >
        <div className="space-y-4 p-6">
          <p className="text-sm text-muted">
            Are you sure you want to permanently delete all {archived.length} notes in your trash? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setConfirmEmptyOpen(false)}
              className="secondary-action px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={emptyTrash}
              disabled={actionBusy}
              className="danger-action px-4 py-2 text-sm disabled:opacity-50"
            >
              <Trash2 size={16} /> Empty permanently
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmDeleteId)}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete note permanently"
      >
        <div className="space-y-4 p-6">
          <p className="text-sm text-muted">
            Are you sure you want to permanently delete this note? All content and revision history will be removed permanently.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              className="secondary-action px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => removeOne(confirmDeleteId)}
              className="danger-action px-4 py-2 text-sm"
            >
              <Trash2 size={16} /> Delete permanently
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
