import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/config";
import type { Essay } from "@/lib/content";
import { essayHand } from "@/lib/fonts";
import { formatDate } from "@/lib/format";
import DraftLabel from "./DraftLabel";

/**
 * The homepage's buttons: the latest essay (in the essay hand) and each venture.
 * At rest each shows only its title or logo; hovered or focused it widens to 40% of
 * the page and shows a blurb. Server-rendered, CSS only: see .cards in globals.css.
 */
export default function Cards({ essay }: { essay?: Essay }) {
  return (
    <ul className={`cards ${essayHand.variable}`}>
      {essay && (
        <li>
          <Link href={`/essays/${essay.slug}`} className="card card-hand">
            <span className="card-face">
              <span className="card-title">{essay.title}</span>
              {essay.draft && <DraftLabel className="ml-2" />}
            </span>
            <span className="card-more">
              <span className="card-blurb">{essay.summary}</span>
              <span className="card-detail">
                <time dateTime={essay.date}>{formatDate(essay.date)}</time>
              </span>
              <span className="smallcaps card-action">
                Read&nbsp;<span aria-hidden="true" className="card-arrow">→</span>
              </span>
            </span>
          </Link>
        </li>
      )}
      {site.ventures.map((venture) => (
        <li key={venture.url}>
          <a href={venture.url} className="card">
            <span className="card-face">
              <Image
                src={venture.logo.src}
                width={venture.logo.width}
                height={venture.logo.height}
                alt={venture.name}
                unoptimized
                className="card-logo"
                style={{ maxHeight: venture.logo.displayHeight, width: "auto", height: "auto" }}
              />
            </span>
            <span className="card-more">
              <span className="card-blurb">{venture.blurb}</span>
              <span className="card-detail">{venture.detail}</span>
              <span className="smallcaps card-action">
                Visit&nbsp;<span aria-hidden="true" className="card-arrow">→</span>
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
