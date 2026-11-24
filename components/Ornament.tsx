/** A printer's flourish between rules, used as a section break. */
export default function Ornament({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`flex items-center justify-center gap-4 text-accent ${className}`}>
      <span className="h-px w-16 bg-rule sm:w-24" />
      <span className="font-display text-[1.25rem] leading-none">❦</span>
      <span className="h-px w-16 bg-rule sm:w-24" />
    </div>
  );
}
