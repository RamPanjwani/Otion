import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold, CheckSquare, Code2, Copy, GripVertical, Heading1, Heading2, Heading3, Image,
  Italic, Link2, List, ListOrdered, MessageSquareQuote, Minus, MoreHorizontal, Plus, RemoveFormatting,
  Sparkles, Strikethrough, Text, Trash2, Underline,
} from 'lucide-react';

const commandItems = [
  { type: 'paragraph', label: 'Text', hint: 'Plain text block', icon: Text },
  { type: 'h1', label: 'Heading 1', hint: 'Large section heading', icon: Heading1 },
  { type: 'h2', label: 'Heading 2', hint: 'Medium section heading', icon: Heading2 },
  { type: 'h3', label: 'Heading 3', hint: 'Small section heading', icon: Heading3 },
  { type: 'task', label: 'Task list', hint: 'Track work with a checkbox', icon: CheckSquare },
  { type: 'bullet', label: 'Bulleted list', hint: 'Create a simple list', icon: List },
  { type: 'numbered', label: 'Numbered list', hint: 'Create an ordered list', icon: ListOrdered },
  { type: 'quote', label: 'Quote', hint: 'Capture a quotation', icon: MessageSquareQuote },
  { type: 'callout', label: 'Callout', hint: 'Highlight important information', icon: Sparkles },
  { type: 'code', label: 'Code block', hint: 'Write formatted code', icon: Code2 },
  { type: 'divider', label: 'Divider', hint: 'Separate sections', icon: Minus },
  { type: 'image', label: 'Image URL', hint: 'Embed an image from a URL', icon: Image },
];

const makeBlock = (type = 'paragraph', text = '', indent = 0) => ({
  id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  type,
  text,
  indent: Math.max(0, Math.min(4, indent)),
  marks: [],
  checked: false,
});

const blockStyles = {
  h1: 'mt-8 mb-2 text-[2rem] font-bold leading-tight tracking-[-0.025em]',
  h2: 'mt-7 mb-2 text-[1.55rem] font-semibold leading-tight tracking-[-0.02em]',
  h3: 'mt-6 mb-1 text-xl font-semibold leading-tight',
  paragraph: 'text-[16px] leading-7',
  code: 'my-3 rounded-lg border border-line bg-panel px-4 py-3 font-mono text-sm leading-6 whitespace-pre-wrap',
  task: 'text-[15px] leading-7',
  bullet: 'text-[15px] leading-7',
  numbered: 'text-[15px] leading-7',
  quote: 'my-3 border-l-3 border-ink/30 pl-4 text-[16px] italic leading-7 text-muted',
  callout: 'my-3 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-[15px] leading-7 dark:border-amber-900 dark:bg-amber-950/30',
};

export default function Editor({ value = [], onChange, onFormat, readOnly = false, smallText = false }) {
  const blocks = useMemo(() => (value.length ? value : [makeBlock()]), [value]);
  const blocksRef = useRef(blocks);
  const rootRef = useRef(null);
  const formattingRef = useRef(null);
  const selectionRef = useRef([]);
  const [selectionRanges, setSelectionRanges] = useState([]);
  const [toolbarPosition, setToolbarPosition] = useState(null);
  const [menuBlockId, setMenuBlockId] = useState(null);
  const [menuIndex, setMenuIndex] = useState(0);
  const [slashQuery, setSlashQuery] = useState('');
  const [blockMenuId, setBlockMenuId] = useState(null);
  const [draggedBlockId, setDraggedBlockId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [editorError, setEditorError] = useState('');

  const visibleCommands = useMemo(() => {
    const query = slashQuery.trim().toLowerCase();
    if (!query) return commandItems;
    return commandItems.filter((item) => `${item.label} ${item.hint} ${item.type}`.toLowerCase().includes(query));
  }, [slashQuery]);

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

  useEffect(() => {
    if (!blockMenuId) return undefined;
    const closeMenu = (event) => {
      if (!event.target.closest('[data-block-menu]')) setBlockMenuId(null);
    };
    document.addEventListener('pointerdown', closeMenu);
    return () => document.removeEventListener('pointerdown', closeMenu);
  }, [blockMenuId]);

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

  const insertBlockAfter = (index, openCommands = false) => {
    const block = makeBlock();
    const next = [...blocksRef.current];
    next.splice(index + 1, 0, block);
    commit(next);
    setBlockMenuId(null);
    if (openCommands) {
      setMenuBlockId(block.id);
      setSlashQuery('');
      setMenuIndex(0);
    }
    window.setTimeout(() => focusBlockAtOffset(rootRef.current, block.id, 0), 0);
  };

  const duplicateBlock = (block, index) => {
    const duplicate = { ...block, id: makeBlock().id, marks: (block.marks || []).map((mark) => ({ ...mark, attributes: { ...mark.attributes } })) };
    const next = [...blocksRef.current];
    next.splice(index + 1, 0, duplicate);
    commit(next);
    setBlockMenuId(null);
    window.setTimeout(() => focusBlockAtOffset(rootRef.current, duplicate.id, duplicate.text.length), 0);
  };

  const deleteBlock = (block, index) => {
    if (blocksRef.current.length === 1) {
      commit([{ ...block, type: 'paragraph', text: '', marks: [], checked: false }]);
      window.setTimeout(() => focusBlockAtOffset(rootRef.current, block.id, 0), 0);
    } else {
      const next = blocksRef.current.filter((item) => item.id !== block.id);
      commit(next);
      window.setTimeout(() => focusNearestBlock(rootRef.current, next, Math.min(index, next.length - 1)), 0);
    }
    setBlockMenuId(null);
  };

  const reorderBlock = (targetId) => {
    if (!draggedBlockId || draggedBlockId === targetId) return;
    const next = [...blocksRef.current];
    const from = next.findIndex((block) => block.id === draggedBlockId);
    if (from < 0) return;
    const [moved] = next.splice(from, 1);
    const to = next.findIndex((block) => block.id === targetId);
    if (to < 0) return;
    next.splice(to, 0, moved);
    commit(next);
    setDraggedBlockId(null);
    setDropTargetId(null);
  };

  const transformBlock = (blockId, type, clearText = false) => {
    const next = blocksRef.current.map((block) => block.id === blockId ? {
      ...block,
      type,
      text: clearText ? '' : block.text,
      marks: clearText ? [] : block.marks,
      checked: type === 'task' ? Boolean(block.checked) : false,
    } : block);
    commit(next);
    setBlockMenuId(null);
    setMenuBlockId(null);
  };

  const handleInput = (block, event) => {
    const text = event.currentTarget.textContent || '';
    const shortcutType = markdownShortcut(text);
    if (shortcutType) {
      event.currentTarget.textContent = '';
      transformBlock(block.id, shortcutType, true);
      return;
    }
    patchBlock(block.id, { text });
    if (text.startsWith('/') && !text.includes(' ')) {
      setMenuBlockId(block.id);
      setSlashQuery(text.slice(1));
      setMenuIndex(0);
    } else {
      setMenuBlockId(null);
      setSlashQuery('');
    }
  };

  const handleKeyDown = (block, index, event) => {
    if (menuBlockId === block.id) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (visibleCommands.length) setMenuIndex((current) => (current + 1) % visibleCommands.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (visibleCommands.length) setMenuIndex((current) => (current - 1 + visibleCommands.length) % visibleCommands.length);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuBlockId(null);
        return;
      }
      if (event.key === 'Enter' && visibleCommands[menuIndex]) {
        event.preventDefault();
        setType(block.id, visibleCommands[menuIndex].type);
        return;
      }
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const currentIndent = block.indent || 0;
      const nextIndent = event.shiftKey ? Math.max(0, currentIndent - 1) : Math.min(4, currentIndent + 1);
      patchBlock(block.id, { indent: nextIndent });
      return;
    }
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
      if (['bullet', 'numbered', 'task'].includes(block.type) && !block.text) {
        transformBlock(block.id, 'paragraph');
        return;
      }
      if (block.text === '---') {
        const nextBlock = makeBlock();
        const next = blocksRef.current.map((item) => item.id === block.id ? { ...item, type: 'divider', text: '', marks: [] } : item);
        next.splice(index + 1, 0, nextBlock);
        commit(next);
        window.setTimeout(() => focusBlockAtOffset(rootRef.current, nextBlock.id, 0), 0);
        return;
      }
      const offsets = selectionOffsets(event.currentTarget) || { start: block.text.length, end: block.text.length };
      const before = block.text.slice(0, offsets.start);
      const after = block.text.slice(offsets.end);
      const nextBlock = makeBlock(listContinuationType(block.type), after, block.indent || 0);
      nextBlock.marks = marksAfterSplit(block.marks || [], offsets.end);
      const next = blocksRef.current.map((item) => item.id === block.id ? { ...item, text: before, marks: marksBeforeSplit(item.marks || [], offsets.start) } : item);
      next.splice(index + 1, 0, nextBlock);
      commit(next);
      setMenuBlockId(null);
      setSlashQuery('');
      window.setTimeout(() => focusBlockAtOffset(rootRef.current, nextBlock.id, 0), 0);
      return;
    }

    if (event.key === 'Backspace') {
      const offsets = selectionOffsets(event.currentTarget);
      if (!offsets || offsets.start !== offsets.end || offsets.start > 0) return;
      if (block.indent > 0) {
        event.preventDefault();
        patchBlock(block.id, { indent: block.indent - 1 });
        return;
      }
      if (block.type !== 'paragraph') {
        event.preventDefault();
        transformBlock(block.id, 'paragraph');
        return;
      }
      if (index === 0) return;
      event.preventDefault();
      const previous = blocksRef.current[index - 1];
      if (previous.type === 'divider') {
        commit(blocksRef.current.filter((item) => item.id !== previous.id));
        window.setTimeout(() => focusBlockAtOffset(rootRef.current, block.id, 0), 0);
        return;
      }
      const boundary = previous.text.length;
      const mergedMarks = [
        ...(previous.marks || []),
        ...(block.marks || []).map((mark) => ({ ...mark, from: mark.from + boundary, to: mark.to + boundary })),
      ];
      const next = blocksRef.current
        .filter((item) => item.id !== block.id)
        .map((item) => item.id === previous.id ? { ...item, text: previous.text + block.text, marks: mergedMarks } : item);
      commit(next);
      window.setTimeout(() => focusBlockAtOffset(rootRef.current, previous.id, boundary), 0);
      return;
    }

    if (event.key === 'Delete') {
      const offsets = selectionOffsets(event.currentTarget);
      if (!offsets || offsets.start !== offsets.end || offsets.end < block.text.length || index >= blocksRef.current.length - 1) return;
      event.preventDefault();
      const following = blocksRef.current[index + 1];
      if (following.type === 'divider') {
        commit(blocksRef.current.filter((item) => item.id !== following.id));
        return;
      }
      const boundary = block.text.length;
      const mergedMarks = [
        ...(block.marks || []),
        ...(following.marks || []).map((mark) => ({ ...mark, from: mark.from + boundary, to: mark.to + boundary })),
      ];
      const next = blocksRef.current
        .filter((item) => item.id !== following.id)
        .map((item) => item.id === block.id ? { ...item, text: block.text + following.text, marks: mergedMarks } : item);
      commit(next);
      window.setTimeout(() => focusBlockAtOffset(rootRef.current, block.id, boundary), 0);
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
    } else transformBlock(blockId, type, true);
    setMenuBlockId(null);
    setSlashQuery('');
  };

  return <div ref={rootRef} className={`relative pb-24 sm:pb-32 ${smallText ? 'editor-density-small' : ''}`}>
    {!readOnly && selectionRanges.length > 0 && toolbarPosition && <div ref={formattingRef} className="selection-toolbar fixed z-50 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-0.5 rounded-lg p-1" style={{ left: toolbarPosition.left, top: toolbarPosition.top }} role="toolbar" aria-label="Format selected text">
      <FormatButton label="Bold" active={attributeActive('bold')} onClick={() => applyFormat('bold')}><Bold size={16} /></FormatButton>
      <FormatButton label="Italic" active={attributeActive('italic')} onClick={() => applyFormat('italic')}><Italic size={16} /></FormatButton>
      <FormatButton label="Underline" active={attributeActive('underline')} onClick={() => applyFormat('underline')}><Underline size={16} /></FormatButton>
      <FormatButton label="Strikethrough" active={attributeActive('strike')} onClick={() => applyFormat('strike')}><Strikethrough size={16} /></FormatButton>
      <FormatButton label="Inline code" active={attributeActive('code')} onClick={() => applyFormat('code')}><Code2 size={16} /></FormatButton>
      <div className="relative"><FormatButton label="Link" active={attributeActive('link')} onClick={() => setLinkOpen((current) => !current)}><Link2 size={16} /></FormatButton>{linkOpen && <form onSubmit={applyLink} className="elevated-panel absolute left-0 top-11 z-40 flex w-72 gap-2 rounded-xl p-2"><input value={linkValue} onChange={(event) => setLinkValue(event.target.value)} autoFocus placeholder="https://example.com" className="field-control min-w-0 flex-1 px-2 py-1 text-sm" /><button className="primary-action px-3 text-xs">Apply</button></form>}</div>
      <FormatButton label="Clear formatting" onClick={clearFormatting}><RemoveFormatting size={16} /></FormatButton>
    </div>}
    {editorError && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{editorError}</p>}
    <div className="space-y-0.5">{blocks.map((block, index) => <div
      key={block.id}
      data-block-type={block.type}
      className={`notion-block group relative flex min-h-8 items-start gap-2 rounded-sm ${dropTargetId === block.id && draggedBlockId !== block.id ? 'notion-block-drop-target' : ''}`}
      style={{
        '--block-control-offset': blockControlOffset(block.type),
        marginLeft: block.indent ? `${block.indent * 1.5}rem` : undefined,
      }}
      onDragOver={(event) => { if (!readOnly) { event.preventDefault(); setDropTargetId(block.id); } }}
      onDragLeave={() => setDropTargetId((current) => current === block.id ? null : current)}
      onDrop={(event) => { event.preventDefault(); reorderBlock(block.id); }}
    >
      {!readOnly && <div className="notion-block-gutter absolute -left-14 hidden h-8 items-center gap-0.5 sm:flex" data-block-menu>
        <button type="button" onClick={() => insertBlockAfter(index, true)} className="notion-gutter-button" aria-label="Add block below" title="Add block"><Plus size={16} /></button>
        <button type="button" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDraggedBlockId(block.id); setBlockMenuId(null); }} onDragEnd={() => { setDraggedBlockId(null); setDropTargetId(null); }} onClick={() => setBlockMenuId((current) => current === block.id ? null : block.id)} className="notion-gutter-button cursor-grab active:cursor-grabbing" aria-label="Drag or open block actions" aria-expanded={blockMenuId === block.id} title="Drag to move, click for actions"><GripVertical size={16} /></button>
      </div>}
      {!readOnly && <button type="button" data-block-menu onClick={() => setBlockMenuId((current) => current === block.id ? null : block.id)} className="notion-mobile-block-menu notion-gutter-button absolute -right-7 sm:hidden" aria-label="Open block actions" aria-expanded={blockMenuId === block.id}><MoreHorizontal size={16} /></button>}

      {block.type === 'task' && <input type="checkbox" checked={Boolean(block.checked)} disabled={readOnly} onChange={(event) => patchBlock(block.id, { checked: event.target.checked })} className="mt-1.5 h-4 w-4 shrink-0 accent-ink" />}
      {block.type === 'bullet' && <span className="mt-0.5 w-4 shrink-0 text-center text-ink">•</span>}
      {block.type === 'numbered' && <span className="mt-0.5 min-w-5 shrink-0 text-right text-muted">{numberedListIndex(blocks, index)}.</span>}
      {block.type === 'callout' && <span className="mt-3 shrink-0">💡</span>}
      {block.type === 'divider' ? <hr data-block-id={block.id} className="my-6 flex-1 border-line" /> : <div className="min-w-0 flex-1">
        {block.type === 'image' && /^https?:\/\//i.test(block.text) && <img src={block.text} alt="Note image" className="mb-2 mt-2 max-h-96 w-full rounded-lg border border-line object-contain" />}
        <EditableBlock text={block.text} marks={block.marks || []} readOnly={readOnly} blockId={block.id} data-block-index={index} placeholder={block.type === 'image' ? 'Paste an image URL…' : index === blocks.length - 1 ? "Type '/' for commands" : ''} className={`editor-block min-h-7 w-full outline-none ${blockStyles[block.type] || 'text-[15px] leading-7'} ${block.checked ? 'text-muted line-through' : ''}`} onInput={(event) => handleInput(block, event)} onKeyDown={(event) => handleKeyDown(block, index, event)} onPaste={insertPlainText} />
      </div>}

      {blockMenuId === block.id && <BlockActionMenu block={block} index={index} onTransform={(type) => transformBlock(block.id, type)} onDuplicate={() => duplicateBlock(block, index)} onDelete={() => deleteBlock(block, index)} />}

      {menuBlockId === block.id && <div className="slash-command-menu absolute left-0 top-9 z-30 max-h-[min(440px,55vh)] w-72 overflow-y-auto rounded-xl p-1.5"><p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Basic blocks</p>{visibleCommands.length ? visibleCommands.map(({ type, label, hint, icon: Icon }, commandIndex) => <button key={type} type="button" onMouseEnter={() => setMenuIndex(commandIndex)} onMouseDown={(event) => event.preventDefault()} onClick={() => setType(block.id, type)} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${menuIndex === commandIndex ? 'bg-panel text-ink' : 'text-muted hover:bg-panel hover:text-ink'}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line bg-surface text-ink"><Icon size={17} /></span><span className="min-w-0"><span className="block text-sm font-medium text-ink">{label}</span><span className="block truncate text-xs text-muted">{hint}</span></span></button>) : <p className="px-3 py-8 text-center text-sm text-muted">No matching blocks</p>}</div>}
    </div>)}</div>
  </div>;
}

function FormatButton({ label, active = false, onClick, children }) {
  return <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onClick} aria-label={label} aria-pressed={active} className={`icon-action h-8 w-8 ${active ? 'bg-accent-soft text-accent' : ''}`}>{children}</button>;
}

function BlockActionMenu({ block, index, onTransform, onDuplicate, onDelete }) {
  const transformItems = commandItems.filter((item) => ['paragraph', 'h1', 'h2', 'h3', 'task', 'bullet', 'numbered', 'quote', 'callout', 'code'].includes(item.type));
  return <div data-block-menu className="block-action-menu absolute left-0 z-40 w-64 rounded-xl p-1.5">
    <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Turn into</p>
    <div className="grid grid-cols-2 gap-0.5">{transformItems.map(({ type, label, icon: Icon }) => <button key={type} type="button" onClick={() => onTransform(type)} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-panel ${block.type === type ? 'bg-panel font-medium text-ink' : 'text-muted'}`}><Icon size={14} /><span className="truncate">{label}</span></button>)}</div>
    <div className="my-1 border-t border-line" />
    <button type="button" onClick={onDuplicate} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted transition hover:bg-panel hover:text-ink"><Copy size={15} /> Duplicate block</button>
    <button type="button" onClick={onDelete} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"><Trash2 size={15} /> Delete block <span className="ml-auto text-[10px] text-muted">#{index + 1}</span></button>
  </div>;
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

function focusBlockAtOffset(root, blockId, offset) {
  if (!root) return;
  const element = [...root.querySelectorAll('[data-editable-block="true"]')].find((candidate) => candidate.dataset.blockId === blockId);
  if (!element) return;
  element.focus();
  const point = pointAtOffset(element, Math.max(0, Math.min(element.textContent.length, offset)));
  const range = document.createRange();
  range.setStart(point.node, point.offset);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function focusNearestBlock(root, blocks, index) {
  const block = blocks[index] || blocks[index - 1];
  if (block) focusBlockAtOffset(root, block.id, block.text?.length || 0);
}

function markdownShortcut(text) {
  return ({
    '# ': 'h1',
    '## ': 'h2',
    '### ': 'h3',
    '- ': 'bullet',
    '* ': 'bullet',
    '1. ': 'numbered',
    '[] ': 'task',
    '[ ] ': 'task',
    '> ': 'quote',
    '``` ': 'code',
  })[text] || null;
}

function listContinuationType(type) {
  return ['bullet', 'numbered', 'task'].includes(type) ? type : 'paragraph';
}

function marksBeforeSplit(marks, offset) {
  return marks
    .filter((mark) => mark.from < offset)
    .map((mark) => ({ ...mark, to: Math.min(mark.to, offset), attributes: { ...mark.attributes } }))
    .filter((mark) => mark.to > mark.from);
}

function marksAfterSplit(marks, offset) {
  return marks
    .filter((mark) => mark.to > offset)
    .map((mark) => ({ ...mark, from: Math.max(mark.from, offset) - offset, to: mark.to - offset, attributes: { ...mark.attributes } }))
    .filter((mark) => mark.to > mark.from);
}

function numberedListIndex(blocks, index) {
  const currentIndent = blocks[index]?.indent || 0;
  let value = 1;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (blocks[cursor].type !== 'numbered') break;
    const prevIndent = blocks[cursor].indent || 0;
    if (prevIndent < currentIndent) break;
    if (prevIndent === currentIndent) value += 1;
  }
  return value;
}

function blockControlOffset(type) {
  if (type === 'h1') return '2rem';
  if (type === 'h2') return '1.75rem';
  if (['h3', 'divider'].includes(type)) return '1.5rem';
  if (['code', 'quote', 'callout'].includes(type)) return '0.75rem';
  return '0rem';
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
