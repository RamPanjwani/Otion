import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, MousePointer2, SmilePlus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Editor from '../components/Editor';
import Loading from '../components/Loading';
import ShareModal from '../components/ShareModal';
import useAuth from '../hooks/useAuth';
import useNotes from '../hooks/useNotes';
import useDebouncedEffect from '../hooks/useDebouncedEffect';
import api from '../services/api';
import { connectSocket, socket } from '../services/socket';

export default function NoteEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const { notes, setNotes } = useNotes();
  const [note, setNote] = useState(null);
  const [error, setError] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [presence, setPresence] = useState([]);
  const [cursors, setCursors] = useState({});
  const [remoteSelections, setRemoteSelections] = useState({});
  const [saveStatus, setSaveStatus] = useState('saved');
  const dirtyRef = useRef(false);
  const lastPointerRef = useRef(0);
  const articleRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    api.get(`/notes/${id}`).then(({ data }) => { if (active) { setNote(data); setError(''); } }).catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to open note'); });
    return () => { active = false; };
  }, [id]);

  const loadedNoteId = note?._id;
  useEffect(() => {
    if (!loadedNoteId || !user) return undefined;
    connectSocket();
    socket.emit('join-note', { noteId: id });
    const receiveChanges = ({ content }) => setNote((current) => ({ ...current, content }));
    const documentSaved = ({ document }) => {
      dirtyRef.current = false;
      setNote((current) => current ? { ...current, ...document } : current);
      setNotes((current) => current.map((item) => item._id === id ? { ...item, ...document } : item));
      setSaveStatus('saved');
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
    socket.on('receive-changes', receiveChanges);
    socket.on('document-saved', documentSaved);
    socket.on('presence-update', updatePresence);
    socket.on('cursor-move', cursorMove);
    socket.on('selection-change', selectionChange);
    socket.on('permission-changed', permissionChanged);
    socket.on('access-revoked', accessRevoked);
    return () => {
      socket.emit('leave-note', { noteId: id });
      socket.off('receive-changes', receiveChanges);
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
    if (!note || !dirtyRef.current || note.accessRole === 'viewer') return;
    dirtyRef.current = false;
    setSaveStatus('saving');
    api.put(`/notes/${id}`, { title: note.title, content: note.content, icon: note.icon, coverImage: note.coverImage }).then(() => {
      setSaveStatus('saved');
    }).catch((requestError) => {
      if ([403, 404].includes(requestError.response?.status)) {
        dirtyRef.current = false;
        navigate('/dashboard', { replace: true });
      } else {
        dirtyRef.current = true;
        setSaveStatus('error');
      }
    });
  }, [note?.title, note?.content, note?.icon, note?.coverImage, id], 500);

  const updateNote = useCallback((patch, broadcast = false) => {
    dirtyRef.current = true;
    setSaveStatus('unsaved');
    setNote((current) => ({ ...current, ...patch }));
    setNotes((current) => current.map((item) => item._id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
    if (broadcast && patch.content) socket.emit('send-changes', { noteId: id, content: patch.content });
  }, [id, setNotes]);

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

  const pickIcon = () => { const icon = window.prompt('Choose an emoji for this page', note.icon || '📄'); if (icon !== null) updateNote({ icon: icon.slice(0, 8) }); };
  const pickCover = () => { const coverImage = window.prompt('Paste a cover image URL', note.coverImage || ''); if (coverImage !== null) updateNote({ coverImage: coverImage.trim() }); };
  const archive = async () => { await api.patch(`/notes/${id}/archive`); navigate('/dashboard'); };
  const toggleStar = async () => {
    if (!note || note.accessRole === 'viewer') return;
    const isFavorite = !note.isFavorite;
    updateNote({ isFavorite });
    try {
      await api.put(`/notes/${id}`, { isFavorite });
      dirtyRef.current = false;
      setSaveStatus('saved');
    } catch {
      updateNote({ isFavorite: !isFavorite });
      setSaveStatus('error');
    }
  };
  const saveImmediately = async () => {
    if (!note || note.accessRole === 'viewer' || saveStatus === 'saving') return;
    setSaveStatus('saving');
    try {
      const payload = { title: note.title, content: note.content, icon: note.icon, coverImage: note.coverImage };
      const { data } = await api.put(`/notes/${id}`, payload);
      dirtyRef.current = false;
      setNote((current) => ({ ...current, ...data, accessRole: current.accessRole }));
      setSaveStatus('saved');
    } catch (requestError) {
      if ([403, 404].includes(requestError.response?.status)) navigate('/dashboard', { replace: true });
      else setSaveStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-canvas md:pl-60">
      <Sidebar notes={notes} onCreated={(created) => setNotes((current) => [created, ...current.filter((item) => item._id !== created._id)])} />
      <Navbar title={note?.title || 'Document'} collaborators={presence} onShare={note?.accessRole === 'owner' ? () => setShareOpen(true) : undefined} onArchive={note?.accessRole === 'owner' ? archive : undefined} onSave={['owner', 'editor'].includes(note?.accessRole) ? saveImmediately : undefined} saveStatus={saveStatus} starred={Boolean(note?.isFavorite)} onToggleStar={['owner', 'editor'].includes(note?.accessRole) ? toggleStar : undefined} />
      {error ? <div className="mx-auto max-w-2xl p-10 text-red-700">{error}</div> : !note || note._id !== id ? <Loading fullPage /> : note && <main>
        {note.coverImage && <div className="h-52 w-full bg-cover bg-center sm:h-64" style={{ backgroundImage: `url(${note.coverImage})` }} />}
        <article ref={articleRef} onPointerMove={handlePointerMove} className="relative mx-auto max-w-[900px] px-6 py-12 sm:px-10 lg:py-16">
          {note.accessRole !== 'viewer' && <div className="mb-5 flex gap-5 text-sm text-muted"><button onClick={pickIcon} className="flex items-center gap-2 hover:text-ink"><SmilePlus size={17} /> Add icon</button><button onClick={pickCover} className="flex items-center gap-2 hover:text-ink"><ImagePlus size={17} /> Add cover</button></div>}
          {note.icon && <button onClick={pickIcon} className="mb-3 text-6xl">{note.icon}</button>}
          <input value={note.title || ''} readOnly={note.accessRole === 'viewer'} onChange={(event) => updateNote({ title: event.target.value })} placeholder="Untitled" className="mb-10 w-full bg-transparent text-4xl font-bold tracking-tight outline-none sm:text-5xl" />
          <Editor value={note.content || []} readOnly={note.accessRole === 'viewer'} onChange={(content) => updateNote({ content }, true)} />
          {Object.values(remoteSelections).length > 0 && <div className="pointer-events-none sticky bottom-4 ml-auto flex w-fit max-w-sm flex-col gap-1">{Object.entries(remoteSelections).map(([socketId, { user: selectionUser, selection }]) => <div key={socketId} className="rounded-xl bg-indigo-500/95 px-3 py-2 text-xs text-white shadow-lg"><span className="font-semibold">{selectionUser.name}</span> selected “{selection.text}”</div>)}</div>}
          {Object.entries(cursors).map(([socketId, cursor]) => <div key={socketId} className="pointer-events-none absolute z-50 transition-[left,top] duration-75 ease-linear" style={{ left: `${cursor.position.xRatio * 100}%`, top: `${cursor.position.yRatio * 100}%` }}><MousePointer2 size={22} className="fill-indigo-500 text-white drop-shadow" /><span className="ml-3 -mt-1 block whitespace-nowrap rounded-xl bg-indigo-500 px-2 py-1 text-[10px] font-semibold text-white">{cursor.user.name}</span></div>)}
        </article>
      </main>}
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} noteId={id} />
    </div>
  );
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
