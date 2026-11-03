export function getNoteStats(blocks = []) {
  if (!Array.isArray(blocks) || !blocks.length) {
    return { words: 0, characters: 0 };
  }

  const text = blocks
    .filter((block) => block && block.type !== 'divider' && block.type !== 'image')
    .map((block) => String(block.text || '').trim())
    .filter(Boolean)
    .join('\n');

  return {
    words: text ? text.split(/\s+/u).filter(Boolean).length : 0,
    characters: text.length,
  };
}
