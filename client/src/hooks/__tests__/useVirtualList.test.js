import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Virtual list window calculation', () => {
  it('correctly calculates slice bounds for large lists', () => {
    const items = Array.from({ length: 500 }, (_, i) => ({ id: i, title: `Note ${i}` }));
    const itemHeight = 60;
    const scrollTop = 1200; // index 20
    const viewportHeight = 600; // 10 items visible
    const overscan = 5;

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / itemHeight) + 2 * overscan;
    const end = Math.min(items.length, start + visibleCount);

    assert.equal(start, 15);
    assert.equal(end, 35);
    assert.equal(items.length * itemHeight, 30000);
  });
});
