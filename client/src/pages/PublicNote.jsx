import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Editor from '../components/Editor';
import Loading from '../components/Loading';
import api from '../services/api';

export default function PublicNote() {
  const { id } = useParams();
  const [note, setNote] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = () => api.get(`/notes/${id}/public`)
      .then(({ data }) => { if (active) { setNote(data); setError(''); } })
      .catch(() => { if (active) { setNote(null); setError('Page not found'); } });
    load();
    const interval = window.setInterval(load, 3000);
    const refreshOnFocus = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => { active = false; window.clearInterval(interval); document.removeEventListener('visibilitychange', refreshOnFocus); };
  }, [id]);

  if (error) return <main className="grid min-h-screen place-items-center bg-canvas p-6"><section className="text-center"><h1 className="text-2xl font-bold">Page not found</h1><p className="mt-3 text-muted">The page you requested could not be found.</p><Link to="/" className="mt-6 inline-block rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white">Go to Otion</Link></section></main>;
  if (!note) return <Loading fullPage />;
  return <div className="min-h-screen bg-canvas"><header className="flex h-14 items-center justify-between border-b border-line px-5"><Link to="/" className="font-bold">Otion</Link><span className="text-xs text-muted">Public read-only document</span></header>{note.coverImage && <div className="h-52 bg-cover bg-center" style={{ backgroundImage: `url(${note.coverImage})` }} />}<article className="mx-auto max-w-[900px] px-6 py-14 sm:px-10">{note.icon && <div className="mb-4 text-6xl">{note.icon}</div>}<h1 className="mb-10 text-4xl font-bold sm:text-5xl">{note.title}</h1><Editor value={note.content || []} readOnly /></article></div>;
}
