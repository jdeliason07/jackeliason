import Link from "next/link";
import type { Essay } from "@/lib/content";
import { formatDate } from "@/lib/format";
import DraftLabel from "./DraftLabel";

/** The newest essay, set large: the first thing on the homepage. */
export function FeaturedEssay({ essay }: { essay: Essay }) {
  return (
    <article className="text-center">
      <p className="smallcaps text-muted">
        <time dateTime={essay.date}>{formatDate(essay.date)}</time>
        {essay.draft && <DraftLabel className="ml-3 align-[0.1em]" />}
      </p>
      <h3 className="mt-3 font-display text-[2.25rem] leading-[1.1] text-balance sm:text-[3rem]">
        <Link href={`/essays/${essay.slug}`} className="hover:text-accent">
          {essay.title}
        </Link>
      </h3>
      <p className="mx-auto mt-4 max-w-[34rem] text-[1.1875rem] leading-relaxed text-pretty italic sm:text-[1.3125rem]">
        {essay.summary}
      </p>
      <p className="mt-6">
        <Link href={`/essays/${essay.slug}`} className="link smallcaps">
          Read the essay <span aria-hidden="true">→</span>
        </Link>
      </p>
    </article>
  );
}

export default function EssayList({ essays }: { essays: Essay[] }) {
  if (!essays.length) {
    return <p className="text-lg text-muted italic">No essays yet.</p>;
  }

  return (
    <ul className="divide-y divide-rule/60">
      {essays.map((essay) => (
        <li key={essay.slug} className="py-5 first:pt-0 last:pb-0">
          <p className="smallcaps text-muted">
            <time dateTime={essay.date}>{formatDate(essay.date)}</time>
            {essay.draft && <DraftLabel className="ml-3 align-[0.1em]" />}
          </p>
          <h3 className="mt-1 font-display text-[1.625rem] leading-tight text-balance sm:text-[1.875rem]">
            <Link href={`/essays/${essay.slug}`} className="hover:text-accent">
              {essay.title}
            </Link>
          </h3>
          <p className="mt-1.5 text-[1.0625rem] leading-snug text-muted italic">{essay.summary}</p>
        </li>
      ))}
    </ul>
  );
}
