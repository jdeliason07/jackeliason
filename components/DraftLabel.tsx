/** Shown only in `next dev`; drafts never reach a production build. */
export default function DraftLabel({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block border border-ink px-1.5 font-sans text-xs leading-5 tracking-wide text-ink uppercase ${className}`}
    >
      Draft
    </span>
  );
}
