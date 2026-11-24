/** Rendered, sanitized Markdown. See lib/markdown.ts. */
export default function Prose({ html, className = "" }: { html: string; className?: string }) {
  return <div className={`prose ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
