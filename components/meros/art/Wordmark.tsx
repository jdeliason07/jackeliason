import { APP_NAME } from "@/lib/meros/config";

/**
 * The Meros wordmark: lowercase, Exo 2 ExtraBold Italic, bone on red or charcoal. With `stroke`, the
 * speed stroke from the splash screen runs underneath.
 */
export default function Wordmark({ className = "text-2xl", stroke = false, as: Tag = "span" }: { className?: string; stroke?: boolean; as?: "span" | "h1" }) {
  return (
    <Tag className={`inline-flex flex-col items-stretch ${className}`}>
      <span className="wordmark">{APP_NAME.toLowerCase()}</span>
      {stroke && <span aria-hidden="true" className="speed-stroke mt-[0.12em] ml-[0.1em]" />}
    </Tag>
  );
}
