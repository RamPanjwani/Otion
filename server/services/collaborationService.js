const Y = require('yjs');
const Note = require('../models/Note');
const CollaborationState = require('../models/CollaborationState');
const CollaborationUpdate = require('../models/CollaborationUpdate');

const documents = new Map();
const SNAPSHOT_DELAY_MS = 750;
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

const createBlock = (block = {}) => {
  const map = new Y.Map();
  map.set('id', String(block.id || crypto.randomUUID()));
  map.set('type', String(block.type || 'paragraph'));
  map.set('checked', Boolean(block.checked));
  const text = new Y.Text();
  if (block.text) text.insert(0, String(block.text));
  (block.marks || []).forEach((mark) => {
    const from = Math.max(0, Math.min(text.length, Number(mark.from) || 0));
    const to = Math.max(from, Math.min(text.length, Number(mark.to) || 0));
    if (to > from) text.format(from, to - from, safeAttributes(mark.attributes));
  });
  map.set('text', text);
  return map;
};

const blocksFromDocument = (doc) => doc.getArray('blocks').toArray().map((block) => {
  const text = block.get('text') || new Y.Text();
  const result = {
    id: block.get('id'),
    type: block.get('type') || 'paragraph',
    text: text.toString(),
    marks: marksFromText(text),
    checked: Boolean(block.get('checked')),
  };
  return result;
});

const seedDocument = (doc, blocks = []) => {
  const root = doc.getArray('blocks');
  const source = blocks.length ? blocks : [{ id: crypto.randomUUID(), type: 'paragraph', text: '', checked: false }];
  doc.transact(() => root.insert(0, source.map(createBlock)), 'seed');
};

const getDocument = async (noteId) => {
  const key = String(noteId);
  if (documents.has(key)) return documents.get(key);

  const loading = (async () => {
    const [state, note] = await Promise.all([
      CollaborationState.findOne({ note: noteId }),
      Note.findById(noteId).select('content'),
    ]);
    if (!note) throw new Error('Note not found');

    const doc = new Y.Doc();
    if (state?.snapshot?.length) Y.applyUpdate(doc, new Uint8Array(state.snapshot), 'storage');
    else seedDocument(doc, note.content);

    const snapshotSequence = state?.snapshotSequence || 0;
    const pending = await CollaborationUpdate.find({ note: noteId, sequence: { $gt: snapshotSequence } }).sort({ sequence: 1 });
    pending.forEach((item) => Y.applyUpdate(doc, new Uint8Array(item.update), 'storage'));

    const entry = {
      doc,
      lastSequence: Math.max(state?.lastSequence || 0, ...pending.map((item) => item.sequence), 0),
      snapshotTimer: null,
    };

    if (!state) {
      await CollaborationState.create({
        note: noteId,
        snapshot: Buffer.from(Y.encodeStateAsUpdate(doc)),
        schemaVersion: 2,
      });
    }
    documents.set(key, entry);
    return entry;
  })();

  documents.set(key, loading);
  try {
    return await loading;
  } catch (error) {
    documents.delete(key);
    throw error;
  }
};

const compact = async (noteId, entry) => {
  entry.snapshotTimer = null;
  const sequence = entry.lastSequence;
  const snapshot = Buffer.from(Y.encodeStateAsUpdate(entry.doc));
  const content = blocksFromDocument(entry.doc);
  await Promise.all([
    Note.findByIdAndUpdate(noteId, { content, contentSchemaVersion: 3 }),
    CollaborationState.findOneAndUpdate(
      { note: noteId },
      { snapshot, schemaVersion: 2, snapshotSequence: sequence, $max: { lastSequence: sequence } },
      { upsert: true },
    ),
  ]);
  await CollaborationUpdate.deleteMany({ note: noteId, sequence: { $lte: sequence } });
};

const scheduleCompaction = (noteId, entry) => {
  if (entry.snapshotTimer) clearTimeout(entry.snapshotTimer);
  entry.snapshotTimer = setTimeout(() => {
    compact(noteId, entry).catch((error) => console.error('Collaboration snapshot failed', error));
  }, SNAPSHOT_DELAY_MS);
  entry.snapshotTimer.unref?.();
};

const applyUpdate = async (noteId, update, actor) => {
  const entry = await getDocument(noteId);
  const binary = update instanceof Uint8Array ? update : new Uint8Array(update);
  if (!binary.length || binary.byteLength > 256 * 1024) throw new Error('Invalid collaboration update');

  Y.applyUpdate(entry.doc, binary, 'remote');
  return persistAppliedUpdate(noteId, entry, binary, actor);
};

const persistAppliedUpdate = async (noteId, entry, binary, actor) => {
  const state = await CollaborationState.findOneAndUpdate(
    { note: noteId },
    { $inc: { lastSequence: 1 } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  );
  entry.lastSequence = state.lastSequence;
  await CollaborationUpdate.create({ note: noteId, sequence: state.lastSequence, update: Buffer.from(binary), actor });
  scheduleCompaction(noteId, entry);
  return { sequence: state.lastSequence, content: blocksFromDocument(entry.doc) };
};

const replaceContent = async (noteId, blocks, actor) => {
  const entry = await getDocument(noteId);
  let binary;
  const capture = (update, origin) => { if (origin === 'restore') binary = update; };
  entry.doc.on('update', capture);
  entry.doc.transact(() => {
    const root = entry.doc.getArray('blocks');
    if (root.length) root.delete(0, root.length);
    const source = blocks?.length ? blocks : [{ id: crypto.randomUUID(), type: 'paragraph', text: '', checked: false }];
    root.insert(0, source.map(createBlock));
  }, 'restore');
  entry.doc.off('update', capture);
  const result = await persistAppliedUpdate(noteId, entry, binary, actor);
  return { ...result, update: Array.from(binary) };
};

const syncPayload = async (noteId) => {
  const entry = await getDocument(noteId);
  return {
    update: Array.from(Y.encodeStateAsUpdate(entry.doc)),
    stateVector: Array.from(Y.encodeStateVector(entry.doc)),
    schemaVersion: 2,
    sequence: entry.lastSequence,
  };
};

const flushDocument = async (noteId) => {
  const entry = await getDocument(noteId);
  if (entry.snapshotTimer) clearTimeout(entry.snapshotTimer);
  await compact(noteId, entry);
};

const evictDocument = (noteId) => {
  const entry = documents.get(String(noteId));
  if (entry?.snapshotTimer) clearTimeout(entry.snapshotTimer);
  documents.delete(String(noteId));
};

const flushAllDocuments = async () => {
  const entries = await Promise.all([...documents.entries()].map(async ([noteId, value]) => [noteId, await value]));
  await Promise.all(entries.map(async ([noteId, entry]) => {
    if (entry.snapshotTimer) clearTimeout(entry.snapshotTimer);
    entry.snapshotTimer = null;
    await compact(noteId, entry);
  }));
};

module.exports = { applyUpdate, blocksFromDocument, evictDocument, flushAllDocuments, flushDocument, getDocument, replaceContent, syncPayload };
