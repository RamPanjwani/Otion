import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Editor from '../components/Editor';
import Loading from '../components/Loading';
import AmbientBackground from '../components/AmbientBackground';
import BrandMark from '../components/BrandMark';
import api from '../services/api';

export default function PublicNote() {
  const { token } = useParams();
  const [note, setNote] = useState(null);
  const [error, setError] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);

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
    const interval = window.setInterval(load, 3000);
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

  if (requiresPassword) return <main className="relative grid min-h-screen place-items-center p-6"><AmbientBackground /><form onSubmit={unlock} className="glass-panel w-full max-w-sm rounded-[22px] p-7"><BrandMark compact /><h1 className="mt-8 text-2xl font-semibold tracking-[-0.03em]">Protected note</h1><p className="mt-2 text-sm leading-6 text-muted">Enter the password supplied by the note owner.</p><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoFocus className="field-control mt-6 px-4 py-3" placeholder="Password" />{error && <p className="mt-2 text-sm text-red-700">{error}</p>}<button type="submit" disabled={unlocking} className="primary-action mt-4 w-full px-4 py-3 disabled:opacity-50">{unlocking ? 'Unlocking…' : 'Open note'}</button></form></main>;
  if (error) return <main className="relative grid min-h-screen place-items-center p-6"><AmbientBackground /><section className="glass-panel max-w-md rounded-[22px] p-8 text-center"><BrandMark compact className="justify-center" /><h1 className="mt-8 text-2xl font-semibold">Note not found</h1><p className="mt-3 text-muted">The note you requested could not be found.</p><Link to="/" className="primary-action mt-6 px-5 py-3 text-sm">Go to Otion</Link></section></main>;
  if (!note) return <Loading fullPage />;
  return <div className="relative min-h-screen bg-canvas"><AmbientBackground subtle /><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-canvas/75 px-5 backdrop-blur-2xl"><Link to="/"><BrandMark compact /></Link><span className="rounded-full border border-line bg-surface/60 px-3 py-1.5 text-xs font-medium text-muted">Public note · read only</span></header><article className="surface-card mx-auto my-6 min-h-[calc(100vh-120px)] max-w-[920px] rounded-[24px] px-6 py-14 sm:px-12"><div className="mb-5 text-7xl leading-none sm:text-8xl">{note.icon || '📝'}</div><h1 className="mb-12 text-5xl font-bold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">{note.title}</h1><Editor value={note.content || []} readOnly /></article></div>;
}
