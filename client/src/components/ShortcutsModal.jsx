import { Command, Keyboard } from 'lucide-react';
import Modal from './Modal';

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation & Workspace',
    shortcuts: [
      { keys: ['Ctrl', 'K'], label: 'Open search command palette' },
      { keys: ['Ctrl', '\\'], label: 'Toggle sidebar collapsed state' },
      { keys: ['Ctrl', 'S'], label: 'Save note immediately' },
      { keys: ['Ctrl', '/'], label: 'Open keyboard shortcuts' },
    ],
  },
  {
    title: 'Text Formatting',
    shortcuts: [
      { keys: ['Ctrl', 'B'], label: 'Bold text' },
      { keys: ['Ctrl', 'I'], label: 'Italic text' },
      { keys: ['Ctrl', 'U'], label: 'Underline text' },
      { keys: ['Ctrl', 'Shift', 'X'], label: 'Strikethrough text' },
      { keys: ['Ctrl', 'Alt', '1-3'], label: 'Turn into Heading 1, 2, or 3' },
    ],
  },
  {
    title: 'List Indentation',
    shortcuts: [
      { keys: ['Tab'], label: 'Indent list item (nest deeper)' },
      { keys: ['Shift', 'Tab'], label: 'Outdent list item' },
      { keys: ['Backspace'], label: 'Unindent list item at start of line' },
    ],
  },
  {
    title: 'Markdown Shortcuts',
    shortcuts: [
      { keys: ['#', 'Space'], label: 'Heading 1' },
      { keys: ['##', 'Space'], label: 'Heading 2' },
      { keys: ['###', 'Space'], label: 'Heading 3' },
      { keys: ['-', 'Space'], label: 'Bullet list' },
      { keys: ['1.', 'Space'], label: 'Numbered list' },
      { keys: ['[]', 'Space'], label: 'Task checkbox' },
      { keys: ['>', 'Space'], label: 'Quote' },
      { keys: ['---'], label: 'Horizontal divider' },
      { keys: ['```', 'Space'], label: 'Code block' },
      { keys: ['/'], label: 'Open block commands menu' },
    ],
  },
];

export default function ShortcutsModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts">
      <div className="max-h-[70vh] overflow-y-auto p-6 space-y-6 otion-scrollbar">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              {group.title}
            </h3>
            <div className="space-y-2">
              {group.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.label}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-muted">{shortcut.label}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key) => (
                      <kbd
                        key={key}
                        className="rounded border border-line bg-panel px-1.5 py-0.5 text-[11px] font-mono text-ink shadow-xs"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
