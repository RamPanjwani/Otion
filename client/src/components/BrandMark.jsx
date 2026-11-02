import { Sparkles } from 'lucide-react';

export default function BrandMark({ compact = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className={`${compact ? 'h-8 w-8 rounded-[10px]' : 'h-10 w-10 rounded-[13px]'} grid shrink-0 place-items-center bg-brand-gradient text-white shadow-lg shadow-violet-500/15`}>
        <Sparkles size={compact ? 15 : 18} strokeWidth={2.2} />
      </span>
      <span className={`${compact ? 'text-lg' : 'text-xl'} font-semibold tracking-[-0.03em]`}>Otion</span>
    </span>
  );
}
