import Link from "next/link";
import type { Essay } from "@/lib/content";
import DraftLabel from "./DraftLabel";

export default function EssayList({ essays }: { essays: Essay[] }) {
  if (!essays.length) {
    return <p className="font-serif text-lg text-muted">No essays yet.</p>;
  }

  return (
    <ul>
      {essays.map((essay) => (
        <li
          key={essay.slug}
          className="flex items-baseline justify-between gap-x-6 py-1.5"
        >
          <span className="font-serif text-lg leading-snug sm:text-xl">
            <Link href={`/essays/${essay.slug}`} className="hover:underline hover:decoration-1 hover:underline-offset-[0.2em]">
              {essay.title}
            </Link>
            {essay.draft && <DraftLabel className="ml-3 align-[0.15em]" />}
          </span>
          <time
            dateTime={essay.date}
            className="shrink-0 text-sm text-muted tabular-nums"
          >
            {essay.date}
          </time>
        </li>
      ))}
    </ul>
  );
}
