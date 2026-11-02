import { ArrowRight, FileText, Radio, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function Home() {
  const { user } = useAuth();
  return (
    <main className="min-h-screen bg-canvas px-5">
      <nav className="mx-auto flex h-20 max-w-6xl items-center justify-between border-b border-line"><Link to="/" className="flex items-center gap-3 text-xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-white">O</span>Otion</Link><div className="flex items-center gap-3"><Link to={user ? '/dashboard' : '/login'} className="rounded-xl px-4 py-2 text-sm font-semibold hover:bg-panel">{user ? 'Workspace' : 'Sign in'}</Link><Link to={user ? '/dashboard' : '/register'} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white">Get started</Link></div></nav>
      <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl items-center gap-12 py-20 lg:grid-cols-[1.1fr_.9fr]">
        <div><p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-accent">A calmer place to think together</p><h1 className="max-w-3xl text-5xl font-bold leading-[1.05] tracking-[-0.04em] sm:text-7xl">Write, organize, and collaborate without the noise.</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-muted">Otion brings documents, tasks, and live teamwork into one focused workspace built for momentum.</p><Link to={user ? '/dashboard' : '/register'} className="mt-9 inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3.5 font-semibold text-white">Open your workspace <ArrowRight size={18} /></Link></div>
        <div className="rounded-xl border border-line bg-white p-5 shadow-xl shadow-ink/5"><div className="mb-10 flex items-center justify-between border-b border-line pb-4 text-sm"><span>Quarterly Roadmap</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-accent">3 people live</span></div><h2 className="text-3xl font-bold">Q3 Objectives</h2><p className="mt-4 leading-7 text-muted">A shared plan for stabilizing the platform and bringing real-time collaboration to every document.</p><div className="mt-8 space-y-3">{[[FileText,'Blocks that stay flexible'],[Radio,'Presence that feels instant'],[ShieldCheck,'Permissions you control']].map(([Icon,label]) => <div key={label} className="flex items-center gap-3 rounded-xl border border-line p-4"><Icon size={18}/><span className="font-medium">{label}</span></div>)}</div></div>
      </section>
    </main>
  );
}
