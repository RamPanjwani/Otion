import { motion } from 'motion/react';
import { ArrowRight, FileText, Moon, MousePointer2, Sparkles, Sun, Users2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import AmbientBackground from '../components/AmbientBackground';
import BrandMark from '../components/BrandMark';
import useAuth from '../hooks/useAuth';
import useTheme from '../hooks/useTheme';
import useDocumentTitle from '../hooks/useDocumentTitle';

const ease = [0.22, 1, 0.36, 1];

export default function Home() {
  useDocumentTitle('');
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const targetPath = user ? '/dashboard' : '/register';

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden">
      <AmbientBackground />
      <header className="relative z-20 shrink-0 px-3 pt-4 sm:px-6">
        <nav className="glass-panel mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl px-3 sm:h-16 sm:px-5" aria-label="Primary navigation">
          <Link to="/" aria-label="Otion home"><BrandMark compact /></Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button type="button" onClick={toggleTheme} className="icon-action h-10 w-10" aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link to={user ? '/dashboard' : '/login'} className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:text-ink sm:inline-flex">{user ? 'Your notes' : 'Sign in'}</Link>
            <Link to={targetPath} className="primary-action whitespace-nowrap px-3 py-2.5 text-sm sm:px-4">{user ? 'Open Otion' : 'Get started'}<ArrowRight size={16} /></Link>
          </div>
        </nav>
      </header>

      <section className="home-hero relative mx-auto grid w-full max-w-6xl flex-1 min-h-0 items-center gap-8 overflow-hidden px-5 py-6 sm:px-6 sm:py-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12 lg:px-8 lg:py-10">
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease }} className="relative z-10">
          <div className="home-badge mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1.5 text-xs font-semibold text-muted shadow-sm backdrop-blur-xl sm:mb-6">
            <Sparkles size={14} className="text-accent" /> A calm space for thoughts and ideas
          </div>
          <h1 className="max-w-3xl text-[clamp(2.25rem,6.5vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.055em]">
            Ideas move faster when everyone is in the flow.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:mt-6 sm:text-lg sm:leading-8">
            Write, organize, and shape notes together in one calm space—without losing context to tabs, tools, or version chaos.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
            <Link to={targetPath} className="primary-action whitespace-nowrap px-6 py-3.5">{user ? 'Open your notes' : 'Start writing'}<ArrowRight size={18} /></Link>
            <Link to={user ? '/dashboard' : '/login'} className="secondary-action whitespace-nowrap px-6 py-3.5">{user ? 'View all notes' : 'I already have an account'}</Link>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.96, y: 26 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08, ease }} className="home-preview relative mx-auto hidden w-full max-w-[620px] lg:block">
          <div className="elevated-panel overflow-hidden rounded-[24px] p-2">
            <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /></div>
              <span className="text-[11px] font-medium text-muted">otion.app</span>
              <span className="w-12" />
            </div>
            <div className="grid min-h-[400px] grid-cols-[150px_1fr] overflow-hidden rounded-b-[18px] bg-surface/75 sm:grid-cols-[180px_1fr]">
              <aside className="border-r border-line bg-panel/45 p-3">
                <div className="mb-5 flex items-center gap-2 px-2 py-1.5"><span className="grid h-7 w-7 place-items-center rounded-lg bg-ink text-[10px] font-bold text-surface">O</span><span className="truncate text-xs font-semibold">My Notes</span></div>
                <PreviewNav icon={<Sparkles size={13} />} label="Quick notes" />
                <PreviewNav icon={<FileText size={13} />} label="Product brief" active />
                <PreviewNav icon={<Users2 size={13} />} label="Research" />
                <p className="mb-2 mt-6 px-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">Starred</p>
                <PreviewNav icon={<FileText size={13} />} label="Launch plan" />
                <PreviewNav icon={<FileText size={13} />} label="Team handbook" />
              </aside>
              <article className="relative px-6 py-8 sm:px-9">
                <div className="mb-5 flex items-center justify-between">
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-semibold text-accent">Product</span>
                  <div className="flex -space-x-1.5"><Avatar letter="A" tone="violet" /><Avatar letter="M" tone="pink" /><Avatar letter="J" tone="cyan" /></div>
                </div>
                <div className="mb-4 text-4xl">✦</div>
                <h2 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Product brief</h2>
                <p className="mt-3 text-xs leading-5 text-muted sm:text-sm">A shared source of truth for the next chapter of the product.</p>
                <div className="mt-8 space-y-5">
                  <PreviewSection title="The opportunity" lines={[92, 78, 86]} />
                  <PreviewSection title="What we are building" lines={[88, 70]} />
                  <div className="grid grid-cols-2 gap-2 pt-1"><MiniCard label="Research" value="12 insights" /><MiniCard label="Decisions" value="8 aligned" /></div>
                </div>
                <motion.div animate={{ x: [0, 24, 8], y: [0, 18, 42] }} transition={{ duration: 5, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} className="pointer-events-none absolute right-10 top-40 hidden sm:block">
                  <MousePointer2 size={19} className="fill-violet-500 text-white drop-shadow" /><span className="ml-3 block rounded-full bg-violet-500 px-2 py-1 text-[9px] font-semibold text-white shadow-lg">Maya</span>
                </motion.div>
              </article>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}

function PreviewNav({ icon, label, active = false }) {
  return <div className={`mb-1 flex items-center gap-2 rounded-lg px-2 py-2 text-[10px] sm:text-xs ${active ? 'bg-surface font-semibold text-ink shadow-sm' : 'text-muted'}`}>{icon}<span className="truncate">{label}</span></div>;
}

function Avatar({ letter, tone }) {
  const tones = { violet: 'bg-ink text-surface', pink: 'bg-muted text-surface', cyan: 'bg-panel text-ink border border-line' };
  return <span className={`grid h-7 w-7 place-items-center rounded-full border-2 border-surface text-[9px] font-bold ${tones[tone] || 'bg-ink text-surface'}`}>{letter}</span>;
}

function PreviewSection({ title, lines }) {
  return <section><h3 className="mb-2 text-xs font-semibold sm:text-sm">{title}</h3><div className="space-y-2">{lines.map((width) => <div key={width} className="h-2 rounded-full bg-panel" style={{ width: `${width}%` }} />)}</div></section>;
}

function MiniCard({ label, value }) {
  return <div className="rounded-xl border border-line bg-surface/70 p-3"><p className="text-[9px] uppercase tracking-wider text-muted">{label}</p><p className="mt-1 text-[11px] font-semibold sm:text-xs">{value}</p></div>;
}
