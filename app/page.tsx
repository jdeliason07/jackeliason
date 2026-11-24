import ChapterRule from "@/components/ChapterRule";
import EssayList, { FeaturedEssay } from "@/components/EssayList";
import JsonLd from "@/components/JsonLd";
import Reveal from "@/components/Reveal";
import SubscribeForm from "@/components/SubscribeForm";
import Ventures from "@/components/Ventures";
import { newsletterEnabled, profiles, site } from "@/lib/config";
import { getEssays } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ description: site.description, path: "/" });

/**
 * The book: a title page, then chapters that arrive as you scroll
 * (Essays, Ventures, Elsewhere), each opened by a fleuron.
 * Chapter headings are for screen readers; the page itself stays nearly wordless.
 */
export default function Home() {
  const essays = getEssays();
  const [latest, ...earlier] = essays;
  const links = profiles();

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: site.name,
          url: site.url,
          ...(site.email && { email: `mailto:${site.email}` }),
          sameAs: links.map((link) => link.url),
        }}
      />

      {/* The title page. Not a Reveal: it is the first thing painted, so it never waits on JavaScript. */}
      <section className="relative isolate text-center">
        {/* The one accent, as light: a soft wood-brown glow behind the name. Decorative only. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[42%] left-1/2 -z-10 h-[22rem] w-full max-w-[40rem] -translate-x-1/2 -translate-y-1/2 opacity-35"
          style={{
            // The blur is in the gradient: an eased fall-off, no visible edge. (A CSS blur filter
            // over this size bands into faint rings, and costs a large repaint.)
            background:
              "radial-gradient(closest-side, var(--color-accent), color-mix(in srgb, var(--color-accent) 72%, transparent) 30%, color-mix(in srgb, var(--color-accent) 42%, transparent) 55%, color-mix(in srgb, var(--color-accent) 16%, transparent) 78%, transparent)",
          }}
        />
        <h1 className="font-display text-[clamp(3.5rem,16vw,7rem)] leading-[0.95] text-balance">{site.name}</h1>
        <p className="mt-6 text-[1.1875rem] leading-relaxed text-pretty text-white/80 italic sm:text-[1.3125rem]">
          {site.tagline.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
        <a href="#essays" className="smallcaps mt-14 inline-flex flex-col items-center gap-1 sm:mt-16">
          Scroll
          <span aria-hidden="true" className="bob text-[1rem] leading-none tracking-normal">
            ↓
          </span>
        </a>
      </section>

      <section id="essays" aria-labelledby="essays-heading" className="mt-20 scroll-mt-10 sm:mt-28">
        <h2 id="essays-heading" className="sr-only">
          Essays
        </h2>
        <Reveal>{latest ? <FeaturedEssay essay={latest} /> : <EssayList essays={[]} />}</Reveal>
        {earlier.length > 0 && (
          <Reveal delay={120} className="mt-14">
            <EssayList essays={earlier.slice(0, 4)} />
          </Reveal>
        )}
        {newsletterEnabled() && (
          <Reveal className="mt-20 sm:mt-24">
            <SubscribeForm />
          </Reveal>
        )}
      </section>

      <ChapterRule />
      <section aria-labelledby="ventures-heading">
        <h2 id="ventures-heading" className="sr-only">
          Ventures
        </h2>
        <Reveal>
          <Ventures />
        </Reveal>
      </section>

      <ChapterRule />
      <section aria-labelledby="elsewhere-heading">
        <h2 id="elsewhere-heading" className="sr-only">
          Elsewhere
        </h2>
        <Reveal>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[1.0625rem]">
            {links.map((link) => (
              <li key={link.url}>
                <a href={link.url} rel="me" className="draw">
                  {link.name}
                </a>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>
    </>
  );
}
