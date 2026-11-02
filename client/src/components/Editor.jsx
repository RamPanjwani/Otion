import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, Code2, Heading1, Heading2, Heading3, Text } from 'lucide-react';

const commandItems = [
  { type: 'paragraph', label: 'Text', icon: Text },
  { type: 'h1', label: 'Heading 1', icon: Heading1 },
  { type: 'h2', label: 'Heading 2', icon: Heading2 },
  { type: 'h3', label: 'Heading 3', icon: Heading3 },
  { type: 'task', label: 'Task list', icon: CheckSquare },
  { type: 'code', label: 'Code block', icon: Code2 },
];

const makeBlock = (type = 'paragraph', text = '') => ({
  id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  type,
  text,
  checked: false,
});

export default function Editor({ value = [], onChange, readOnly = false }) {
  const blocks = useMemo(() => (value.length ? value : [makeBlock()]), [value]);
  const [menuBlockId, setMenuBlockId] = useState(null);

  const commit = (next) => onChange?.(next);
  const patchBlock = (id, patch) => commit(blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)));

  const handleInput = (block, event) => {
    const text = event.currentTarget.textContent || '';
    patchBlock(block.id, { text });
    setMenuBlockId(text === '/' ? block.id : null);
  };

  const handleKeyDown = (block, index, event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const next = [...blocks];
      next.splice(index + 1, 0, makeBlock());
      commit(next);
      setMenuBlockId(null);
      window.setTimeout(() => document.querySelector(`[data-block-index="${index + 1}"]`)?.focus(), 0);
    }
    if (event.key === 'Backspace' && !block.text && blocks.length > 1) {
      event.preventDefault();
      commit(blocks.filter((item) => item.id !== block.id));
      window.setTimeout(() => document.querySelector(`[data-block-index="${Math.max(0, index - 1)}"]`)?.focus(), 0);
    }
  };

  const setType = (blockId, type) => {
    const element = document.querySelector(`[data-block-id="${blockId}"]`);
    if (element) element.textContent = '';
    patchBlock(blockId, { type, text: '' });
    setMenuBlockId(null);
  };

  return (
    <div className="relative space-y-1 pb-56">
      {blocks.map((block, index) => {
        const styles = {
          h1: 'text-3xl font-bold leading-tight mt-8 mb-3',
          h2: 'text-2xl font-semibold leading-tight mt-7 mb-2',
          h3: 'text-xl font-semibold leading-tight mt-6 mb-2',
          paragraph: 'text-[15px] leading-7',
          code: 'my-3 rounded-xl border border-line bg-panel p-4 font-mono text-sm leading-6 whitespace-pre-wrap',
          task: 'text-[15px] leading-7',
        }[block.type] || 'text-[15px] leading-7';
        return (
          <div key={block.id} className="group relative flex items-start gap-2">
            {block.type === 'task' && <input type="checkbox" checked={Boolean(block.checked)} disabled={readOnly} onChange={(event) => patchBlock(block.id, { checked: event.target.checked })} className="mt-1.5 h-4 w-4 accent-ink" />}
            <EditableBlock
              text={block.text}
              readOnly={readOnly}
              blockId={block.id}
              data-block-index={index}
              placeholder={index === blocks.length - 1 ? "Type '/' for commands" : ''}
              className={`editor-block min-h-7 flex-1 outline-none ${styles} ${block.checked ? 'text-muted line-through' : ''}`}
              onInput={(event) => handleInput(block, event)}
              onKeyDown={(event) => handleKeyDown(block, index, event)}
            />
            {menuBlockId === block.id && (
              <div className="absolute left-0 top-9 z-30 w-64 rounded-xl border border-line bg-white p-2 shadow-xl">
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted">Basic blocks</p>
                {commandItems.map(({ type, label, icon: Icon }) => <button key={type} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setType(block.id, type)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-panel"><Icon size={17} />{label}</button>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EditableBlock({ text, readOnly, blockId, placeholder, className, onInput, onKeyDown, ...attributes }) {
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || element.textContent === text) return;
    if (readOnly || document.activeElement !== element) element.textContent = text || '';
  }, [text, readOnly]);

  return (
    <div
      {...attributes}
      ref={elementRef}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      data-block-id={blockId}
      data-placeholder={placeholder}
      className={className}
      onInput={onInput}
      onKeyDown={onKeyDown}
    />
  );
}
