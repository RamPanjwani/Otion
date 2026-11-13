import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastContext } from './ToastContextInstance';

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(({ title, message, type = 'info', duration = 4000 }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast = { id, title, message, type };
    setToasts((current) => [...current, toast]);

    if (duration > 0) {
      window.setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  const success = useCallback((message, title) => showToast({ message, title, type: 'success' }), [showToast]);
  const error = useCallback((message, title) => showToast({ message, title, type: 'error' }), [showToast]);
  const info = useCallback((message, title) => showToast({ message, title, type: 'info' }), [showToast]);

  const value = useMemo(() => ({
    showToast,
    removeToast,
    success,
    error,
    info,
  }), [showToast, removeToast, success, error, info]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 left-4 right-4 z-50 flex flex-col gap-2 sm:left-auto sm:right-5 sm:w-full sm:max-w-sm sm:px-0"
      >
        <AnimatePresence mode="sync">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              role="alert"
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-xl ring-1 ring-black/5 dark:ring-white/10"
            >
              <span className="mt-0.5 shrink-0">
                {toast.type === 'success' && <CheckCircle2 size={18} className="text-emerald-500" />}
                {toast.type === 'error' && <AlertCircle size={18} className="text-rose-500" />}
                {toast.type === 'info' && <Info size={18} className="text-accent" />}
              </span>
              <div className="min-w-0 flex-1">
                {toast.title && <p className="text-xs font-semibold text-ink">{toast.title}</p>}
                <p className="text-xs leading-5 text-muted">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="icon-action -mr-1 -mt-1 h-6 w-6 text-muted hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X size={13} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
