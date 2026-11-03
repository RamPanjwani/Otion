import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blocksToMarkdown, markdownToBlocks } from '../markdown.js';

describe('Markdown utils', () => {
  it('converts blocks to markdown with headings, tasks, and indentation', () => {
    const blocks = [
      { id: '1', type: 'h1', text: 'My Title' },
      { id: '2', type: 'paragraph', text: 'Introduction text' },
      { id: '3', type: 'bullet', text: 'Item 1', indent: 0 },
      { id: '4', type: 'bullet', text: 'Nested Item 1a', indent: 1 },
      { id: '5', type: 'task', text: 'Todo task', checked: true, indent: 0 },
      { id: '6', type: 'code', text: 'const x = 10;' },
      { id: '7', type: 'callout', text: 'Important notice' },
    ];

    const md = blocksToMarkdown('My Document', blocks);
    assert.ok(md.includes('# My Document'));
    assert.ok(md.includes('# My Title'));
    assert.ok(md.includes('Introduction text'));
    assert.ok(md.includes('- Item 1'));
    assert.ok(md.includes('  - Nested Item 1a'));
    assert.ok(md.includes('- [x] Todo task'));
    assert.ok(md.includes('```\nconst x = 10;\n```'));
    assert.ok(md.includes('> 💡 Important notice'));
  });

  it('parses markdown back into Otion blocks with types and indentation', () => {
    const input = [
      '# Main Heading',
      'Regular text block',
      '- Parent bullet',
      '  - Indented bullet',
      '- [ ] Incomplete task',
      '- [x] Completed task',
      '1. Numbered one',
      '> 💡 Note callout',
      '> Blockquote here',
      '---',
    ].join('\n');

    const blocks = markdownToBlocks(input);
    assert.ok(blocks.length >= 6);

    assert.equal(blocks[0].type, 'h1');
    assert.equal(blocks[0].text, 'Main Heading');

    assert.equal(blocks[1].type, 'paragraph');
    assert.equal(blocks[1].text, 'Regular text block');

    const bulletParent = blocks.find((b) => b.text === 'Parent bullet');
    assert.equal(bulletParent?.type, 'bullet');
    assert.equal(bulletParent?.indent, 0);

    const bulletChild = blocks.find((b) => b.text === 'Indented bullet');
    assert.equal(bulletChild?.type, 'bullet');
    assert.equal(bulletChild?.indent, 1);

    const incompleteTask = blocks.find((b) => b.text === 'Incomplete task');
    assert.equal(incompleteTask?.type, 'task');
    assert.equal(incompleteTask?.checked, false);

    const completedTask = blocks.find((b) => b.text === 'Completed task');
    assert.equal(completedTask?.type, 'task');
    assert.equal(completedTask?.checked, true);

    const divider = blocks.find((b) => b.type === 'divider');
    assert.ok(divider);
  });
});
