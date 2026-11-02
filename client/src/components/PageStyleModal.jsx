import Modal from './Modal';

const emojis = ['📄', '📝', '💡', '📌', '🚀', '🎯', '✅', '📚', '🧠', '🗓️', '💬', '⚡'];

export default function PageStyleModal({ open, onClose, value, onChange, onApply }) {
  const submit = (event) => {
    event.preventDefault();
    onApply();
  };
  return <Modal open={open} onClose={onClose} title="Choose note emoji">
    <form onSubmit={submit} className="space-y-6 p-6">
      <fieldset><legend className="mb-3 text-sm font-semibold">Note emoji</legend><div className="grid grid-cols-6 gap-2">{emojis.map((emoji) => <button key={emoji} type="button" onClick={() => onChange({ ...value, icon: emoji })} className={`grid h-11 place-items-center rounded-xl border text-xl transition hover:-translate-y-px hover:bg-panel ${value.icon === emoji ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-line'}`} aria-label={`Use ${emoji} emoji`}>{emoji}</button>)}</div><input value={value.icon} onChange={(event) => onChange({ ...value, icon: event.target.value.slice(0, 8) || '📝' })} maxLength={8} placeholder="Or enter an emoji" className="field-control mt-3 px-3 py-2" /></fieldset>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="secondary-action px-4 py-2 text-sm">Cancel</button><button type="submit" className="primary-action px-4 py-2 text-sm">Apply</button></div>
    </form>
  </Modal>;
}
