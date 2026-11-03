import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getNoteStats } from '../noteContent.js';

describe('Note stats calculation', () => {
  it('correctly counts words and characters across block arrays', () => {
    const blocks = [
      { text: 'Hello world' },
      { text: 'Second paragraph with more words.' },
    ];
    const stats = getNoteStats(blocks);
    assert.equal(stats.words, 7);
    assert.equal(stats.characters, 45);
  });

  it('handles empty or malformed block arrays gracefully', () => {
    assert.deepEqual(getNoteStats([]), { words: 0, characters: 0 });
    assert.deepEqual(getNoteStats(null), { words: 0, characters: 0 });
    assert.deepEqual(getNoteStats([{ text: '' }, {}]), { words: 0, characters: 0 });
  });
});
