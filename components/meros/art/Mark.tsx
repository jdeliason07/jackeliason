/** The Meros mark: a sharp M on blood red, underlined in gold. Original. */
export default function Mark({ className = "h-8 w-8", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="64" height="64" rx="10" fill="#8a0f1a" />
      <path d="M13 47V15h9l10 15 10-15h9v32h-8.5V30.5L32 43 21.5 30.5V47Z" fill="#f2efea" />
      <rect x="13" y="51" width="38" height="3" fill="#d1aa55" />
    </svg>
  );
}
