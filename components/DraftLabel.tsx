/** Shown only in `next dev`; drafts never reach a production build. */
export default function DraftLabel({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block border border-current px-1.5 font-sans text-xs leading-5 tracking-wide uppercase ${className}`}
    >
      Draft
    </span>
  );
}
