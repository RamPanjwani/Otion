export default function BrandMark({ compact = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src="/otion-icon.svg"
        alt="Otion"
        className={`${compact ? 'h-8 w-8 rounded-[9px]' : 'h-10 w-10 rounded-[12px]'} shrink-0 object-contain shadow-sm`}
      />
      <span className={`${compact ? 'text-lg' : 'text-xl'} font-semibold tracking-[-0.03em]`}>Otion</span>
    </span>
  );
}
