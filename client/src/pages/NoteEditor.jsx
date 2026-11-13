import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MousePointer2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Editor from '../components/Editor';
import Loading from '../components/Loading';
import ShareModal from '../components/ShareModal';
import VersionHistoryModal from '../components/VersionHistoryModal';
import CommentsModal from '../components/CommentsModal';
import PageStyleModal from '../components/PageStyleModal';
import useAuth from '../hooks/useAuth';
import useNotes from '../hooks/useNotes';
import useDebouncedEffect from '../hooks/useDebouncedEffect';
import useCollaborativeNote from '../hooks/useCollaborativeNote';
import api from '../services/api';
import { connectSocket, socket } from '../services/socket';
import { getNoteStats } from '../utils/noteContent';
import useToast from '../hooks/useToast';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { blocksToMarkdown, downloadMarkdownFile, markdownToBlocks } from '../utils/markdown';

const DEFAULT_VIEW_SETTINGS = { smallText: false, fullWidth: false };

export default function NoteEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const { notes, setNotes } = useNotes();
  const [note, setNote] = useState(null);
  const [error, setError] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [styleDraft, setStyleDraft] = useState({ icon: '📝' });
  const [presence, setPresence] = useState([]);
  const [cursors, setCursors] = useState({});
  const [remoteSelections, setRemoteSelections] = useState({});
  const [saveStatus, setSaveStatus] = useState('saved');
  const [actionError, setActionError] = useState('');
  const [viewSettings, setViewSettings] = useState(readViewSettings);
  const dirtyRef = useRef(false);
  const editVersionRef = useRef(0);
  const lastPointerRef = useRef(0);
  const articleRef = useRef(null);
  const navigate = useNavigate();
  const noteStats = useMemo(() => getNoteStats(note?.content), [note?.content]);
  useDocumentTitle(note?.title || 'Untitled note');

  const collaborative = useCollaborativeNote(id, Boolean(note?._id === id && user), useCallback((content, metadata) => {
    if (metadata?.local) {
      dirtyRef.current = true;
      editVersionRef.current += 1;
      setSaveStatus('unsaved');
    }
    setNote((current) => current ? { ...current, content } : current);
    setNotes((current) => current.map((item) => item._id === id ? { ...item, content } : item));
  }, [id, setNotes]));

  useEffect(() => {
    let active = true;
    api.get(`/notes/${id}`).then(({ data }) => {
      if (!active) return;
      const lastOpenedAt = new Date().toISOString();
      setNote(data);
      setNotes((current) => current.map((item) => item._id === id ? { ...item, lastOpenedAt } : item));
      setError('');
      setActionError('');
    }).catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to open note'); });
    return () => { active = false; };
  }, [id, setNotes]);

  useEffect(() => {
    localStorage.setItem('otion_note_view_settings', JSON.stringify(viewSettings));
  }, [viewSettings]);

  const loadedNoteId = note?._id;
  useEffect(() => {
    if (!loadedNoteId || !user) return undefined;
    const joinNote = () => socket.emit('join-note', { noteId: id });
    connectSocket();
    if (socket.connected) joinNote();
    const documentSaved = ({ document }) => {
      setNote((current) => current ? { ...current, updatedAt: document.updatedAt || current.updatedAt } : current);
      setNotes((current) => current.map((item) => item._id === id ? { ...item, updatedAt: document.updatedAt || item.updatedAt } : item));
      if (!dirtyRef.current) {
        setSaveStatus('saved');
      }
    };
    const updatePresence = (members) => {
      setPresence(members);
      const activeIds = new Set(members.map((member) => member.socketId));
      setCursors((current) => Object.fromEntries(Object.entries(current).filter(([socketId]) => activeIds.has(socketId))));
      setRemoteSelections((current) => Object.fromEntries(Object.entries(current).filter(([socketId]) => activeIds.has(socketId))));
    };
    const cursorMove = ({ socketId, user: cursorUser, position }) => setCursors((current) => ({ ...current, [socketId]: { user: cursorUser, position } }));
    const selectionChange = ({ socketId, user: selectionUser, selection }) => setRemoteSelections((current) => selection ? { ...current, [socketId]: { user: selectionUser, selection } } : Object.fromEntries(Object.entries(current).filter(([key]) => key !== socketId)));
    const permissionChanged = ({ role }) => setNote((current) => current ? { ...current, accessRole: role } : current);
    const accessRevoked = () => {
      dirtyRef.current = false;
      setNote(null);
      navigate('/dashboard', { replace: true });
    };
    socket.on('connect', joinNote);
    socket.on('document-saved', documentSaved);
    socket.on('presence-update', updatePresence);
    socket.on('cursor-move', cursorMove);
    socket.on('selection-change', selectionChange);
    socket.on('permission-changed', permissionChanged);
    socket.on('access-revoked', accessRevoked);
    return () => {
      socket.emit('leave-note', { noteId: id });
      socket.off('connect', joinNote);
      socket.off('document-saved', documentSaved);
      socket.off('presence-update', updatePresence);
      socket.off('cursor-move', cursorMove);
      socket.off('selection-change', selectionChange);
      socket.off('permission-changed', permissionChanged);
      socket.off('access-revoked', accessRevoked);
    };
  }, [id, loadedNoteId, navigate, setNotes, user]);

  useEffect(() => {
    if (!loadedNoteId) return undefined;
    let animationFrame;
    const sendSelection = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        socket.emit('selection-change', { noteId: id, selection: serializeSelection(articleRef.current) });
      });
    };
    document.addEventListener('selectionchange', sendSelection);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('selectionchange', sendSelection);
      socket.emit('selection-change', { noteId: id, selection: null });
    };
  }, [id, loadedNoteId]);

  useEffect(() => {
    if (!window.CSS?.highlights || !window.Highlight) return undefined;
    let highlightStyle = document.getElementById('otion-remote-selection-style');
    if (!highlightStyle) {
      highlightStyle = document.createElement('style');
      highlightStyle.id = 'otion-remote-selection-style';
      highlightStyle.textContent = '::highlight(remote-selection){background-color:rgb(99 102 241 / 28%);color:inherit;}';
      document.head.appendChild(highlightStyle);
    }
    const ranges = Object.values(remoteSelections)
      .map(({ selection }) => selectionToRange(selection))
      .filter(Boolean);
    window.CSS.highlights.set('remote-selection', new window.Highlight(...ranges));
    return () => window.CSS.highlights.delete('remote-selection');
  }, [remoteSelections, note?.content]);

  useDebouncedEffect(() => {
    if (!note || !dirtyRef.current || !['owner', 'editor'].includes(note.accessRole)) return;
    const versionToSave = editVersionRef.current;
    setSaveStatus('saving');
    api.put(`/notes/${id}`, { title: note.title, content: note.content, icon: note.icon || '📝', saveReason: 'autosave' }).then(({ data }) => {
      setNote((current) => current ? { ...current, updatedAt: data?.updatedAt || current.updatedAt } : current);
      if (editVersionRef.current === versionToSave) {
        dirtyRef.current = false;
        setSaveStatus('saved');
      } else {
        dirtyRef.current = true;
        setSaveStatus('unsaved');
      }
    }).catch((requestError) => {
      if ([403, 404].includes(requestError.response?.status)) {
        dirtyRef.current = false;
        navigate('/dashboard', { replace: true });
      } else {
        dirtyRef.current = true;
        setSaveStatus('error');
      }
    });
  }, [note?.title, note?.content, note?.icon, id], 750);

  const updateNote = useCallback((patch) => {
    dirtyRef.current = true;
    editVersionRef.current += 1;
    setSaveStatus('unsaved');
    setNote((current) => ({ ...current, ...patch }));
    setNotes((current) => current.map((item) => item._id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
    if (patch.content) collaborative.updateBlocks(patch.content);
  }, [collaborative, id, setNotes]);

  const handlePointerMove = (event) => {
    const article = articleRef.current;
    if (!article || !socket.connected) return;
    const now = Date.now();
    if (now - lastPointerRef.current < 50) return;
    lastPointerRef.current = now;
    const bounds = article.getBoundingClientRect();
    socket.emit('cursor-move', {
      noteId: id,
      position: {
        xRatio: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
        yRatio: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
      },
    });
  };

  const openNoteStyle = () => {
    setStyleDraft({ icon: note.icon || '📝' });
    setStyleOpen(true);
  };
  const archive = async () => { await api.patch(`/notes/${id}/archive`); navigate('/dashboard'); };
  const toggleStar = async () => {
    if (!note) return;
    const isFavorite = !note.isFavorite;
    setNote((current) => ({ ...current, isFavorite }));
    setNotes((current) => current.map((item) => item._id === id ? { ...item, isFavorite } : item));
    try {
      await api.patch(`/notes/${id}/preferences`, { favorite: isFavorite });
    } catch {
      setNote((current) => ({ ...current, isFavorite: !isFavorite }));
      setNotes((current) => current.map((item) => item._id === id ? { ...item, isFavorite: !isFavorite } : item));
    }
  };
  const saveImmediately = useCallback(async () => {
    if (!note || !['owner', 'editor'].includes(note.accessRole) || saveStatus === 'saving') return;
    const versionToSave = editVersionRef.current;
    setSaveStatus('saving');
    try {
      const payload = { title: note.title, content: note.content, icon: note.icon || '📝', saveReason: 'manual' };
      const { data } = await api.put(`/notes/${id}`, payload);
      setNote((current) => current ? { ...current, updatedAt: data?.updatedAt || current.updatedAt } : current);
      if (editVersionRef.current === versionToSave) {
        dirtyRef.current = false;
        setSaveStatus('saved');
      } else {
        dirtyRef.current = true;
        setSaveStatus('unsaved');
      }
    } catch (requestError) {
      if ([403, 404].includes(requestError.response?.status)) navigate('/dashboard', { replace: true });
      else setSaveStatus('error');
    }
  }, [id, navigate, note, saveStatus]);

  useEffect(() => {
    const handleSaveShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveImmediately();
      }
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [saveImmediately]);

  const duplicateNote = async () => {
    if (!note) return false;
    setActionError('');
    try {
      const { data } = await api.post('/notes', {
        title: `${note.title?.trim() || 'Untitled note'} (Copy)`,
        icon: note.icon || '📝',
        content: note.content || [],
      });
      setNotes((current) => [data, ...current.filter((item) => item._id !== data._id)]);
      navigate(`/notes/${data._id}`);
      return true;
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || 'Unable to duplicate this note');
      return false;
    }
  };

  const updateViewSetting = (key, value) => setViewSettings((current) => ({ ...current, [key]: value }));
  const toast = useToast();

  const handleExportMarkdown = () => {
    if (!note) return;
    const md = blocksToMarkdown(note.title, note.content || []);
    downloadMarkdownFile(note.title || 'Untitled note', md);
    toast.success('Markdown exported');
  };

  const handleExportPdf = () => {
    window.print();
  };

  const handleImportMarkdown = async (file) => {
    try {
      const text = await file.text();
      const parsedBlocks = markdownToBlocks(text);
      updateNote({ content: parsedBlocks });
      toast.success(`Imported ${file.name}`);
    } catch {
      toast.error('Unable to import markdown file');
    }
  };

  return (
    <div className="app-shell relative flex h-dvh flex-col overflow-hidden bg-canvas">
      <Sidebar notes={notes} onCreated={(created) => setNotes((current) => [created, ...current.filter((item) => item._id !== created._id)])} onReordered={setNotes} />
      <Navbar
        title={note?.title || 'Note'}
        collaborators={presence}
        onShare={note?.accessRole === 'owner' ? () => setShareOpen(true) : undefined}
        onArchive={note?.accessRole === 'owner' ? archive : undefined}
        onSave={['owner', 'editor'].includes(note?.accessRole) ? saveImmediately : undefined}
        saveStatus={saveStatus}
        starred={Boolean(note?.isFavorite)}
        onToggleStar={toggleStar}
        onHistory={() => setHistoryOpen(true)}
        onUndo={['owner', 'editor'].includes(note?.accessRole) ? collaborative.undo : undefined}
        onRedo={['owner', 'editor'].includes(note?.accessRole) ? collaborative.redo : undefined}
        onComments={() => setCommentsOpen(true)}
        viewOptions={{
          settings: viewSettings,
          onChange: updateViewSetting,
          onDuplicate: duplicateNote,
          onExportMarkdown: handleExportMarkdown,
          onExportPdf: handleExportPdf,
          onImportMarkdown: ['owner', 'editor'].includes(note?.accessRole) ? handleImportMarkdown : undefined,
          stats: noteStats,
        }}
      />
      {error ? <div className="otion-page-scroll mx-auto w-full max-w-2xl flex-1 min-h-0 p-10 text-red-700">{error}</div> : !note || note._id !== id ? <div className="flex flex-1 items-center justify-center"><Loading /></div> : note && <main className="otion-page-scroll relative min-h-0 flex-1">
        <article ref={articleRef} onPointerMove={handlePointerMove} className={`note-canvas relative mx-auto min-h-full px-6 pb-12 pt-10 transition-[max-width,padding] sm:px-12 sm:pt-16 lg:px-16 ${viewSettings.fullWidth ? 'max-w-[1440px]' : 'max-w-[920px]'}`}>
          <button onClick={['owner', 'editor'].includes(note.accessRole) ? openNoteStyle : undefined} className="mb-3 rounded-lg text-5xl leading-none transition hover:bg-panel/70 sm:text-6xl" aria-label="Note emoji">{note.icon || '📝'}</button>
          <input value={note.title || ''} readOnly={!['owner', 'editor'].includes(note.accessRole)} onChange={(event) => updateNote({ title: event.target.value })} placeholder="Untitled note" className="mb-9 w-full bg-transparent text-3xl font-bold leading-[1.08] tracking-[-0.035em] outline-none placeholder:text-muted/35 sm:text-4xl lg:text-5xl" />
          {actionError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{actionError}</p>}
          {collaborative.syncError && <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{collaborative.syncError}</p>}
          <Editor value={note.content || []} readOnly={!['owner', 'editor'].includes(note.accessRole) || !collaborative.synced} onChange={(content) => updateNote({ content })} onFormat={collaborative.formatRanges} smallText={viewSettings.smallText} />
          <p className="mt-10 text-right text-xs text-muted" aria-live="polite">{noteStats.words.toLocaleString()} words · {noteStats.characters.toLocaleString()} characters</p>
          {Object.values(remoteSelections).length > 0 && <div className="pointer-events-none sticky bottom-4 ml-auto flex w-fit max-w-sm flex-col gap-1">{Object.entries(remoteSelections).map(([socketId, { user: selectionUser, selection }]) => <div key={socketId} className="rounded-xl bg-indigo-500/95 px-3 py-2 text-xs text-white shadow-lg"><span className="font-semibold">{selectionUser.name}</span> selected “{selection.text}”</div>)}</div>}
          {Object.entries(cursors).map(([socketId, cursor]) => <div key={socketId} className="pointer-events-none absolute z-50 transition-[left,top] duration-75 ease-linear" style={{ left: `${cursor.position.xRatio * 100}%`, top: `${cursor.position.yRatio * 100}%` }}><MousePointer2 size={22} className="fill-indigo-500 text-white drop-shadow" /><span className="ml-3 -mt-1 block whitespace-nowrap rounded-xl bg-indigo-500 px-2 py-1 text-[10px] font-semibold text-white">{cursor.user.name}</span></div>)}
        </article>
      </main>}
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} noteId={id} />
      <VersionHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} noteId={id} canRestore={['owner', 'editor'].includes(note?.accessRole)} onRestored={(restored) => { setNote((current) => ({ ...current, ...restored })); setNotes((current) => current.map((item) => item._id === id ? { ...item, ...restored } : item)); }} />
      <CommentsModal open={commentsOpen} onClose={() => setCommentsOpen(false)} noteId={id} canResolve={['owner', 'editor'].includes(note?.accessRole)} />
      <PageStyleModal open={styleOpen} onClose={() => setStyleOpen(false)} value={styleDraft} onChange={setStyleDraft} onApply={() => { updateNote({ icon: styleDraft.icon || '📝' }); setStyleOpen(false); }} />
    </div>
  );
}

function readViewSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('otion_note_view_settings') || '{}');
    return {
      smallText: Boolean(saved.smallText),
      fullWidth: Boolean(saved.fullWidth),
    };
  } catch {
    return DEFAULT_VIEW_SETTINGS;
  }
}

function serializeSelection(root) {
  const selection = window.getSelection();
  if (!root || !selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const startBlock = (range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement)?.closest?.('[data-block-id]');
  const endBlock = (range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer.parentElement)?.closest?.('[data-block-id]');
  if (!startBlock || !endBlock) return null;
  return {
    startBlockId: startBlock.dataset.blockId,
    startOffset: textOffset(startBlock, range.startContainer, range.startOffset),
    endBlockId: endBlock.dataset.blockId,
    endOffset: textOffset(endBlock, range.endContainer, range.endOffset),
    text: selection.toString().slice(0, 240),
  };
}

function textOffset(root, node, offset) {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

function selectionToRange(selection) {
  if (!selection) return null;
  const startBlock = document.querySelector(`[data-block-id="${selection.startBlockId}"]`);
  const endBlock = document.querySelector(`[data-block-id="${selection.endBlockId}"]`);
  if (!startBlock || !endBlock) return null;
  const start = pointAtTextOffset(startBlock, selection.startOffset);
  const end = pointAtTextOffset(endBlock, selection.endOffset);
  if (!start || !end) return null;
  try {
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    return range;
  } catch {
    return null;
  }
}

function pointAtTextOffset(root, targetOffset) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let node = walker.nextNode();
  while (node) {
    const next = consumed + node.textContent.length;
    if (targetOffset <= next) return { node, offset: Math.max(0, targetOffset - consumed) };
    consumed = next;
    node = walker.nextNode();
  }
  return root.firstChild ? { node: root.firstChild, offset: root.firstChild.textContent?.length || 0 } : null;
}
