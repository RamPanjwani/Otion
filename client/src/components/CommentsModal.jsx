import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, MessageSquare, RotateCcw } from 'lucide-react';
import Modal from './Modal';
import api from '../services/api';
import { socket } from '../services/socket';

export default function CommentsModal({ open, onClose, noteId, canResolve }) {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get(`/comments/note/${noteId}`);
    setComments(data);
  }, [noteId]);

  useEffect(() => {
    if (!open || !noteId) return undefined;
    let active = true;
    api.get(`/comments/note/${noteId}`)
      .then(({ data }) => { if (active) { setComments(data); setError(''); } })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to load comments'); });
    const sync = () => load().catch(() => undefined);
    socket.on('comments-sync', sync);
    return () => { active = false; socket.off('comments-sync', sync); };
  }, [load, noteId, open]);

  const submit = async (event) => {
    event.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/comments/note/${noteId}`, { content: content.trim() });
      setComments((current) => current.some((comment) => comment._id === data._id) ? current : [...current, data]);
      setContent('');
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const setResolved = async (comment, resolved) => {
    const { data } = await api.patch(`/comments/${comment._id}/resolve`, { resolved });
    setComments((current) => current.map((item) => item._id === data._id ? data : item));
  };

  return <Modal open={open} onClose={onClose} title="Comments">
    <div className="space-y-5 p-6">
      <form onSubmit={submit} className="space-y-2"><textarea value={content} onChange={(event) => setContent(event.target.value)} rows={3} maxLength={5000} placeholder="Add a comment. Mention collaborators with @email…" className="field-control w-full resize-y p-3 text-sm" /><div className="flex justify-end"><button type="submit" disabled={submitting || !content.trim()} className="primary-action px-4 py-2 text-sm disabled:opacity-50">{submitting ? 'Posting…' : 'Comment'}</button></div></form>
      {error && <p role="alert" className="error-alert mb-4">{error}</p>}
      <div className="space-y-3">{comments.length ? comments.map((comment) => <article key={comment._id} className={`surface-card rounded-xl p-4 ${comment.resolved ? 'opacity-70' : ''}`}><div className="flex items-start gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-surface">{comment.author?.name?.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{comment.author?.name}</p><time className="text-[11px] text-muted">{new Date(comment.createdAt).toLocaleString()}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{comment.content}</p>{comment.resolved && <p className="mt-2 flex items-center gap-1 text-xs text-muted"><CheckCircle2 size={13} /> Resolved{comment.resolvedBy?.name ? ` by ${comment.resolvedBy.name}` : ''}</p>}</div>{canResolve && <button type="button" onClick={() => setResolved(comment, !comment.resolved)} className="icon-action h-9 w-9" aria-label={comment.resolved ? 'Reopen comment' : 'Resolve comment'}>{comment.resolved ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />}</button>}</div></article>) : <div className="py-10 text-center text-sm text-muted"><MessageSquare className="mx-auto mb-2" size={28} />No comments yet.</div>}</div>
    </div>
  </Modal>;
}
