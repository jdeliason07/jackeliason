import Cards from "@/components/Cards";
import JsonLd from "@/components/JsonLd";
import Reveal from "@/components/Reveal";
import SubscribeForm from "@/components/SubscribeForm";
import { newsletterEnabled, profiles, site } from "@/lib/config";
import { getEssays } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ description: site.description, path: "/" });

/**
 * A title page, then one row of buttons (the latest essay, then each venture) and the
 * places to follow along, arriving as you scroll. Section headings are for screen readers.
 */
export default function Home() {
  const [latest] = getEssays();
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
      <section className="pt-24 text-center sm:pt-36">
        <h1 className="font-display text-[clamp(3.5rem,16vw,7rem)] leading-[0.95] text-balance">{site.greeting}</h1>
        <p className="mt-6 text-[1.1875rem] leading-relaxed text-pretty text-white sm:text-[1.3125rem]">
          {site.tagline.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
      </section>

      <section aria-labelledby="work-heading" className="mt-20 sm:mt-28">
        <h2 id="work-heading" className="sr-only">
          The latest essay, and ventures
        </h2>
        <Reveal>
          <Cards essay={latest} />
        </Reveal>
        {newsletterEnabled() && (
          <Reveal className="mt-20 sm:mt-24">
            <SubscribeForm />
          </Reveal>
        )}
      </section>

      <section aria-labelledby="elsewhere-heading" className="mt-24 sm:mt-28">
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
