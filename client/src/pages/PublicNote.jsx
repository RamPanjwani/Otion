import { useEffect, useState } from 'react';
import { Copy, Link as LinkIcon, LoaderCircle } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Editor from '../components/Editor';
import Loading from '../components/Loading';
import AmbientBackground from '../components/AmbientBackground';
import BrandMark from '../components/BrandMark';
import useAuth from '../hooks/useAuth';
import useToast from '../hooks/useToast';
import useDocumentTitle from '../hooks/useDocumentTitle';
import api from '../services/api';

export default function PublicNote() {
  const { token } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [note, setNote] = useState(null);
  useDocumentTitle(note?.title || 'Shared note');
  const [error, setError] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => (accessPassword
      ? api.post(`/public/${token}/unlock`, { password: accessPassword })
      : api.get(`/public/${token}`))
      .then(({ data }) => { if (active) { setNote(data); setError(''); setRequiresPassword(false); } })
      .catch((requestError) => {
        if (!active) return;
        if (requestError.response?.status === 401) {
          setNote(null);
          setRequiresPassword(true);
          if (accessPassword) setError('Incorrect password');
        } else {
          setNote(null);
          setError('Note not found');
        }
      });
    load();
    const interval = window.setInterval(load, 5000);
    const refreshOnFocus = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => { active = false; window.clearInterval(interval); document.removeEventListener('visibilitychange', refreshOnFocus); };
  }, [accessPassword, token]);

  const unlock = async (event) => {
    event.preventDefault();
    setUnlocking(true);
    try {
      const { data } = await api.post(`/public/${token}/unlock`, { password });
      setNote(data);
      setAccessPassword(password);
      setRequiresPassword(false);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.status === 401 ? 'Incorrect password' : 'Note not found');
    } finally {
      setUnlocking(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Public link copied to clipboard');
    } catch {
      toast.error('Unable to copy link');
    }
  };

  const duplicateToWorkspace = async () => {
    if (!user) {
      navigate('/register');
      return;
    }
    setDuplicating(true);
    try {
      const { data } = await api.post('/notes', {
        title: `${note.title || 'Untitled note'} (Copy)`,
        icon: note.icon || '📝',
        content: note.content || [],
      });
      toast.success('Note copied to your notes');
      navigate(`/notes/${data._id}`);
    } catch {
      toast.error('Unable to duplicate note');
    } finally {
      setDuplicating(false);
    }
  };

  if (requiresPassword) {
    return (
      <main className="relative grid min-h-screen place-items-center p-6">
        <AmbientBackground />
        <form onSubmit={unlock} className="glass-panel w-full max-w-sm rounded-[22px] p-7">
          <BrandMark compact />
          <h1 className="mt-8 text-2xl font-semibold tracking-[-0.03em]">Protected note</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Enter the password supplied by the note owner.</p>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoFocus
            className="field-control mt-6 px-4 py-3"
            placeholder="Password"
          />
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={unlocking} className="primary-action mt-4 w-full px-4 py-3 disabled:opacity-50">
            {unlocking ? 'Unlocking…' : 'Open note'}
          </button>
        </form>
      </main>
    );
  }

  if (error) {
    return (
      <main className="relative grid min-h-screen place-items-center p-6">
        <AmbientBackground />
        <section className="glass-panel max-w-md rounded-[22px] p-8 text-center">
          <BrandMark compact className="justify-center" />
          <h1 className="mt-8 text-2xl font-semibold">Note not found</h1>
          <p className="mt-3 text-muted">The note you requested could not be found or has expired.</p>
          <Link to="/" className="primary-action mt-6 px-5 py-3 text-sm">Go to Otion</Link>
        </section>
      </main>
    );
  }

  if (!note) return <Loading fullPage />;

  return (
    <div className="relative min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-canvas/92 px-5 backdrop-blur-xl">
        <Link to="/"><BrandMark compact /></Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="icon-action h-9 w-9 text-muted hover:text-ink"
            aria-label="Copy public link"
            title="Copy link"
          >
            <LinkIcon size={16} />
          </button>
          <button
            type="button"
            onClick={duplicateToWorkspace}
            disabled={duplicating}
            className="secondary-action h-9 px-3 text-xs"
          >
            {duplicating ? <LoaderCircle size={14} className="animate-spin" /> : <Copy size={14} />}
            <span>{user ? 'Duplicate' : 'Use template'}</span>
          </button>
          <span className="hidden rounded-md bg-panel px-2.5 py-1 text-xs font-medium text-muted sm:inline-block">
            Public · read only
          </span>
        </div>
      </header>
      <article className="mx-auto min-h-[calc(100vh-56px)] max-w-[920px] px-6 pb-20 pt-16 sm:px-12 sm:pt-20 lg:px-16">
        <div className="mb-5 text-7xl leading-none sm:text-8xl">{note.icon || '📝'}</div>
        <h1 className="mb-12 text-5xl font-bold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">{note.title}</h1>
        <Editor value={note.content || []} readOnly />
      </article>
    </div>
  );
}
