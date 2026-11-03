export function getNoteStats(blocks = []) {
  const text = blocks
    .filter((block) => block?.type !== 'divider' && block?.type !== 'image')
    .map((block) => String(block?.text || '').trim())
    .filter(Boolean)
    .join('\n');

  return {
    words: text ? text.split(/\s+/u).filter(Boolean).length : 0,
    characters: text.length,
  };
}
