const Y = require('yjs');

const objectFields = ['assetId', 'assetUrl', 'assetUrlExpiresAt', 'fileName', 'mimeType', 'size', 'caption'];

const binaryBytes = (value) => {
  if (Buffer.isBuffer(value)) return value;
  if (value?.buffer) return Buffer.from(value.buffer);
  if (typeof value?.value === 'function') return Buffer.from(value.value());
  return Buffer.from(value || []);
};

const cleanBlock = (block = {}) => {
  const hadAsset = Boolean(block.assetId);
  const cleaned = { ...block };
  objectFields.forEach((field) => delete cleaned[field]);
  if (cleaned.type === 'file' || (cleaned.type === 'image' && hadAsset)) {
    cleaned.type = 'paragraph';
    cleaned.text = String(cleaned.text || '');
  }
  return cleaned;
};

module.exports = {
  id: '012-remove-object-uploads',
  description: 'Remove managed object-upload metadata and storage collection',
  async up({ mongoose, dryRun }) {
    const db = mongoose.connection.db;
    const notes = db.collection('notes');
    const states = db.collection('collaborationstates');
    const updates = db.collection('collaborationupdates');
    const collections = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
    const noteCount = await notes.countDocuments({
      $or: [{ 'content.assetId': { $exists: true } }, { 'content.type': 'file' }],
    });
    const stateCount = collections.has('collaborationstates')
      ? await states.countDocuments({})
      : 0;

    if (dryRun) {
      console.log(`would clean ${noteCount} note records and inspect ${stateCount} collaboration snapshots`);
      console.log(collections.has('assets') ? 'would drop the assets collection' : 'assets collection is already absent');
      return;
    }

    const noteCursor = notes.find({
      $or: [{ 'content.assetId': { $exists: true } }, { 'content.type': 'file' }],
    });
    for await (const note of noteCursor) {
      await notes.updateOne({ _id: note._id }, { $set: { content: (note.content || []).map(cleanBlock) } });
    }

    if (collections.has('collaborationstates')) {
      const stateCursor = states.find({});
      for await (const state of stateCursor) {
        const doc = new Y.Doc();
        if (state.snapshot) Y.applyUpdate(doc, new Uint8Array(binaryBytes(state.snapshot)));
        const pending = collections.has('collaborationupdates')
          ? await updates.find({ note: state.note, sequence: { $gt: state.snapshotSequence || 0 } }).sort({ sequence: 1 }).toArray()
          : [];
        pending.forEach((item) => Y.applyUpdate(doc, new Uint8Array(binaryBytes(item.update))));

        let changed = false;
        doc.transact(() => {
          doc.getArray('blocks').forEach((block) => {
            const hadAsset = Boolean(block.get('assetId'));
            objectFields.forEach((field) => {
              if (block.has(field)) {
                block.delete(field);
                changed = true;
              }
            });
            if (block.get('type') === 'file' || (block.get('type') === 'image' && hadAsset)) {
              block.set('type', 'paragraph');
              changed = true;
            }
          });
        }, 'remove-object-uploads');

        if (changed || pending.length) {
          const sequence = Math.max(state.lastSequence || 0, ...pending.map(({ sequence: itemSequence }) => itemSequence), 0);
          await states.updateOne(
            { _id: state._id },
            { $set: { snapshot: Buffer.from(Y.encodeStateAsUpdate(doc)), snapshotSequence: sequence, lastSequence: sequence } },
          );
          if (collections.has('collaborationupdates')) {
            await updates.deleteMany({ note: state.note, sequence: { $lte: sequence } });
          }
        }
        doc.destroy();
      }
    }

    if (collections.has('assets')) await db.dropCollection('assets');
  },
};
