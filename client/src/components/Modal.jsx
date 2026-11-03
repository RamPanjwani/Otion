import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export default function Modal({ open, onClose, title, children }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
    window.requestAnimationFrame(() => dialog?.querySelector(focusableSelector)?.focus());
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll(focusableSelector)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
        <motion.section initial={{ opacity: 0, scale: 0.985, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.99, y: 5 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="elevated-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl" onMouseDown={(event) => event.stopPropagation()}>
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 id={titleId} className="text-base font-semibold tracking-[-0.015em]">{title}</h2>
            <button type="button" onClick={onClose} className="icon-action h-8 w-8" aria-label="Close modal"><X size={17} /></button>
          </header>
          {children}
        </motion.section>
      </motion.div>}
    </AnimatePresence>
  );
}
