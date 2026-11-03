export function blocksToMarkdown(title, blocks = []) {
  const lines = [];
  if (title?.trim()) {
    lines.push(`# ${title.trim()}\n`);
  }

  for (const block of blocks) {
    const indentPrefix = '  '.repeat(block.indent || 0);
    const text = block.text || '';

    switch (block.type) {
      case 'h1':
        lines.push(`\n# ${text}\n`);
        break;
      case 'h2':
        lines.push(`\n## ${text}\n`);
        break;
      case 'h3':
        lines.push(`\n### ${text}\n`);
        break;
      case 'bullet':
        lines.push(`${indentPrefix}- ${text}`);
        break;
      case 'numbered':
        lines.push(`${indentPrefix}1. ${text}`);
        break;
      case 'task':
        lines.push(`${indentPrefix}- [${block.checked ? 'x' : ' '}] ${text}`);
        break;
      case 'quote':
        lines.push(`> ${text}`);
        break;
      case 'code':
        lines.push(`\`\`\`\n${text}\n\`\`\``);
        break;
      case 'callout':
        lines.push(`> 💡 ${text}`);
        break;
      case 'divider':
        lines.push('\n---\n');
        break;
      case 'image':
        lines.push(`![Image](${text})`);
        break;
      case 'paragraph':
      default:
        lines.push(text);
        break;
    }
  }

  return lines.join('\n');
}

export function markdownToBlocks(markdown = '') {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];

  let inCode = false;
  let codeBuffer = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (inCode) {
        blocks.push({
          id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          type: 'code',
          text: codeBuffer.join('\n'),
          marks: [],
          checked: false,
        });
        codeBuffer = [];
        inCode = false;
      } else {
        inCode = true;
        codeBuffer = [];
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      if (blocks.length > 0 && blocks[blocks.length - 1].type === 'paragraph' && !blocks[blocks.length - 1].text) {
        continue;
      }
      continue;
    }

    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      blocks.push({
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'divider',
        text: '',
        marks: [],
        checked: false,
      });
      continue;
    }

    const indentMatch = line.match(/^(\s+)/);
    const indentSpaces = indentMatch ? indentMatch[1].length : 0;
    const indent = Math.min(4, Math.floor(indentSpaces / 2));

    if (trimmed.startsWith('# ')) {
      blocks.push({
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'h1',
        text: trimmed.slice(2).trim(),
        marks: [],
        checked: false,
      });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'h2',
        text: trimmed.slice(3).trim(),
        marks: [],
        checked: false,
      });
    } else if (trimmed.startsWith('### ')) {
      blocks.push({
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'h3',
        text: trimmed.slice(4).trim(),
        marks: [],
        checked: false,
      });
    } else if (/^[-*]\s+\[([ xX])\]\s+(.*)/.test(trimmed)) {
      const match = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.*)/);
      blocks.push({
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'task',
        text: match[2],
        checked: match[1].toLowerCase() === 'x',
        indent,
        marks: [],
      });
    } else if (/^[-*]\s+(.*)/.test(trimmed)) {
      const match = trimmed.match(/^[-*]\s+(.*)/);
      blocks.push({
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'bullet',
        text: match[1],
        indent,
        marks: [],
        checked: false,
      });
    } else if (/^\d+\.\s+(.*)/.test(trimmed)) {
      const match = trimmed.match(/^\d+\.\s+(.*)/);
      blocks.push({
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'numbered',
        text: match[1],
        indent,
        marks: [],
        checked: false,
      });
    } else if (trimmed.startsWith('> 💡 ')) {
      blocks.push({
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'callout',
        text: trimmed.slice(5).trim(),
        marks: [],
        checked: false,
      });
    } else if (trimmed.startsWith('> ')) {
      blocks.push({
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'quote',
        text: trimmed.slice(2).trim(),
        marks: [],
        checked: false,
      });
    } else if (/^!\[.*?\]\((https?:\/\/.*?)\)/.test(trimmed)) {
      const match = trimmed.match(/^!\[.*?\]\((https?:\/\/.*?)\)/);
      blocks.push({
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'image',
        text: match[1],
        marks: [],
        checked: false,
      });
    } else {
      blocks.push({
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'paragraph',
        text: trimmed,
        indent,
        marks: [],
        checked: false,
      });
    }
  }

  if (inCode && codeBuffer.length > 0) {
    blocks.push({
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      type: 'code',
      text: codeBuffer.join('\n'),
      marks: [],
      checked: false,
    });
  }

  return blocks.length ? blocks : [{
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    type: 'paragraph',
    text: '',
    marks: [],
    checked: false,
  }];
}

export function downloadMarkdownFile(filename, content) {
  const cleanName = (filename || 'Untitled note').replace(/[^a-zA-Z0-9-_\s]/g, '').trim() || 'note';
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanName}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
