import Link from "next/link";
import type { Essay } from "@/lib/content";
import { formatDate } from "@/lib/format";
import DraftLabel from "./DraftLabel";

function EssayDate({ essay }: { essay: Essay }) {
  return (
    <p className="smallcaps">
      <time dateTime={essay.date}>{formatDate(essay.date)}</time>
      {essay.draft && <DraftLabel className="ml-3 align-[0.1em]" />}
    </p>
  );
}

/** The newest essay, set large: the first thing on the homepage. */
export function FeaturedEssay({ essay }: { essay: Essay }) {
  return (
    <article className="text-center">
      <EssayDate essay={essay} />
      <h3 className="mt-3 font-display text-[2.75rem] leading-[1.05] text-balance sm:text-[3.5rem]">
        <Link href={`/essays/${essay.slug}`} className="transition-opacity hover:opacity-80">
          {essay.title}
        </Link>
      </h3>
    </article>
  );
}

export default function EssayList({ essays }: { essays: Essay[] }) {
  if (!essays.length) {
    return <p className="text-center text-lg italic">No essays yet.</p>;
  }

  return (
    <ul className="space-y-8 text-center">
      {essays.map((essay) => (
        <li key={essay.slug}>
          <EssayDate essay={essay} />
          <h3 className="mt-1 font-display text-[2rem] leading-tight text-balance sm:text-[2.25rem]">
            <Link href={`/essays/${essay.slug}`} className="transition-opacity hover:opacity-80">
              {essay.title}
            </Link>
          </h3>
        </li>
      ))}
    </ul>
  );
}
