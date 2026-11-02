import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { socket } from '../services/socket';

const LOCAL_ORIGIN = Symbol('otion-local-edit');
const REMOTE_ORIGIN = Symbol('otion-remote-edit');
const inlineAttributes = new Set(['bold', 'italic', 'underline', 'strike', 'code', 'link']);

const safeAttributes = (attributes = {}) => Object.fromEntries(Object.entries(attributes)
  .filter(([key, value]) => inlineAttributes.has(key) && (typeof value === 'boolean' || typeof value === 'string')));

const marksFromText = (text) => {
  let offset = 0;
  const marks = [];
  text.toDelta().forEach((operation) => {
    const value = typeof operation.insert === 'string' ? operation.insert : '';
    const attributes = safeAttributes(operation.attributes);
    if (value.length && Object.keys(attributes).length) marks.push({ from: offset, to: offset + value.length, attributes });
    offset += value.length;
  });
  return marks;
};

const makeYBlock = (block) => {
  const map = new Y.Map();
  map.set('id', String(block.id));
  map.set('type', block.type || 'paragraph');
  map.set('checked', Boolean(block.checked));
  const text = new Y.Text();
  if (block.text) text.insert(0, block.text);
  (block.marks || []).forEach((mark) => {
    const from = Math.max(0, Math.min(text.length, Number(mark.from) || 0));
    const to = Math.max(from, Math.min(text.length, Number(mark.to) || 0));
    if (to > from) text.format(from, to - from, safeAttributes(mark.attributes));
  });
  map.set('text', text);
  return map;
};

const readBlocks = (doc) => doc.getArray('blocks').toArray().map((block) => {
  const text = block.get('text') || new Y.Text();
  const result = { id: block.get('id'), type: block.get('type') || 'paragraph', text: text.toString(), marks: marksFromText(text), checked: Boolean(block.get('checked')) };
  return result;
});

const replaceTextDiff = (target, nextValue) => {
  const current = target.toString();
  if (current === nextValue) return;
  let prefix = 0;
  while (prefix < current.length && prefix < nextValue.length && current[prefix] === nextValue[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < current.length - prefix
    && suffix < nextValue.length - prefix
    && current[current.length - 1 - suffix] === nextValue[nextValue.length - 1 - suffix]
  ) suffix += 1;
  const removeCount = current.length - prefix - suffix;
  if (removeCount) target.delete(prefix, removeCount);
  const insertion = nextValue.slice(prefix, nextValue.length - suffix);
  if (insertion) target.insert(prefix, insertion);
};

const writeBlocks = (doc, nextBlocks) => {
  const root = doc.getArray('blocks');
  doc.transact(() => {
    const wanted = new Set(nextBlocks.map((block) => block.id));
    for (let index = root.length - 1; index >= 0; index -= 1) {
      if (!wanted.has(root.get(index).get('id'))) root.delete(index, 1);
    }

    nextBlocks.forEach((block, index) => {
      let map = root.toArray().find((candidate) => candidate.get('id') === block.id);
      if (!map) {
        map = makeYBlock(block);
        root.insert(Math.min(index, root.length), [map]);
      }
      map.set('type', block.type || 'paragraph');
      map.set('checked', Boolean(block.checked));
      replaceTextDiff(map.get('text'), block.text || '');
    });
  }, LOCAL_ORIGIN);
};

export default function useCollaborativeNote(noteId, enabled, onContent) {
  const docRef = useRef(null);
  const undoManagerRef = useRef(null);
  const contentHandlerRef = useRef(onContent);
  const [syncedNoteId, setSyncedNoteId] = useState(null);
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    contentHandlerRef.current = onContent;
  }, [onContent]);

  useEffect(() => {
    if (!enabled) return undefined;
    const doc = new Y.Doc();
    docRef.current = doc;
    undoManagerRef.current = new Y.UndoManager(doc.getArray('blocks'), {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      captureTimeout: 500,
    });

    const handleDocumentUpdate = (update, origin) => {
      contentHandlerRef.current?.(readBlocks(doc), { local: origin === LOCAL_ORIGIN });
      if (origin === LOCAL_ORIGIN && socket.connected) {
        socket.emit('collab-update', { noteId, update: Array.from(update) }, (result) => {
          if (!result?.ok) setSyncError('Your latest change could not be synchronized');
        });
      }
    };
    const handleSync = ({ update, stateVector }) => {
      try {
        Y.applyUpdate(doc, new Uint8Array(update), REMOTE_ORIGIN);
        const missingOnServer = Y.encodeStateAsUpdate(doc, new Uint8Array(stateVector));
        if (missingOnServer.byteLength > 2) {
          socket.emit('collab-update', { noteId, update: Array.from(missingOnServer) });
        }
        setSyncedNoteId(noteId);
        setSyncError('');
        contentHandlerRef.current?.(readBlocks(doc), { local: false });
      } catch {
        setSyncError('Unable to synchronize this note');
      }
    };
    const handleRemoteUpdate = ({ update }) => {
      try {
        Y.applyUpdate(doc, new Uint8Array(update), REMOTE_ORIGIN);
      } catch {
        setSyncError('A remote change could not be applied');
      }
    };
    const handleDisconnect = () => setSyncedNoteId(null);
    const handleError = ({ message }) => setSyncError(message || 'Unable to synchronize this note');

    doc.on('update', handleDocumentUpdate);
    socket.on('collab-sync', handleSync);
    socket.on('collab-update', handleRemoteUpdate);
    socket.on('collab-error', handleError);
    socket.on('disconnect', handleDisconnect);
    return () => {
      doc.off('update', handleDocumentUpdate);
      socket.off('collab-sync', handleSync);
      socket.off('collab-update', handleRemoteUpdate);
      socket.off('collab-error', handleError);
      socket.off('disconnect', handleDisconnect);
      doc.destroy();
      docRef.current = null;
      undoManagerRef.current = null;
    };
  }, [enabled, noteId]);

  const updateBlocks = useCallback((blocks) => {
    if (!docRef.current || syncedNoteId !== noteId) return false;
    writeBlocks(docRef.current, blocks);
    return true;
  }, [noteId, syncedNoteId]);

  const undo = useCallback(() => undoManagerRef.current?.undo(), []);
  const redo = useCallback(() => undoManagerRef.current?.redo(), []);

  const formatRanges = useCallback((ranges, attributes) => {
    if (!docRef.current || syncedNoteId !== noteId) return false;
    const root = docRef.current.getArray('blocks');
    docRef.current.transact(() => {
      ranges.forEach(({ blockId, from, to }) => {
        const block = root.toArray().find((candidate) => candidate.get('id') === blockId);
        const text = block?.get('text');
        const start = Math.max(0, Math.min(text?.length || 0, from));
        const end = Math.max(start, Math.min(text?.length || 0, to));
        if (text && end > start) text.format(start, end - start, attributes);
      });
    }, LOCAL_ORIGIN);
    return true;
  }, [noteId, syncedNoteId]);

  return { synced: syncedNoteId === noteId, syncError, updateBlocks, formatRanges, undo, redo };
}
