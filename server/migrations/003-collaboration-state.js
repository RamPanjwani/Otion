const Y = require('yjs');

const makeBlock = (block = {}) => {
  const map = new Y.Map();
  map.set('id', String(block.id || new (require('mongoose').Types.ObjectId)()));
  map.set('type', String(block.type || 'paragraph'));
  map.set('checked', Boolean(block.checked));
  const text = new Y.Text();
  if (block.text) text.insert(0, String(block.text));
  map.set('text', text);
  return map;
};

module.exports = {
  id: '003-collaboration-state',
  description: 'Backfill Yjs snapshots for existing block documents',
  async up({ mongoose, dryRun }) {
    const notes = mongoose.connection.collection('notes');
    const states = mongoose.connection.collection('collaborationstates');
    const missing = await notes.find({ contentSchemaVersion: { $ne: 2 } }).project({ content: 1 }).toArray();
    if (dryRun) {
      console.log(`would backfill ${missing.length} collaborative documents`);
      return;
    }
    await states.createIndex({ note: 1 }, { unique: true });
    for (const note of missing) {
      const doc = new Y.Doc();
      const blocks = note.content?.length ? note.content : [{ id: String(new mongoose.Types.ObjectId()), type: 'paragraph', text: '', checked: false }];
      doc.getArray('blocks').insert(0, blocks.map(makeBlock));
      await states.updateOne(
        { note: note._id },
        { $setOnInsert: { snapshot: Buffer.from(Y.encodeStateAsUpdate(doc)), schemaVersion: 2, snapshotSequence: 0, lastSequence: 0, createdAt: new Date() }, $set: { updatedAt: new Date() } },
        { upsert: true },
      );
      await notes.updateOne({ _id: note._id }, { $set: { contentSchemaVersion: 2 } });
    }
  },
};
