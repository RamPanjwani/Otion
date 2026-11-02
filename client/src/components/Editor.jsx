import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold, CheckSquare, Code2, Heading1, Heading2, Heading3, Image, Italic, Link2, List,
  ListOrdered, MessageSquareQuote, Minus, RemoveFormatting, Sparkles, Strikethrough,
  Table2, Text, Underline,
} from 'lucide-react';

const commandItems = [
  { type: 'paragraph', label: 'Text', icon: Text },
  { type: 'h1', label: 'Heading 1', icon: Heading1 },
  { type: 'h2', label: 'Heading 2', icon: Heading2 },
  { type: 'h3', label: 'Heading 3', icon: Heading3 },
  { type: 'task', label: 'Task list', icon: CheckSquare },
  { type: 'bullet', label: 'Bulleted list', icon: List },
  { type: 'numbered', label: 'Numbered list', icon: ListOrdered },
  { type: 'quote', label: 'Quote', icon: MessageSquareQuote },
  { type: 'callout', label: 'Callout', icon: Sparkles },
  { type: 'code', label: 'Code block', icon: Code2 },
  { type: 'divider', label: 'Divider', icon: Minus },
  { type: 'image', label: 'Image URL', icon: Image },
  { type: 'table', label: 'Table (tab separated)', icon: Table2 },
];

const makeBlock = (type = 'paragraph', text = '') => ({
  id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  type,
  text,
  marks: [],
  checked: false,
});

const blockStyles = {
  h1: 'text-3xl font-bold leading-tight mt-8 mb-3',
  h2: 'text-2xl font-semibold leading-tight mt-7 mb-2',
  h3: 'text-xl font-semibold leading-tight mt-6 mb-2',
  paragraph: 'text-[15px] leading-7',
  code: 'my-3 rounded-xl border border-line bg-panel p-4 font-mono text-sm leading-6 whitespace-pre-wrap',
  task: 'text-[15px] leading-7',
  bullet: 'text-[15px] leading-7',
  numbered: 'text-[15px] leading-7',
  quote: 'my-3 border-l-4 border-ink/25 pl-4 text-[15px] italic leading-7 text-muted',
  callout: 'my-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[15px] leading-7 dark:border-amber-900 dark:bg-amber-950/30',
  table: 'surface-card my-3 rounded-xl p-3 font-mono text-sm leading-7 whitespace-pre-wrap',
};

export default function Editor({ value = [], onChange, onFormat, readOnly = false }) {
  const blocks = useMemo(() => (value.length ? value : [makeBlock()]), [value]);
  const blocksRef = useRef(blocks);
  const rootRef = useRef(null);
  const formattingRef = useRef(null);
  const selectionRef = useRef([]);
  const [selectionRanges, setSelectionRanges] = useState([]);
  const [toolbarPosition, setToolbarPosition] = useState(null);
  const [menuBlockId, setMenuBlockId] = useState(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [editorError, setEditorError] = useState('');

  useEffect(() => { blocksRef.current = blocks; }, [blocks]);

  const commit = (next) => onChange?.(next);
  const patchBlock = (id, patch) => commit(blocksRef.current.map((block) => (block.id === id ? { ...block, ...patch } : block)));

  const captureSelection = useCallback(() => {
    const selection = window.getSelection();
    const root = rootRef.current;
    const focusedInToolbar = formattingRef.current?.contains(document.activeElement);
    if (!root || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      if (!focusedInToolbar) {
        selectionRef.current = [];
        setSelectionRanges([]);
        setToolbarPosition(null);
        setLinkOpen(false);
      }
      return;
    }
    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
      if (!focusedInToolbar) {
        selectionRef.current = [];
        setSelectionRanges([]);
        setToolbarPosition(null);
      }
      return;
    }
    const startBlock = closestBlock(range.startContainer);
    const endBlock = closestBlock(range.endContainer);
    if (!startBlock || !endBlock) return;
    const elements = [...root.querySelectorAll('[data-editable-block="true"]')];
    const startIndex = elements.indexOf(startBlock);
    const endIndex = elements.indexOf(endBlock);
    if (startIndex < 0 || endIndex < 0) return;
    const ranges = elements.slice(startIndex, endIndex + 1).map((element, index, selected) => ({
      blockId: element.dataset.blockId,
      from: index === 0 ? textOffset(element, range.startContainer, range.startOffset) : 0,
      to: index === selected.length - 1 ? textOffset(element, range.endContainer, range.endOffset) : element.textContent.length,
    })).filter((item) => item.to > item.from);
    selectionRef.current = ranges;
    setSelectionRanges(ranges);
    const bounds = range.getBoundingClientRect();
    setToolbarPosition({
      left: Math.max(176, Math.min(window.innerWidth - 176, bounds.left + (bounds.width / 2))),
      top: Math.max(72, bounds.top - 48),
    });
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', captureSelection);
    return () => document.removeEventListener('selectionchange', captureSelection);
  }, [captureSelection]);

  const attributeActive = (attribute) => selectionRanges.length > 0 && selectionRanges.every((range) => {
    const block = blocks.find((item) => item.id === range.blockId);
    let coveredUntil = range.from;
    (block?.marks || []).filter((mark) => mark.attributes?.[attribute] && mark.to > range.from && mark.from < range.to)
      .sort((a, b) => a.from - b.from)
      .forEach((mark) => { if (mark.from <= coveredUntil) coveredUntil = Math.max(coveredUntil, mark.to); });
    return coveredUntil >= range.to;
  });

  const applyFormat = (attribute) => {
    const ranges = selectionRef.current;
    if (!ranges.length) return;
    const active = attributeActive(attribute);
    onFormat?.(ranges, { [attribute]: active ? null : true });
  };

  const applyLink = (event) => {
    event.preventDefault();
    const ranges = selectionRef.current;
    if (!ranges.length) return;
    const normalized = linkValue.trim() && !/^(https?:\/\/|mailto:)/i.test(linkValue.trim()) ? `https://${linkValue.trim()}` : linkValue.trim();
    try { if (normalized) new URL(normalized); } catch { setEditorError('Enter a valid link URL'); return; }
    onFormat?.(ranges, { link: normalized || null });
    setLinkOpen(false);
    setLinkValue('');
    selectionRef.current = [];
    setSelectionRanges([]);
    setToolbarPosition(null);
  };

  const clearFormatting = () => {
    if (!selectionRef.current.length) return;
    onFormat?.(selectionRef.current, { bold: null, italic: null, underline: null, strike: null, code: null, link: null });
  };

  const handleInput = (block, event) => {
    const text = event.currentTarget.textContent || '';
    patchBlock(block.id, { text });
    setMenuBlockId(text === '/' ? block.id : null);
  };

  const handleKeyDown = (block, index, event) => {
    if ((event.metaKey || event.ctrlKey) && ['b', 'i', 'u', 'k'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      captureSelection();
      if (event.key.toLowerCase() === 'k') setLinkOpen(true);
      else applyFormat({ b: 'bold', i: 'italic', u: 'underline' }[event.key.toLowerCase()]);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'x') {
      event.preventDefault();
      captureSelection();
      applyFormat('strike');
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.altKey && ['1', '2', '3'].includes(event.key)) {
      event.preventDefault();
      setType(block.id, `h${event.key}`);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const next = [...blocks];
      next.splice(index + 1, 0, makeBlock());
      commit(next);
      setMenuBlockId(null);
      window.setTimeout(() => rootRef.current?.querySelector(`[data-block-index="${index + 1}"]`)?.focus(), 0);
    }
    if (event.key === 'Backspace' && !block.text && blocks.length > 1) {
      event.preventDefault();
      commit(blocks.filter((item) => item.id !== block.id));
      window.setTimeout(() => rootRef.current?.querySelector(`[data-block-index="${Math.max(0, index - 1)}"]`)?.focus(), 0);
    }
  };

  const setType = (blockId, type) => {
    const element = rootRef.current?.querySelector(`[data-block-id="${blockId}"]`);
    if (element) element.textContent = '';
    if (type === 'divider') {
      const index = blocks.findIndex((block) => block.id === blockId);
      const next = blocks.map((block) => block.id === blockId ? { ...block, type: 'divider', text: '', marks: [] } : block);
      next.splice(index + 1, 0, makeBlock());
      commit(next);
      window.setTimeout(() => rootRef.current?.querySelector(`[data-block-index="${index + 1}"]`)?.focus(), 0);
    } else patchBlock(blockId, { type, text: '', marks: [] });
    setMenuBlockId(null);
  };

  return <div ref={rootRef} className="relative pb-56">
    {!readOnly && selectionRanges.length > 0 && toolbarPosition && <div ref={formattingRef} className="elevated-panel fixed z-50 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-0.5 rounded-2xl p-1.5" style={{ left: toolbarPosition.left, top: toolbarPosition.top }} role="toolbar" aria-label="Format selected text">
      <FormatButton label="Bold" active={attributeActive('bold')} onClick={() => applyFormat('bold')}><Bold size={16} /></FormatButton>
      <FormatButton label="Italic" active={attributeActive('italic')} onClick={() => applyFormat('italic')}><Italic size={16} /></FormatButton>
      <FormatButton label="Underline" active={attributeActive('underline')} onClick={() => applyFormat('underline')}><Underline size={16} /></FormatButton>
      <FormatButton label="Strikethrough" active={attributeActive('strike')} onClick={() => applyFormat('strike')}><Strikethrough size={16} /></FormatButton>
      <FormatButton label="Inline code" active={attributeActive('code')} onClick={() => applyFormat('code')}><Code2 size={16} /></FormatButton>
      <div className="relative"><FormatButton label="Link" active={attributeActive('link')} onClick={() => setLinkOpen((current) => !current)}><Link2 size={16} /></FormatButton>{linkOpen && <form onSubmit={applyLink} className="elevated-panel absolute left-0 top-11 z-40 flex w-72 gap-2 rounded-xl p-2"><input value={linkValue} onChange={(event) => setLinkValue(event.target.value)} autoFocus placeholder="https://example.com" className="field-control min-w-0 flex-1 px-2 py-1 text-sm" /><button className="primary-action px-3 text-xs">Apply</button></form>}</div>
      <FormatButton label="Clear formatting" onClick={clearFormatting}><RemoveFormatting size={16} /></FormatButton>
    </div>}
    {editorError && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{editorError}</p>}
    <div className="space-y-1">{blocks.map((block, index) => <div key={block.id} className="group relative flex items-start gap-2">
      {block.type === 'task' && <input type="checkbox" checked={Boolean(block.checked)} disabled={readOnly} onChange={(event) => patchBlock(block.id, { checked: event.target.checked })} className="mt-1.5 h-4 w-4 accent-ink" />}
      {block.type === 'bullet' && <span className="mt-1 text-muted">•</span>}
      {block.type === 'numbered' && <span className="mt-1 min-w-5 text-right text-muted">{index + 1}.</span>}
      {block.type === 'callout' && <span className="mt-3">💡</span>}
      {block.type === 'divider' ? <hr data-block-id={block.id} className="my-6 flex-1 border-line" /> : <div className="min-w-0 flex-1">
        {block.type === 'image' && /^https?:\/\//i.test(block.text) && <img src={block.text} alt="Note image" className="mt-2 max-h-96 w-full rounded-xl object-contain" />}
        <EditableBlock text={block.text} marks={block.marks || []} readOnly={readOnly} blockId={block.id} data-block-index={index} placeholder={block.type === 'image' ? 'Paste an image URL…' : index === blocks.length - 1 ? "Type '/' for commands" : ''} className={`editor-block min-h-7 w-full outline-none ${blockStyles[block.type] || 'text-[15px] leading-7'} ${block.checked ? 'text-muted line-through' : ''}`} onInput={(event) => handleInput(block, event)} onKeyDown={(event) => handleKeyDown(block, index, event)} onPaste={insertPlainText} />
      </div>}
      {menuBlockId === block.id && <div className="elevated-panel absolute left-0 top-9 z-30 max-h-96 w-64 overflow-y-auto rounded-2xl p-2"><p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted">Blocks</p>{commandItems.map(({ type, label, icon: Icon }) => <button key={type} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setType(block.id, type)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-muted transition hover:bg-panel hover:text-ink"><Icon size={17} />{label}</button>)}</div>}
    </div>)}</div>
  </div>;
}

function FormatButton({ label, active = false, onClick, children }) {
  return <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onClick} aria-label={label} aria-pressed={active} className={`icon-action h-8 w-8 ${active ? 'bg-accent-soft text-accent' : ''}`}>{children}</button>;
}

function EditableBlock({ text, marks, readOnly, blockId, placeholder, className, onInput, onKeyDown, ...attributes }) {
  const elementRef = useRef(null);
  const renderedRef = useRef('');
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const signature = JSON.stringify(marks);
    if (element.textContent === text && renderedRef.current === signature) return;
    const savedSelection = document.activeElement === element ? selectionOffsets(element) : null;
    renderMarkedText(element, text || '', marks);
    renderedRef.current = signature;
    if (savedSelection) restoreSelection(element, savedSelection);
  }, [marks, text]);

  return <div {...attributes} ref={elementRef} contentEditable={!readOnly} suppressContentEditableWarning data-editable-block="true" data-block-id={blockId} data-placeholder={placeholder} className={className} onInput={onInput} onKeyDown={onKeyDown} />;
}

function renderMarkedText(element, text, marks) {
  element.replaceChildren();
  if (!text) return;
  const boundaries = new Set([0, text.length]);
  marks.forEach((mark) => { boundaries.add(Math.max(0, Math.min(text.length, mark.from))); boundaries.add(Math.max(0, Math.min(text.length, mark.to))); });
  const points = [...boundaries].sort((a, b) => a - b);
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (to <= from) continue;
    const attributes = Object.assign({}, ...marks.filter((mark) => mark.from <= from && mark.to >= to).map((mark) => mark.attributes));
    const node = safeLink(attributes.link) ? document.createElement('a') : document.createElement('span');
    node.textContent = text.slice(from, to);
    if (attributes.bold) node.style.fontWeight = '700';
    if (attributes.italic) node.style.fontStyle = 'italic';
    const decorations = [attributes.underline && 'underline', attributes.strike && 'line-through'].filter(Boolean);
    if (decorations.length) node.style.textDecoration = decorations.join(' ');
    if (attributes.code) node.className = 'rounded bg-panel px-1 py-0.5 font-mono text-[0.92em]';
    if (node.tagName === 'A') { node.href = attributes.link; node.target = '_blank'; node.rel = 'noreferrer'; node.classList.add('underline', 'decoration-dotted'); }
    element.appendChild(node);
  }
}

function safeLink(value) {
  if (!value) return false;
  try { return ['http:', 'https:', 'mailto:'].includes(new URL(value).protocol); } catch { return false; }
}

function closestBlock(node) {
  return (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest?.('[data-editable-block="true"]');
}

function textOffset(root, node, offset) {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

function pointAtOffset(root, target) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let node = walker.nextNode();
  while (node) {
    const next = consumed + node.textContent.length;
    if (target <= next) return { node, offset: Math.max(0, target - consumed) };
    consumed = next;
    node = walker.nextNode();
  }
  return { node: root, offset: root.childNodes.length };
}

function selectionOffsets(root) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  return { start: textOffset(root, range.startContainer, range.startOffset), end: textOffset(root, range.endContainer, range.endOffset) };
}

function restoreSelection(root, offsets) {
  const selection = window.getSelection();
  const start = pointAtOffset(root, offsets.start);
  const end = pointAtOffset(root, offsets.end);
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertPlainText(event) {
  event.preventDefault();
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(event.clipboardData.getData('text/plain'));
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  event.currentTarget.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
}
